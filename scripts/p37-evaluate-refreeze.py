#!/usr/bin/env python3
import argparse,hashlib,json
from datetime import datetime,timezone,timedelta
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def dt(v):
    d=datetime.fromisoformat(v.replace("Z","+00:00"))
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def z(d): return d.isoformat().replace("+00:00","Z")
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--out",default="p37-refreeze-decision.json")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()
    p25=load(a.p25); obs=load(a.observation); errors=[]
    pending=p25.get("pendingGeneration5") or {}
    candidate=pending.get("candidateEpoch") or {}

    if p25.get("state")!="refreeze_pending": errors.append("p25_not_refreeze_pending")
    if p25.get("currentGenerationEligible") is not False: errors.append("old_generation_still_eligible")
    if p25.get("nextGeneration")!=5 or pending.get("generation")!=5: errors.append("generation5_not_next_candidate")
    allowed_pending_states={
        "waiting_quiet_window",
        "waiting_quiet_window_and_fresh_backup",
        "waiting_fresh_backup",
        "ready_to_activate",
    }
    if pending.get("state") not in allowed_pending_states:
        errors.append("generation5_candidate_state_invalid")

    for key in ("migrationHead","semanticSchemaSha256","edgeInventorySha256","edgeFunctionCount",
                "gomokuRoomVersion","gomokuRoomSha256","cronJobs","cronInventorySha256"):
        if obs.get(key)!=candidate.get(key):
            errors.append("candidate_epoch_changed:"+key)

    exact={"projectStatus":"ACTIVE_HEALTHY","p18Integrity":"clean","p20SchemaDrift":False,
           "p21Readiness":"pass","p22Maintenance":"pass"}
    for k,v in exact.items():
        if obs.get(k)!=v: errors.append("bad_"+k)
    if obs.get("edgeFunctionsAllActive") is not True: errors.append("edge_inventory_not_all_active")
    if int(obs.get("activeCronJobs",-1))!=int(candidate.get("activeCronJobs",-2)): errors.append("active_cron_inventory_mismatch")
    if int(obs.get("cronFailures24h",-1))!=0: errors.append("cron_failures_present")
    if int(obs.get("blockingReplicationSlots",-1))!=0: errors.append("blocking_replication_slots_present")

    observed=dt(obs["observedAt"])
    latest_change=dt(p25["refreezePolicy"]["quietClockStartsAfterLatestObservedSharedChange"])
    quiet=(observed-latest_change).total_seconds()/60
    required=float(p25["refreezePolicy"]["minimumQuietMinutes"])
    if quiet < required: errors.append(f"quiet_window_open:{quiet:.2f}/{required:.0f}")

    if obs.get("postFinalSharedChangeBackupVerified") is not True:
        errors.append("post_final_change_backup_not_verified")
    if not obs.get("backupEvidenceRef"):
        errors.append("backup_evidence_ref_missing")
    for flag in ("crossAppSmokePassed","authHealthy","realtimeHealthy","postgrestHealthy","storageHealthy",
                 "securityAdvisorsReviewed","performanceAdvisorsReviewed"):
        if obs.get(flag) is not True: errors.append("required_"+flag+"_false")

    frozen={
      "frozenAt":obs["observedAt"],"projectStatus":obs.get("projectStatus"),
      "migrationVersion":obs.get("migrationVersion"),"migrationName":obs.get("migrationName"),
      "migrationHead":obs.get("migrationHead"),"semanticSchemaSha256":obs.get("semanticSchemaSha256"),
      "edgeInventorySha256":obs.get("edgeInventorySha256"),"edgeFunctionCount":obs.get("edgeFunctionCount"),
      "edgeFunctionsAllActive":obs.get("edgeFunctionsAllActive"),
      "gomokuRoomVersion":obs.get("gomokuRoomVersion"),"gomokuRoomSha256":obs.get("gomokuRoomSha256"),
      "cronJobs":obs.get("cronJobs"),"activeCronJobs":obs.get("activeCronJobs"),
      "cronInventorySha256":obs.get("cronInventorySha256"),"cronFailures24h":obs.get("cronFailures24h"),
      "blockingReplicationSlots":obs.get("blockingReplicationSlots"),
      "p18Integrity":obs.get("p18Integrity"),"p20SchemaDrift":obs.get("p20SchemaDrift"),
      "p21Readiness":obs.get("p21Readiness"),"p22Maintenance":obs.get("p22Maintenance"),
      "securityAdvisorReviewed":obs.get("securityAdvisorsReviewed"),
      "performanceAdvisorReviewed":obs.get("performanceAdvisorsReviewed"),
      "postFinalChangeEncryptedBackupVerified":obs.get("postFinalSharedChangeBackupVerified"),
      "backupEvidenceRef":obs.get("backupEvidenceRef"),
      "quietMinutesAtFreeze":round(quiet,2)
    }
    decision={
      "schemaVersion":2,"phase":"P37",
      "decision":"ready_to_activate_generation5" if not errors else "blocked",
      "generation":5,"observedAt":obs.get("observedAt"),
      "quietMinutesObserved":round(quiet,2),"minimumQuietMinutes":required,
      "minimumCompleteAfter":z(observed+timedelta(hours=24)) if not errors else None,
      "frozenEpoch":frozen if not errors else None,
      "errors":sorted(set(errors))
    }
    decision["decisionId"]=hid(decision)
    Path(a.out).write_text(json.dumps(decision,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(decision,separators=(",",":")))
    if a.require_ready and errors: raise SystemExit(1)

if __name__=="__main__": main()
