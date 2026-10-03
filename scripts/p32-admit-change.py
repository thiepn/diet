#!/usr/bin/env python3
import argparse,hashlib,json
from collections import defaultdict,deque
from datetime import datetime,timezone
from pathlib import Path

TRAIN_TYPES={"app_fast","shared_standard","coordinated_breaking","platform_maintenance"}
STATEFUL_TRAIN_TYPES={"shared_standard","coordinated_breaking","platform_maintenance"}
STATEFUL_MUTATIONS={
  "database_schema","auth_rls","shared_edge_contract","cron_inventory",
  "realtime_contract","storage_contract","data_migration"
}
DESTRUCTIVE_MUTATIONS={
  "delete_user_data","destructive_restore","truncate","drop_user_table",
  "irreversible_data_rewrite","pause_production","delete_project","pitr_restore"
}
POLICY_FILES={
  "platform-p32-policy-bundle.json",
  "platform-p32-change-admission-plan.json",
  "scripts/p32-admit-change.py",
  ".github/workflows/p32-change-admission-shadow.yml",
  ".github/workflows/p32-change-admission-warn.yml"
}

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def file_sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def canonical_sha(value):
    raw=json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

def parse_time(value):
    if value.endswith("Z"): value=value[:-1]+"+00:00"
    dt=datetime.fromisoformat(value)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def transitive_consumers(graph,provider):
    direct=defaultdict(set)
    for edge in graph.get("edges",[]):
        direct[edge["provider"]].add(edge["consumer"])
    seen=set(); q=deque([provider])
    while q:
        node=q.popleft()
        for consumer in sorted(direct.get(node,())):
            if consumer not in seen:
                seen.add(consumer); q.append(consumer)
    return seen

def validate_exception(exc,bundle,manifest,now,known_policy_ids):
    errors=[]
    required=("id","policyIds","owner","approver","reason","reference","createdAt","expiresAt","scopes")
    for field in required:
        if not exc.get(field): errors.append("missing:"+field)
    if errors: return False,errors

    pids=exc.get("policyIds") or []
    scopes=exc.get("scopes") or []
    if "*" in pids or "*" in scopes: errors.append("wildcard_not_allowed")
    unknown=sorted(set(pids)-known_policy_ids)
    if unknown: errors.append("unknown_policy:"+",".join(unknown))
    nonwaivable=set(bundle["exceptionPolicy"]["nonWaivablePolicyIds"])
    if nonwaivable.intersection(pids): errors.append("non_waivable_policy")
    if exc.get("owner")!=manifest.get("owner"): errors.append("owner_mismatch")
    if exc.get("owner")==exc.get("approver"): errors.append("self_approval")
    if exc.get("approver")==manifest.get("requester"): errors.append("requester_self_approval")

    try:
        created=parse_time(exc["createdAt"]); expires=parse_time(exc["expiresAt"])
        if expires<=created: errors.append("invalid_expiry")
        if (expires-created).total_seconds()/3600 > bundle["exceptionPolicy"]["maximumLifetimeHours"]:
            errors.append("lifetime_too_long")
        if expires<=now: errors.append("expired")
        if created>now: errors.append("created_in_future")
    except Exception:
        errors.append("invalid_timestamp")

    manifest_scopes=set(manifest.get("scopes") or [])
    exception_scopes=set(scopes)
    if manifest_scopes and not manifest_scopes.issubset(exception_scopes):
        errors.append("scope_not_complete")
    return not errors,errors

def evaluate(bundle,fleet,releases,graph,manifest,bundle_path):
    pmap={p["id"]:p for p in bundle["policies"]}
    known=set(pmap)
    findings=[]
    requirements=[]
    now=parse_time(manifest.get("now") or datetime.now(timezone.utc).isoformat())
    components=list(manifest.get("components") or [])
    scopes=set(manifest.get("scopes") or [])
    resources=set(manifest.get("resources") or [])
    mutation_types=set(manifest.get("mutationTypes") or [])
    signals=manifest.get("riskSignals") or {}
    files=set(manifest.get("files") or [])
    approvals=manifest.get("humanApprovals") or {}
    integration=manifest.get("integrationEnvironment") or {}
    train=manifest.get("requiredTrainType")
    change_class=manifest.get("changeClass")
    owner=manifest.get("owner")
    fleet_map={x["id"]:x for x in fleet.get("components",[])}
    graph_nodes={x["id"] for x in graph.get("nodes",[])}

    def add(pid,message,evidence=None):
        p=pmap[pid]
        findings.append({
          "policyId":pid,"category":p["category"],"severity":p["severity"],
          "effect":p["onFail"],"waivable":p["waivable"],
          "message":message,"evidence":evidence
        })

    # Exact policy/control-plane identity.
    if manifest.get("policyBundleVersion")!=bundle.get("bundleVersion"):
        add("P32-REG-001","Policy bundle version is stale or missing.",
            {"expected":bundle.get("bundleVersion"),"actual":manifest.get("policyBundleVersion")})
    if manifest.get("fleetRegistryVersion")!=bundle.get("fleetRegistryVersion"):
        add("P32-REG-001","Fleet registry version is stale or missing.",
            {"expected":bundle.get("fleetRegistryVersion"),"actual":manifest.get("fleetRegistryVersion")})
    if manifest.get("releaseRegistryVersion")!=bundle.get("releaseRegistryVersion"):
        add("P32-REG-001","Release registry version is stale or missing.",
            {"expected":bundle.get("releaseRegistryVersion"),"actual":manifest.get("releaseRegistryVersion")})

    # Ownership and lifecycle.
    for comp in components:
        fc=fleet_map.get(comp)
        if fc is None or fc.get("governance")!="governed" or comp not in graph_nodes:
            add("P32-OWN-001","Component is not fully governed by P31/P29.",{"component":comp})
            continue
        if owner and fc.get("owner")!=owner:
            add("P32-OWN-002","Manifest owner does not match fleet owner.",
                {"component":comp,"expectedOwner":fc.get("owner"),"actualOwner":owner})
        life=fc.get("lifecycle")
        if life=="retired" or (life in ("deprecated","archived") and manifest.get("intent") not in ("maintenance","migration","retirement")):
            add("P32-LIFE-001","Change intent is incompatible with component lifecycle.",
                {"component":comp,"lifecycle":life,"intent":manifest.get("intent")})

    unresolved={x.get("id") for x in fleet.get("governanceUnresolvedResources",[])}
    touched=sorted(resources & unresolved)
    if touched:
        add("P32-OWN-001","Change touches unresolved governance resources.",touched)

    is_stateful = train in STATEFUL_TRAIN_TYPES or bool(mutation_types & STATEFUL_MUTATIONS)

    # Fleet / epoch / scoped drift.
    if is_stateful and float(fleet.get("coverage",{}).get("dependencyGraphCoveragePct",0))<100:
        add("P32-FLEET-001","Shared/stateful admission requires complete dependency-graph coverage.",
            fleet.get("coverage"))
    if is_stateful and fleet.get("releaseEpoch",{}).get("state")!="stable":
        add("P32-EPOCH-001","Shared/stateful admission is blocked while the release epoch is moving.",
            {"state":fleet.get("releaseEpoch",{}).get("state")})

    for drift in fleet.get("observedDrift",[]):
        overlap=sorted(scopes.intersection(drift.get("scopes") or []))
        if not overlap: continue
        if drift.get("id")=="supabase-main-branch-action-failed":
            if integration.get("kind")=="supabase_branch":
                add("P32-ENV-002","Hosted branch path intersects a failed branch action state.",
                    {"drift":drift.get("id"),"overlap":overlap})
        else:
            add("P32-SCOPE-001","Change scopes intersect current fleet drift.",
                {"drift":drift.get("id"),"overlap":overlap})

    # Environment strategy. This validates eligibility/availability, not P30 execution.
    if is_stateful:
        kind=integration.get("kind")
        status=integration.get("status")
        if kind not in ("local_supabase_ephemeral","isolated_supabase_project","supabase_branch") or status not in ("available","available_on_demand","healthy","approved"):
            add("P32-ENV-001","Stateful change lacks an eligible isolated integration-environment strategy.",integration)
        if kind=="supabase_branch":
            if bundle["liveBaseline"].get("organizationPlan")!="pro":
                add("P32-ENV-002","Hosted Supabase Branching is unavailable on the current organization plan.",
                    {"plan":bundle["liveBaseline"].get("organizationPlan")})
            if bundle["liveBaseline"].get("hostedBranchActionStatus")!="READY":
                add("P32-ENV-002","Hosted Supabase branch action state is not READY.",
                    {"status":bundle["liveBaseline"].get("hostedBranchActionStatus")})

    # Cost/production/data safety.
    paid=manifest.get("requestedPaidResources") or []
    if paid and approvals.get("cost") is not True:
        add("P32-COST-001","Paid resources require explicit current-cost approval.",paid)
    if manifest.get("productionMutationRequested") is True:
        add("P32-PROD-001","Direct production mutation cannot be automatically admitted.")
    destructive=sorted(mutation_types & DESTRUCTIVE_MUTATIONS)
    if destructive:
        add("P32-DATA-001","Destructive or irreversible data/recovery action requires governed human/incident handling.",destructive)

    # Security / API exposure.
    if signals.get("serviceRoleInClient") is True or signals.get("secretKeyInClient") is True:
        add("P32-SEC-001","Client/browser credential exposure detected.")
    if signals.get("userEditableMetadataAuthorization") is True:
        add("P32-SEC-002","User-editable metadata is being used for authorization.")
    if signals.get("newDataApiTableOrView") is True and signals.get("rlsEnabled") is not True:
        add("P32-SEC-003","New Data API table/view lacks explicit RLS enablement.")
    if signals.get("newPublicFunction") is True and signals.get("executePrivilegeDecision") is not True:
        add("P32-SEC-004","New public function lacks explicit EXECUTE privilege decision.")
    if signals.get("securityDefinerFunction") is True:
        if signals.get("callableRolesRestricted") is not True or signals.get("authorizationDesignDeclared") is not True:
            add("P32-SEC-004","SECURITY DEFINER function lacks restricted callable roles or declared authorization design.")
    if signals.get("newPublicDataApiObject") is True and signals.get("explicitExposureDecision") is not True:
        add("P32-SEC-005","New public Data API object lacks an explicit grant/revoke exposure decision.")
    if signals.get("unpinnedProductionAction") is True:
        add("P32-SUPPLY-001","Production workflow action is not pinned to an immutable commit SHA.")

    # Compatibility and train routing.
    shared_mutation=bool(mutation_types & STATEFUL_MUTATIONS) or change_class in ("provider_additive","provider_breaking","infrastructure_contract","data_migration_no_contract","operational_job")
    if shared_mutation and train=="app_fast":
        add("P32-TRAIN-001","Shared/stateful change cannot use app_fast.")
    if change_class=="provider_breaking":
        if manifest.get("p29ImpactComplete") is not True:
            add("P32-COMPAT-001","Breaking provider change lacks completed P29 impact evidence.")
        required=set()
        for comp in components:
            if comp in graph_nodes: required.update(transitive_consumers(graph,comp))
        supplied=set(manifest.get("affectedConsumers") or [])
        missing=sorted(required-supplied)
        if missing:
            add("P32-COMPAT-001","Breaking provider change omits transitive consumers.",missing)

    # Optional claim that the change already passed P31 release eligibility.
    if manifest.get("claimsP31Eligible") is True:
        p31=manifest.get("p31Decision") or {}
        if p31.get("decision")!="allow":
            add("P32-P31-001","Claimed P31 eligibility lacks an allow decision.",p31)
        if manifest.get("candidateId") and p31.get("candidateId")!=manifest.get("candidateId"):
            add("P32-P31-001","P31 decision candidate does not match manifest candidate.")
        p31_scopes=set(p31.get("scopes") or [])
        if p31_scopes and p31_scopes!=scopes:
            add("P32-P31-001","P31 decision scopes do not exactly match manifest scopes.")

    # Policy self-protection: always escalate; this engine cannot self-authorize.
    policy_change=signals.get("policySelfModification") is True or bool(files & POLICY_FILES)
    if policy_change:
        add("P32-POLICY-001","Policy-engine/bundle/workflow change requires independent reviewed policy change.",
            sorted(files & POLICY_FILES))

    # Exceptions.
    valid_exceptions=[]
    invalid_exceptions=[]
    expired_exceptions=[]
    for exc in manifest.get("exceptions") or []:
        ok,errs=validate_exception(exc,bundle,manifest,now,known)
        if ok:
            valid_exceptions.append(exc)
        else:
            invalid_exceptions.append({"id":exc.get("id"),"errors":errs})
            if "expired" in errs:
                expired_exceptions.append(exc.get("id"))

    if invalid_exceptions:
        # Expired exceptions are ignored/reported, not themselves a hard failure.
        hard_invalid=[x for x in invalid_exceptions if x["id"] not in expired_exceptions]
        if hard_invalid:
            add("P32-EXC-001","Invalid admission exception.",hard_invalid)

    waived=[]
    effective=[]
    for finding in findings:
        pid=finding["policyId"]
        if not finding["waivable"]:
            effective.append(finding); continue
        matched=None
        for exc in valid_exceptions:
            if pid in set(exc.get("policyIds") or []):
                matched=exc; break
        if matched:
            waived.append({"finding":finding,"exceptionId":matched["id"]})
        else:
            effective.append(finding)

    effects={x["effect"] for x in effective}
    decision="block" if "block" in effects else ("escalate" if "escalate" in effects else "admit")

    if decision=="admit":
        requirements.extend(["P29 impact/compatibility as applicable","P30 immutable candidate and promotion gates","P31 can-release before promotion","explicit production approval for production"])
    elif decision=="escalate":
        requirements.append("explicit human/platform/incident decision required before admission continues")

    manifest_sha=canonical_sha(manifest)
    bundle_sha=file_sha(bundle_path)
    receipt_material={
      "changeId":manifest.get("changeId"),"decision":decision,
      "policyBundleVersion":bundle.get("bundleVersion"),"policyBundleSha256":bundle_sha,
      "manifestSha256":manifest_sha,
      "effectiveFindings":effective,"waivedFindings":waived
    }
    return {
      "schemaVersion":2,"phase":"P32","mode":bundle.get("mode"),
      "changeId":manifest.get("changeId"),
      "decision":decision,
      "wouldBlock":decision=="block",
      "wouldEscalate":decision=="escalate",
      "mergeBlockedByP32":bundle.get("mode")=="enforce" and decision=="block",
      "productionApproved":False,
      "productionPromotionPerformed":False,
      "policyBundleVersion":bundle.get("bundleVersion"),
      "policyBundleSha256":bundle_sha,
      "manifestSha256":manifest_sha,
      "admissionReceiptId":canonical_sha(receipt_material),
      "effectiveFindings":effective,
      "waivedFindings":waived,
      "invalidExceptions":invalid_exceptions,
      "expiredExceptions":expired_exceptions,
      "requirements":requirements
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--bundle",default="platform-p32-policy-bundle.json")
    ap.add_argument("--fleet",default="platform-p31-fleet-registry.json")
    ap.add_argument("--releases",default="platform-p31-release-registry.json")
    ap.add_argument("--graph",default="platform-p29-dependency-graph.json")
    ap.add_argument("--out",default="p32-admission-decision.json")
    ap.add_argument("--fail-on-non-admit",action="store_true")
    args=ap.parse_args()

    manifest=load(args.manifest)
    result=evaluate(load(args.bundle),load(args.fleet),load(args.releases),load(args.graph),manifest,args.bundle)
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    if args.fail_on_non_admit and result["decision"]!="admit":
        raise SystemExit(1)

if __name__=="__main__": main()
