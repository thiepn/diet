#!/usr/bin/env python3
import argparse, json
from datetime import datetime, timezone
from pathlib import Path

STATEFUL={"shared_standard","coordinated_breaking","platform_maintenance"}

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dump(value,path=None):
    body=json.dumps(value,indent=2)+"\n"
    if path:
        Path(path).write_text(body,encoding="utf-8")
    print(json.dumps(value,separators=(",",":")))

def parse_time(v):
    return datetime.fromisoformat(v.replace("Z","+00:00"))

def registry_status(fleet,releases):
    staged=releases.get("stagedPhases",[])
    next_phase=next((p for p in staged if p.get("state","").startswith("staged_pending_")),None)
    return {
      "schemaVersion":1,
      "phase":"P31",
      "fleetState":fleet["controlPlaneStatus"],
      "coordinationMode":"epoch_moving" if fleet["releaseEpoch"]["state"]!="stable" else "normal",
      "releaseEpochState":fleet["releaseEpoch"]["state"],
      "semanticSchemaSha256":fleet["releaseEpoch"]["semanticSchemaSha256"],
      "migrationHead":fleet["releaseEpoch"]["migrationHead"],
      "activeOperationsRelease":releases["activeOperationsRelease"],
      "activePhase":releases["activePhase"],
      "nextStagedPhase":next_phase,
      "observedBlocks":fleet.get("observedBlocks",[]),
      "unresolvedGovernance":fleet.get("governanceUnresolved",[]),
      "activeTrainCount":len(releases.get("trains",{}).get("active",[])),
      "promotableTrainCount":len(releases.get("trains",{}).get("promotable",[]))
    }

def reconcile(fleet,observed):
    expected=fleet["releaseEpoch"]
    stale=[]
    checks={
      "semanticSchemaSha256":(expected.get("semanticSchemaSha256"),observed.get("semanticSchemaSha256")),
      "migrationHead":(expected.get("migrationHead"),observed.get("migrationHead")),
      "cronJobs":(expected.get("cronJobs"),observed.get("cronJobs")),
      "gomokuRoomVersion":(
        ((expected.get("edge") or {}).get("gomokuRoom") or {}).get("version"),
        observed.get("gomokuRoomVersion")
      ),
      "gomokuRoomSha256":(
        ((expected.get("edge") or {}).get("gomokuRoom") or {}).get("sha256"),
        observed.get("gomokuRoomSha256")
      )
    }
    for k,(a,b) in checks.items():
        if a is not None and b is not None and a!=b:
            stale.append(k)
    return {
      "schemaVersion":1,"phase":"P31",
      "registryVersion":fleet["registryVersion"],
      "status":"stale" if stale else "match",
      "stale":bool(stale),"staleFields":stale,
      "expected":{k:v[0] for k,v in checks.items()},
      "observed":{k:v[1] for k,v in checks.items()}
    }

def active_locks(lockdoc,now):
    active=[];expired=[]
    for lock in (lockdoc or {}).get("locks",[]):
        if lock.get("state","active")!="active":
            continue
        expires=lock.get("expiresAt")
        if not expires:
            active.append(lock);continue
        if parse_time(expires)>now:
            active.append(lock)
        else:
            expired.append(lock)
    return active,expired

def scopes_conflict(intent_scopes,lock_scopes):
    intent=set(intent_scopes);locks=set(lock_scopes)
    if "platform_global" in locks or "platform_global" in intent:
        return True
    return bool(intent & locks)

def can_release(fleet,releases,intent,lockdoc=None):
    reasons=[]
    warnings=[]
    train_type=intent.get("trainType")
    scopes=set(intent.get("scopes") or [])
    components=set(intent.get("components") or [])
    resources=set(intent.get("resources") or [])
    now=parse_time(intent.get("now") or datetime.now(timezone.utc).isoformat())

    if train_type not in {"app_fast","shared_standard","coordinated_breaking","platform_maintenance"}:
        reasons.append("unknown_train_type")

    if intent.get("p29CertificateStatus")!="pass":
        reasons.append("p29_certificate_not_pass")
    if intent.get("p30PromotionStatus")!="pass":
        reasons.append("p30_promotion_gate_not_pass")

    if train_type in STATEFUL:
        if fleet["releaseEpoch"].get("state")!="stable":
            reasons.append("release_epoch_not_stable")
        if fleet["environmentSummary"]["statefulPreview"].get("status")!="healthy":
            reasons.append("stateful_promotion_environment_not_healthy")

    for block in fleet.get("observedBlocks",[]):
        block_scopes=block.get("scopes",[])
        if scopes_conflict(scopes,block_scopes):
            reasons.append("observed_block:"+block["id"])

    unresolved={x["id"] for x in fleet.get("governanceUnresolved",[])}
    hit=sorted(resources & unresolved)
    if hit:
        reasons.append("unresolved_governance:"+",".join(hit))

    active,expired=active_locks(lockdoc,now)
    conflicts=[]
    for lock in active:
        if scopes_conflict(scopes,lock.get("scopes",[])):
            conflicts.append(lock.get("id","unnamed"))
    if conflicts:
        reasons.append("lock_conflict:"+",".join(sorted(conflicts)))
    if expired:
        warnings.append("expired_locks_present:"+",".join(sorted(x.get("id","unnamed") for x in expired)))

    if intent.get("targetStage")=="production" and intent.get("manualProductionApproval") is not True:
        reasons.append("manual_production_approval_required")

    if releases.get("activePhase",{}).get("state")=="restart_required":
        warnings.append("active_phase_requires_restart")

    # App-fast work can coexist with a moving shared epoch only when its scopes
    # do not intersect any observed block. Stateful trains cannot.
    allowed=not reasons
    return {
      "schemaVersion":1,"phase":"P31",
      "decision":"allow" if allowed else "block",
      "trainId":intent.get("trainId"),
      "trainType":train_type,
      "components":sorted(components),
      "scopes":sorted(scopes),
      "reasons":reasons,
      "warnings":warnings,
      "activeLocks":[x.get("id") for x in active],
      "expiredLocks":[x.get("id") for x in expired]
    }

def validate(fleet,releases,graph):
    errors=[]
    fleet_ids={x["id"] for x in fleet.get("components",[])}
    graph_ids={x["id"] for x in graph.get("nodes",[])}
    if fleet_ids!=graph_ids:
        errors.append("fleet_graph_node_mismatch")
    if len(fleet_ids)!=len(fleet.get("components",[])):
        errors.append("duplicate_fleet_component")
    phase_ids=[x["id"] for x in releases.get("stagedPhases",[])]
    if phase_ids!=["P26","P27","P28","P29","P30","P31"]:
        errors.append("staged_phase_chain_invalid")
    if releases.get("activeOperationsRelease")!="P25.0":
        errors.append("active_operations_release_invalid")
    if fleet.get("releaseEpoch",{}).get("sharedPromotionsBlocked") is not True:
        errors.append("moving_epoch_must_block_shared_promotions")
    if not any(x.get("id")=="shared-epoch-moving" for x in fleet.get("observedBlocks",[])):
        errors.append("missing_shared_epoch_block")
    return {
      "schemaVersion":1,"phase":"P31",
      "status":"pass" if not errors else "fail",
      "errors":errors,
      "fleetComponents":len(fleet_ids),
      "graphComponents":len(graph_ids)
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--fleet",default="platform-p31-fleet-registry.json")
    ap.add_argument("--releases",default="platform-p31-release-registry.json")
    sub=ap.add_subparsers(dest="cmd",required=True)

    p=sub.add_parser("status");p.add_argument("--out")
    p=sub.add_parser("reconcile");p.add_argument("observed");p.add_argument("--out")
    p=sub.add_parser("can-release");p.add_argument("intent");p.add_argument("--locks");p.add_argument("--out")
    p=sub.add_parser("validate");p.add_argument("--graph",default="platform-p29-dependency-graph.json");p.add_argument("--out")

    args=ap.parse_args()
    fleet=load(args.fleet);releases=load(args.releases)
    if args.cmd=="status":
        dump(registry_status(fleet,releases),args.out)
    elif args.cmd=="reconcile":
        dump(reconcile(fleet,load(args.observed)),args.out)
    elif args.cmd=="can-release":
        locks=load(args.locks) if args.locks else {"locks":[]}
        out=can_release(fleet,releases,load(args.intent),locks)
        dump(out,args.out)
        if out["decision"]!="allow":
            raise SystemExit(1)
    else:
        out=validate(fleet,releases,load(args.graph))
        dump(out,args.out)
        if out["status"]!="pass":
            raise SystemExit(1)

if __name__=="__main__":
    main()
