#!/usr/bin/env python3
import argparse, hashlib, json
from datetime import datetime, timezone, timedelta
from pathlib import Path

EPOCH_KEYS=(
    "migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
    "edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256",
    "cronJobs","activeCronJobs"
)

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dt(value):
    d=datetime.fromisoformat(value.replace("Z","+00:00"))
    if d.tzinfo is None:
        d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)

def z(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("backup")
    ap.add_argument("--plan",default="platform-p42-generation6-refreeze-plan.json")
    ap.add_argument("--out",default="p42-generation6-readiness.json")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()

    plan=load(a.plan)
    obs=load(a.observation)
    backup=load(a.backup)
    errors=[]
    candidate=plan.get("candidateEpoch") or {}

    if plan.get("state")!="refreeze_pending":
        errors.append("p42_not_refreeze_pending")
    if plan.get("generation")!=6:
        errors.append("generation6_missing")
    if plan.get("predecessor",{}).get("state")!="invalidated_epoch_changed":
        errors.append("generation5_not_invalidated")

    exact={
      "projectStatus":"ACTIVE_HEALTHY",
      "p18Integrity":"clean",
      "p20SchemaDrift":False,
      "p21Readiness":"pass",
      "p22Maintenance":"pass"
    }
    for key,value in exact.items():
        if obs.get(key)!=value:
            errors.append("bad_"+key)
    if obs.get("edgeFunctionsAllActive") is not True:
        errors.append("edge_inventory_not_all_active")
    if int(obs.get("cronJobs",-1))!=int(obs.get("activeCronJobs",-2)):
        errors.append("inactive_cron_jobs")
    if int(obs.get("cronFailures24h",-1))!=0:
        errors.append("cron_failures_present")
    if int(obs.get("blockingReplicationSlots",-1))!=0:
        errors.append("blocking_replication_slots_present")

    epoch_mismatches=[]
    for key in EPOCH_KEYS:
        if obs.get(key)!=candidate.get(key):
            epoch_mismatches.append(key)
    if epoch_mismatches:
        errors.extend("candidate_epoch_changed:"+k for k in epoch_mismatches)

    observed=dt(obs["observedAt"])
    latest_change=dt(obs["latestSharedChangeAt"])
    required=float(plan.get("quietWindow",{}).get("minimumMinutes",60))
    quiet=max(0,(observed-latest_change).total_seconds()/60)
    earliest=z(latest_change+timedelta(minutes=required))

    backup_time=None
    try:
        backup_time=dt(backup.get("createdAt")) if backup.get("createdAt") else None
    except Exception:
        errors.append("backup_timestamp_invalid")
    backup_valid=(
      backup.get("conclusion")=="success"
      and backup.get("verificationPassed") is True
      and backup.get("encrypted") is True
      and backup.get("artifactAvailable") is True
      and backup.get("artifactExpired") is not True
      and backup_time is not None
    )
    backup_fresh=bool(backup_valid and backup_time>=latest_change)

    blockers=list(errors)
    if quiet<required:
        blockers.append(f"quiet_window_open:{quiet:.2f}/{required:.0f}")
    if not backup_valid:
        blockers.append("backup_evidence_invalid")
    elif not backup_fresh:
        blockers.append("backup_predates_latest_shared_change")

    ready=not blockers
    out={
      "schemaVersion":1,
      "phase":"P42",
      "generation":6,
      "candidateRevision":plan.get("candidateRevision"),
      "observedAt":obs.get("observedAt"),
      "candidateEpochStable":not epoch_mismatches,
      "quietMinutesObserved":round(quiet,2),
      "minimumQuietMinutes":required,
      "earliestEligibleAt":earliest,
      "backupValid":backup_valid,
      "backupFresh":backup_fresh,
      "backupRunId":backup.get("runId"),
      "decision":"ready_to_activate_generation6" if ready else "blocked",
      "eligibleToActivate":ready,
      "blockers":sorted(set(blockers)),
      "productionMutationPerformed":False,
      "generation6Activated":False
    }
    out["candidateEpochSha256"]=digest(candidate)
    out["readinessId"]=digest({k:v for k,v in out.items() if k!="readinessId"})
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_ready and not ready:
        raise SystemExit(1)

if __name__=="__main__":
    main()
