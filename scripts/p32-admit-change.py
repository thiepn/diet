#!/usr/bin/env python3
import argparse, hashlib, json
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

STATEFUL_TRAIN_TYPES={"shared_standard","coordinated_breaking","platform_maintenance"}
DESTRUCTIVE_MUTATIONS={
    "delete_user_data","destructive_restore","truncate","drop_user_table",
    "irreversible_data_rewrite","pause_production","delete_project"
}

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def canonical_sha(value):
    raw=json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

def parse_time(value):
    return datetime.fromisoformat(value.replace("Z","+00:00"))

def policy_map(bundle):
    return {p["id"]:p for p in bundle["policies"]}

def transitive_consumers(graph, provider):
    direct=defaultdict(set)
    for edge in graph.get("edges",[]):
        direct[edge["provider"]].add(edge["consumer"])
    seen=set(); q=deque([provider])
    while q:
        node=q.popleft()
        for consumer in direct.get(node,()):
            if consumer not in seen:
                seen.add(consumer);q.append(consumer)
    return seen

def valid_exception(exc,bundle,manifest,now):
    errors=[]
    required=("policyIds","owner","approver","reason","reference","createdAt","expiresAt","scopes")
    for field in required:
        if not exc.get(field):
            errors.append("missing:"+field)
    if errors:
        return False,errors
    if exc["owner"]==exc["approver"]:
        errors.append("self_approval")
    if "*" in exc.get("policyIds",[]) or "*" in exc.get("scopes",[]):
        errors.append("wildcard_not_allowed")
    nonwaivable=set(bundle["exceptionPolicy"]["nonWaivablePolicyIds"])
    if nonwaivable.intersection(exc.get("policyIds",[])):
        errors.append("non_waivable_policy")
    try:
        created=parse_time(exc["createdAt"]); expires=parse_time(exc["expiresAt"])
        if expires<=created:
            errors.append("invalid_expiry")
        hours=(expires-created).total_seconds()/3600
        if hours>bundle["exceptionPolicy"]["maximumLifetimeHours"]:
            errors.append("lifetime_too_long")
        if expires<=now:
            errors.append("expired")
    except Exception:
        errors.append("invalid_timestamp")
    manifest_scopes=set(manifest.get("scopes") or [])
    exception_scopes=set(exc.get("scopes") or [])
    if manifest_scopes and not manifest_scopes.intersection(exception_scopes):
        errors.append("scope_mismatch")
    return not errors,errors

def evaluate(bundle,fleet,graph,manifest):
    policies=policy_map(bundle)
    findings=[]
    requirements=[]
    now=parse_time(manifest.get("now") or datetime.now(timezone.utc).isoformat())
    components=manifest.get("components") or []
    resources=set(manifest.get("resources") or [])
    scopes=set(manifest.get("scopes") or [])
    mutation_types=set(manifest.get("mutationTypes") or [])
    signals=manifest.get("riskSignals") or {}
    train_type=manifest.get("requiredTrainType")
    change_class=manifest.get("changeClass")
    owner=manifest.get("owner")
    approvals=manifest.get("humanApprovals") or {}
    integration=manifest.get("integrationEnvironment") or {}
    fleet_components={x["id"]:x for x in fleet.get("components",[])}
    graph_nodes={x["id"] for x in graph.get("nodes",[])}

    def add(policy_id,message,evidence=None):
        p=policies[policy_id]
        findings.append({
          "policyId":policy_id,"category":p["category"],"severity":p["severity"],
          "effect":p["onFail"],"waivable":p["waivable"],
          "message":message,"evidence":evidence
        })

    # Ownership / component integrity.
    unknown=[c for c in components if c not in fleet_components or c not in graph_nodes]
    if unknown:
        add("P32-OWN-001","Unknown component(s) are not governed by the fleet registry.",unknown)
    mismatched=[]
    for c in components:
        fc=fleet_components.get(c)
        if fc and owner and fc.get("owner")!=owner and len(components)==1:
            mismatched.append({"component":c,"registryOwner":fc.get("owner"),"requestOwner":owner})
    if mismatched:
        add("P32-OWN-001","Requested owner does not match fleet ownership.",mismatched)

    # Lifecycle.
    invalid_lifecycle=[]
    for c in components:
        state=(fleet_components.get(c) or {}).get("lifecycle")
        if state=="retired":
            invalid_lifecycle.append({"component":c,"state":state})
        elif state in ("deprecated","archived") and manifest.get("intent") not in ("maintenance","migration","retirement"):
            invalid_lifecycle.append({"component":c,"state":state})
    if invalid_lifecycle:
        add("P32-LIFE-001","Change intent is incompatible with component lifecycle.",invalid_lifecycle)

    unresolved={x["id"] for x in fleet.get("governanceUnresolved",[])}
    touched=sorted(resources & unresolved)
    if touched:
        add("P32-GOV-001","Change touches unresolved governance resource(s).",touched)

    # Moving epoch and existing fleet blocks.
    is_stateful=(train_type in STATEFUL_TRAIN_TYPES or
      bool(mutation_types & {"database_schema","auth_rls","shared_edge_contract","cron_inventory","realtime_contract","storage_contract"}))
    if is_stateful and bundle["liveBaseline"].get("releaseEpochState")!="stable":
        add("P32-EPOCH-001","Stateful/shared admission is blocked while the release epoch is moving.",
            {"migrationHead":bundle["liveBaseline"].get("migrationHead")})
    for block in fleet.get("observedBlocks",[]):
        if scopes.intersection(block.get("scopes",[])):
            add("P32-EPOCH-001","Change scopes intersect an observed fleet block.",
                {"blockId":block["id"],"scopes":sorted(scopes.intersection(block.get("scopes",[])))})

    # Stateful integration environment requirements.
    if is_stateful:
        if integration.get("kind") not in ("supabase_branch","supabase_persistent_branch") or integration.get("status")!="healthy":
            add("P32-ENV-001","Stateful/shared change lacks a healthy isolated Supabase integration environment.",integration)
        if integration.get("branchActionStatus")=="MIGRATIONS_FAILED":
            add("P32-ENV-002","Integration branch reports MIGRATIONS_FAILED.",integration)

    # Paid resources and production/destructive mutations.
    paid=manifest.get("requestedPaidResources") or []
    if paid and approvals.get("cost") is not True:
        add("P32-COST-001","Paid resource request requires explicit approved cost confirmation.",paid)
    if manifest.get("productionMutationRequested") is True:
        add("P32-PROD-001","Direct production mutation requires human-controlled release/promotion approval.")
    destructive=sorted(mutation_types & DESTRUCTIVE_MUTATIONS)
    if destructive:
        add("P32-DATA-001","Destructive or irreversible data action requires explicit incident/governed approval.",destructive)

    # Supabase/security anti-patterns.
    if signals.get("serviceRoleInClient") is True or signals.get("secretKeyInClient") is True:
        add("P32-SEC-001","Secret/service-role credential exposure detected.")
    if signals.get("userMetadataAuthorization") is True:
        add("P32-SEC-002","User-editable metadata is used for authorization.")
    if signals.get("newExposedTable") is True and signals.get("rlsEnabled") is not True:
        add("P32-SEC-003","New exposed table is missing RLS.")
    if signals.get("publicSecurityDefiner") is True and signals.get("securityDefinerRestricted") is not True:
        add("P32-SEC-004","Public SECURITY DEFINER function is not explicitly restricted.")
    if signals.get("deprecatedAuthRole") is True:
        add("P32-SEC-005","Deprecated auth.role() authorization check detected.")
    if signals.get("unpinnedGithubAction") is True:
        add("P32-SUPPLY-001","Production GitHub Action is not pinned to an immutable commit SHA.")

    # Compatibility and release-train routing.
    if change_class=="provider_breaking":
        if not components:
            add("P32-COMPAT-001","Breaking provider change has no declared provider component.")
        else:
            provider=components[0]
            expected=transitive_consumers(graph,provider)
            declared=set(manifest.get("affectedConsumers") or [])
            missing=sorted(expected-declared)
            if manifest.get("p29ImpactComplete") is not True or missing:
                add("P32-COMPAT-001","Breaking provider change is missing transitive consumer coverage.",
                    {"provider":provider,"missingConsumers":missing,"p29ImpactComplete":manifest.get("p29ImpactComplete")})
        requirements.append("P29 all-transitive compatibility certificate")

    shared_contract=(
      change_class in ("provider_additive","provider_breaking","infrastructure_contract","operational_job")
      or is_stateful
      or bool(mutation_types & {"shared_edge_contract","identity_contract","database_schema","cron_inventory"})
    )
    if shared_contract and train_type=="app_fast":
        add("P32-TRAIN-001","Shared/stateful change cannot enter an app_fast train.")
    if shared_contract:
        requirements.append("P30 stateful release train")
    else:
        requirements.append("P30 app_fast or equivalent consumer-only train")

    # Policy self-modification is always escalated.
    changed_files=set(manifest.get("files") or [])
    policy_paths={
      "platform-p32-policy-bundle.json","platform-p32-change-admission-plan.json",
      "scripts/p32-admit-change.py",".github/workflows/p32-change-admission-shadow.yml"
    }
    if changed_files.intersection(policy_paths) or signals.get("policySelfModification") is True:
        add("P32-POLICY-001","Policy/admission-engine modification requires independent platform review.",
            sorted(changed_files.intersection(policy_paths)))

    # Validate exceptions, then waive only eligible findings.
    valid_exceptions=[]
    invalid_exceptions=[]
    for exc in manifest.get("exceptions") or []:
        ok,errors=valid_exception(exc,bundle,manifest,now)
        entry={"id":exc.get("id"),"policyIds":exc.get("policyIds",[]),"valid":ok,"errors":errors}
        (valid_exceptions if ok else invalid_exceptions).append(entry)
    if invalid_exceptions:
        add("P32-EXC-001","One or more policy exceptions are invalid.",invalid_exceptions)

    waived=set()
    for finding in findings:
        pid=finding["policyId"]
        if not finding["waivable"]:
            continue
        for exc in manifest.get("exceptions") or []:
            ok,_=valid_exception(exc,bundle,manifest,now)
            if ok and pid in exc.get("policyIds",[]):
                waived.add(pid)
                break

    effective=[f for f in findings if f["policyId"] not in waived]
    block=[f for f in effective if f["effect"]=="block"]
    escalate=[f for f in effective if f["effect"]=="escalate"]
    decision="block" if block else ("escalate" if escalate else "admit")

    # Admitted means entry into the governed release flow only.
    requirements.extend(["P29 impact/certification as applicable","P30 promotion gate","P31 can-release before advancement"])
    requirements=sorted(set(requirements))

    return {
      "schemaVersion":1,
      "phase":"P32",
      "mode":bundle["mode"],
      "policyBundleVersion":bundle["bundleVersion"],
      "policyBundleSha256":canonical_sha(bundle),
      "changeId":manifest.get("changeId"),
      "decision":decision,
      "productionApproved":False,
      "admissionMeaning":"entry_to_governed_release_flow_only",
      "findings":findings,
      "waivedPolicyIds":sorted(waived),
      "effectiveFindings":effective,
      "requirements":requirements,
      "validExceptions":valid_exceptions,
      "invalidExceptions":invalid_exceptions,
      "releaseEpoch":{
        "state":bundle["liveBaseline"].get("releaseEpochState"),
        "migrationHead":bundle["liveBaseline"].get("migrationHead"),
        "semanticSchemaSha256":bundle["liveBaseline"].get("semanticSchemaSha256")
      }
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--policy",default="platform-p32-policy-bundle.json")
    ap.add_argument("--fleet",default="platform-p31-fleet-registry.json")
    ap.add_argument("--graph",default="platform-p29-dependency-graph.json")
    ap.add_argument("--out",default="p32-admission-decision.json")
    ap.add_argument("--fail-on-block",action="store_true")
    args=ap.parse_args()

    result=evaluate(load(args.policy),load(args.fleet),load(args.graph),load(args.manifest))
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    if args.fail_on_block and result["decision"]=="block":
        raise SystemExit(1)

if __name__=="__main__":
    main()
