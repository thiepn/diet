#!/usr/bin/env python3
import argparse, hashlib, json
from datetime import datetime, timezone, timedelta
from pathlib import Path

EPOCH_KEYS=(
  "migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
  "edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256",
  "cronJobs","activeCronJobs"
)

def load(path): return json.loads(Path(path).read_text(encoding="utf-8"))
def dt(v):
    d=datetime.fromisoformat(v.replace("Z","+00:00"))
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("backup")
    ap.add_argument("--p42",default="platform-p42-generation6-refreeze-plan.json")
    ap.add_argument("--p41",default="platform-p41-generation5-epoch-watch.json")
    ap.add_argument("--out",default="p43-final-revalidation.json")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()

    p42=load(a.p42); p41=load(a.p41); obs=load(a.observation); backup=load(a.backup)
    candidate=p42.get("candidateEpoch") or {}
    errors=[]

    if p42.get("state")!="refreeze_pending": errors.append("p42_not_refreeze_pending")
    if p42.get("generation")!=6: errors.append("generation6_candidate_missing")
    if p41.get("state")!="generation5_invalidated_epoch_changed": errors.append("generation5_not_authoritatively_invalidated")
    if p41.get("nextGeneration",{}).get("generation")!=6: errors.append("p41_does_not_handoff_generation6")

    mismatches=[]
    for k in EPOCH_KEYS:
        if obs.get(k)!=candidate.get(k):
            mismatches.append(k)
    errors.extend("candidate_epoch_changed:"+k for k in mismatches)

    exact={"projectStatus":"ACTIVE_HEALTHY","p18Integrity":"clean","p20SchemaDrift":False,
           "p21Readiness":"pass","p22Maintenance":"pass"}
    for k,v in exact.items():
        if obs.get(k)!=v: errors.append("bad_"+k)
    if obs.get("edgeFunctionsAllActive") is not True: errors.append("edge_inventory_not_all_active")
    if int(obs.get("cronJobs",-1))!=int(obs.get("activeCronJobs",-2)): errors.append("inactive_cron_jobs")
    if int(obs.get("cronFailures24h",-1))!=0: errors.append("cron_failures_present")
    if int(obs.get("blockingReplicationSlots",-1))!=0: errors.append("blocking_replication_slots_present")
    if obs.get("securityAdvisorsReviewed") is not True: errors.append("security_advisors_not_reviewed")
    if obs.get("performanceAdvisorsReviewed") is not True: errors.append("performance_advisors_not_reviewed")

    observed=dt(obs["observedAt"])
    latest=dt(candidate["latestSharedChangeAt"])
    required=float(p42.get("quietWindow",{}).get("minimumMinutes",60))
    quiet=max(0,(observed-latest).total_seconds()/60)
    if quiet<required: errors.append(f"quiet_window_open:{quiet:.2f}/{required:.0f}")

    bt=None
    try: bt=dt(backup["artifactCreatedAt"])
    except Exception: errors.append("backup_timestamp_invalid")
    backup_valid=(backup.get("conclusion")=="success" and backup.get("verificationPassed") is True
                  and backup.get("encrypted") is True and backup.get("artifactAvailable") is True
                  and backup.get("artifactExpired") is not True and bool(backup.get("evidenceRef")))
    backup_fresh=bool(backup_valid and bt and bt>=latest)
    if not backup_valid: errors.append("backup_evidence_invalid")
    elif not backup_fresh: errors.append("backup_predates_latest_shared_change")

    ready=not errors
    frozen={
      "frozenAt":obs.get("observedAt"),
      "projectStatus":obs.get("projectStatus"),
      "migrationVersion":obs.get("migrationVersion"),
      "migrationName":obs.get("migrationName"),
      "migrationHead":obs.get("migrationHead"),
      "semanticSchemaSha256":obs.get("semanticSchemaSha256"),
      "edgeFunctionCount":obs.get("edgeFunctionCount"),
      "edgeFunctionsAllActive":obs.get("edgeFunctionsAllActive"),
      "gomokuRoomVersion":obs.get("gomokuRoomVersion"),
      "gomokuRoomSha256":obs.get("gomokuRoomSha256"),
      "cronJobs":obs.get("cronJobs"),
      "activeCronJobs":obs.get("activeCronJobs"),
      "cronFailures24h":obs.get("cronFailures24h"),
      "blockingReplicationSlots":obs.get("blockingReplicationSlots"),
      "p18Integrity":obs.get("p18Integrity"),
      "p20SchemaDrift":obs.get("p20SchemaDrift"),
      "p21Readiness":obs.get("p21Readiness"),
      "p22Maintenance":obs.get("p22Maintenance"),
      "securityAdvisorReviewed":obs.get("securityAdvisorsReviewed"),
      "performanceAdvisorReviewed":obs.get("performanceAdvisorsReviewed"),
      "postFinalChangeEncryptedBackupVerified":backup_fresh,
      "backupEvidenceRef":backup.get("evidenceRef") if backup_fresh else None,
      "quietMinutesAtFreeze":round(quiet,2)
    }

    out={
      "schemaVersion":1,"phase":"P43","generation":6,
      "candidateRevision":p42.get("candidateRevision"),
      "observedAt":obs.get("observedAt"),
      "decision":"ready_to_activate_generation6" if ready else "blocked",
      "eligibleToActivate":ready,
      "candidateEpochStable":not mismatches,
      "quietMinutesObserved":round(quiet,2),
      "minimumQuietMinutes":required,
      "backupValid":backup_valid,"backupFresh":backup_fresh,
      "backupRunId":backup.get("runId"),
      "minimumCompleteAfter":z(observed+timedelta(hours=24)) if ready else None,
      "frozenEpoch":frozen if ready else None,
      "errors":sorted(set(errors)),
      "productionMutationPerformed":False
    }
    out["decisionId"]=hid({k:v for k,v in out.items() if k!="decisionId"})
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_ready and not ready: raise SystemExit(1)

if __name__=="__main__": main()
