#!/usr/bin/env python3
import argparse,json
from datetime import datetime,timezone
from pathlib import Path

TRAIN_TYPES={"app_fast","shared_standard","coordinated_breaking","platform_maintenance"}
STATEFUL={"shared_standard","coordinated_breaking","platform_maintenance"}

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dump(obj,path=None):
    if path:
        Path(path).write_text(json.dumps(obj,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(obj,separators=(",",":")))

def parse_time(value):
    if value.endswith("Z"): value=value[:-1]+"+00:00"
    dt=datetime.fromisoformat(value)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def component_map(fleet):
    return {x["id"]:x for x in fleet.get("components",[])}

def graph_ids(graph):
    return {x["id"] for x in graph.get("nodes",[])}

def governed_ids(fleet):
    return {x["id"] for x in fleet.get("components",[]) if x.get("governance")=="governed"}

def unmodeled_ids(fleet):
    return {x["id"] for x in fleet.get("components",[]) if x.get("governance")!="governed"}

def classify(fleet):
    if fleet.get("canonicalProject",{}).get("serviceStatus")!="ACTIVE_HEALTHY":
        return "red"
    if fleet.get("observedDrift") or unmodeled_ids(fleet) or fleet.get("releaseEpoch",{}).get("state")!="stable":
        return "amber"
    return "green"

def status(fleet,releases,graph):
    gids=graph_ids(graph)
    cids={x["id"] for x in fleet.get("components",[])}
    missing_graph=sorted(cids-gids)
    missing_fleet=sorted(gids-cids)
    return {
      "schemaVersion":2,
      "phase":"P31",
      "fleetRegistryVersion":fleet.get("registryVersion"),
      "releaseRegistryVersion":releases.get("registryVersion"),
      "productionHealth":fleet.get("productionHealth"),
      "releaseSafety":fleet.get("releaseSafety"),
      "fleetState":classify(fleet),
      "coordinationMode":fleet.get("coordinationMode"),
      "releaseEpochState":fleet.get("releaseEpoch",{}).get("state"),
      "migrationHead":fleet.get("releaseEpoch",{}).get("migrationHead"),
      "semanticSchemaSha256":fleet.get("releaseEpoch",{}).get("semanticSchemaSha256"),
      "publishedOperationsVersion":releases.get("publishedOperationsVersion"),
      "latestMergedGovernancePhase":releases.get("latestMergedGovernancePhase"),
      "dependencyGraphVersion":graph.get("graphVersion"),
      "observedComponentCount":len(cids),
      "governedComponentCount":len(governed_ids(fleet)),
      "dependencyGraphNodeCount":len(gids),
      "dependencyGraphMissingComponents":missing_graph,
      "fleetMissingGraphComponents":missing_fleet,
      "observedDrift":fleet.get("observedDrift",[]),
      "activeTrainCount":len(releases.get("trains",{}).get("active",[])),
      "productionTrainCount":len(releases.get("trains",{}).get("production",[]))
    }

def validate(fleet,releases,graph,plan):
    errors=[]
    warnings=[]
    gids=graph_ids(graph)
    governed=governed_ids(fleet)
    observed_unmodeled=unmodeled_ids(fleet)

    if governed!=gids:
        missing=sorted(gids-governed)
        extra=sorted(governed-gids)
        if missing: errors.append("governed_fleet_missing_graph_nodes:"+",".join(missing))
        if extra: errors.append("governed_fleet_has_unmodeled_graph_nodes:"+",".join(extra))

    drift_components={x.get("component") for x in fleet.get("observedDrift",[]) if x.get("component")}
    for comp in sorted(observed_unmodeled):
        if comp not in drift_components:
            errors.append("unmodeled_component_not_declared_as_drift:"+comp)

    phases=releases.get("phases",[])
    ids=[x.get("id") for x in phases]
    if ids!=["P26","P27","P28","P29","P30","P31"]:
        errors.append("release_phase_sequence_invalid")
    for p in phases[:-1]:
        if not str(p.get("state","")).startswith("merged_"):
            errors.append("historical_phase_not_merged:"+str(p.get("id")))
        if not p.get("mergeSha"):
            errors.append("historical_phase_missing_merge_sha:"+str(p.get("id")))
    if phases and phases[-1].get("state")!="implementation_active_operator_override":
        errors.append("p31_state_invalid")

    if releases.get("latestMergedMainSha")!=plan.get("sourceMainSha"):
        errors.append("release_registry_main_sha_mismatch")
    if plan.get("automation",{}).get("productionPromotionAllowed") is not False:
        errors.append("production_promotion_automation_enabled")
    if plan.get("automation",{}).get("productionMutationAllowed") is not False:
        errors.append("production_mutation_automation_enabled")

    if observed_unmodeled:
        warnings.append("observed_unmodeled_components:"+",".join(sorted(observed_unmodeled)))
    if fleet.get("releaseEpoch",{}).get("state")!="stable":
        warnings.append("release_epoch_not_stable")
    if fleet.get("environmentSummary",{}).get("hostedPreview",{}).get("branchActionStatus")=="MIGRATIONS_FAILED":
        warnings.append("hosted_branch_action_failed")

    return {
      "schemaVersion":2,"phase":"P31",
      "status":"pass" if not errors else "fail",
      "registryStructurallyValid":not errors,
      "releaseReady":not errors and not warnings,
      "errors":errors,"warnings":warnings,
      "governedGraphNodeCount":len(governed),
      "dependencyGraphNodeCount":len(gids),
      "observedUnmodeledComponents":sorted(observed_unmodeled)
    }

def reconcile(fleet,observed):
    expected=fleet.get("releaseEpoch",{})
    expected_apps=sorted(
      x["id"] for x in fleet.get("components",[])
      if x.get("class")=="registered_app" and x.get("lifecycle") in ("active","observed_active")
    )
    checks={
      "semanticSchemaSha256":(expected.get("semanticSchemaSha256"),observed.get("semanticSchemaSha256")),
      "migrationHead":(expected.get("migrationHead"),observed.get("migrationHead")),
      "cronJobs":(expected.get("cronJobs"),observed.get("cronJobs")),
      "edgeFunctionCount":(expected.get("edgeFunctionCount"),observed.get("edgeFunctionCount")),
      "gomokuRoomVersion":(expected.get("edgeHighlights",{}).get("gomokuRoom",{}).get("version"),observed.get("gomokuRoomVersion")),
      "gomokuRoomSha256":(expected.get("edgeHighlights",{}).get("gomokuRoom",{}).get("sha256"),observed.get("gomokuRoomSha256")),
      "registeredApps":(expected_apps,sorted(observed.get("registeredApps",[])) if observed.get("registeredApps") is not None else None)
    }
    stale=[]
    for key,(a,b) in checks.items():
        if b is not None and a!=b: stale.append(key)
    return {
      "schemaVersion":2,"phase":"P31",
      "fleetRegistryVersion":fleet.get("registryVersion"),
      "status":"stale" if stale else "match",
      "stale":bool(stale),"staleFields":stale,
      "expected":{k:v[0] for k,v in checks.items()},
      "observed":{k:v[1] for k,v in checks.items()},
      "desiredStateRewritten":False
    }

def active_leases(lockdoc,now):
    active=[];expired=[]
    for lease in (lockdoc or {}).get("leases",[]):
        if lease.get("state","active")!="active":
            continue
        exp=lease.get("expiresAt")
        if exp and parse_time(exp)<=now:
            expired.append(lease); continue
        active.append(lease)
    return active,expired

def scopes_conflict(a,b):
    sa=set(a or []); sb=set(b or [])
    if "platform_global" in sa or "platform_global" in sb:
        return True
    return bool(sa & sb)

def can_release(fleet,releases,graph,intent,lockdoc=None):
    reasons=[];warnings=[]
    train=intent.get("trainType")
    scopes=set(intent.get("scopes") or [])
    components=set(intent.get("components") or [])
    resources=set(intent.get("resources") or [])
    now=parse_time(intent.get("now") or datetime.now(timezone.utc).isoformat())
    cmap=component_map(fleet); gids=graph_ids(graph)

    if train not in TRAIN_TYPES: reasons.append("unknown_train_type")
    if intent.get("fleetRegistryVersion")!=fleet.get("registryVersion"):
        reasons.append("fleet_registry_version_mismatch")
    if intent.get("releaseRegistryVersion")!=releases.get("registryVersion"):
        reasons.append("release_registry_version_mismatch")
    if not intent.get("candidateId"): reasons.append("candidate_id_missing")
    if intent.get("p29CertificateStatus")!="pass": reasons.append("p29_certificate_not_pass")
    if intent.get("p30PromotionStatus")!="pass": reasons.append("p30_promotion_gate_not_pass")

    for comp in sorted(components):
        if comp not in cmap:
            reasons.append("unknown_component:"+comp)
            continue
        if cmap[comp].get("governance")!="governed":
            reasons.append("component_not_governed:"+comp)
        if comp not in gids:
            reasons.append("dependency_graph_missing_component:"+comp)

    if train in STATEFUL:
        if fleet.get("releaseEpoch",{}).get("state")!="stable":
            reasons.append("shared_epoch_not_stable")
        if float(fleet.get("coverage",{}).get("dependencyGraphCoveragePct",0))<100:
            reasons.append("fleet_dependency_coverage_incomplete")

    for block in fleet.get("observedDrift",[]):
        severity=block.get("severity","")
        if block.get("id")=="supabase-main-branch-action-failed":
            if intent.get("integrationEnvironmentKind")=="supabase_branch":
                reasons.append("observed_block:"+block["id"])
            continue
        if scopes_conflict(scopes,block.get("scopes",[])):
            reasons.append("observed_block:"+block["id"])
        elif severity=="blocks_component_and_shared_release" and train in STATEFUL:
            reasons.append("shared_block:"+block["id"])

    unresolved={x.get("id") for x in fleet.get("governanceUnresolvedResources",[])}
    for resource in sorted(resources & unresolved):
        reasons.append("unresolved_governance:"+resource)

    active,expired=active_leases(lockdoc,now)
    for lease in active:
        if lease.get("type")=="incident":
            if scopes_conflict(scopes,lease.get("scopes",[])) or "platform_global" in lease.get("scopes",[]):
                reasons.append("incident_lease_conflict:"+str(lease.get("id")))
        elif scopes_conflict(scopes,lease.get("scopes",[])):
            reasons.append("lease_conflict:"+str(lease.get("id")))

    if intent.get("targetStage")=="production":
        approval=intent.get("manualProductionApproval") or {}
        if approval.get("approved") is not True:
            reasons.append("manual_production_approval_required")
        if not approval.get("approvalRef"):
            reasons.append("production_approval_reference_required")

    if releases.get("publishedOperationsVersion")!="P31.0":
        warnings.append("published_operations_manifest_lags_control_plane")

    return {
      "schemaVersion":2,"phase":"P31",
      "trainId":intent.get("trainId"),"candidateId":intent.get("candidateId"),
      "trainType":train,"targetStage":intent.get("targetStage"),
      "decision":"allow" if not reasons else "block",
      "reasons":sorted(set(reasons)),"warnings":sorted(set(warnings)),
      "activeLeases":[x.get("id") for x in active],
      "expiredLeases":[x.get("id") for x in expired],
      "productionPromotionPerformed":False,
      "productionMutationPerformed":False
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--fleet",default="platform-p31-fleet-registry.json")
    ap.add_argument("--releases",default="platform-p31-release-registry.json")
    ap.add_argument("--graph",default="platform-p29-dependency-graph.json")
    ap.add_argument("--plan",default="platform-p31-control-plane-plan.json")
    sub=ap.add_subparsers(dest="cmd",required=True)

    s=sub.add_parser("status"); s.add_argument("--out")
    v=sub.add_parser("validate"); v.add_argument("--out")
    r=sub.add_parser("reconcile"); r.add_argument("observed"); r.add_argument("--out")
    c=sub.add_parser("can-release"); c.add_argument("intent"); c.add_argument("--leases"); c.add_argument("--out")

    args=ap.parse_args()
    fleet=load(args.fleet); releases=load(args.releases); graph=load(args.graph); plan=load(args.plan)

    if args.cmd=="status":
        out=status(fleet,releases,graph); dump(out,args.out)
    elif args.cmd=="validate":
        out=validate(fleet,releases,graph,plan); dump(out,args.out)
        if out["status"]!="pass": raise SystemExit(1)
    elif args.cmd=="reconcile":
        out=reconcile(fleet,load(args.observed)); dump(out,args.out)
    else:
        locks=load(args.leases) if args.leases else None
        out=can_release(fleet,releases,graph,load(args.intent),locks); dump(out,args.out)
        if out["decision"]!="allow": raise SystemExit(1)

if __name__=="__main__": main()
