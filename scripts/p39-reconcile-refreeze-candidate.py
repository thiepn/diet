#!/usr/bin/env python3
import argparse, copy, hashlib, json
from datetime import datetime, timezone, timedelta
from pathlib import Path

EPOCH_KEYS=(
    "migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
    "edgeInventorySha256","edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256",
    "cronJobs","activeCronJobs","cronInventorySha256"
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
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--out-dir",default="p39-reconcile-preview")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()

    p25=load(a.p25)
    obs=load(a.observation)
    backup=load(a.backup)
    errors=[]

    if p25.get("state")!="refreeze_pending":
        errors.append("p25_not_refreeze_pending")
    if p25.get("currentGenerationEligible") is not False:
        errors.append("current_generation_still_eligible")
    if p25.get("nextGeneration")!=5:
        errors.append("next_generation_not_5")

    pending=p25.get("pendingGeneration5") or {}
    old_candidate=pending.get("candidateEpoch") or {}
    if pending.get("generation")!=5:
        errors.append("pending_generation5_missing")

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

    required_obs=(
      "observedAt","migrationVersion","migrationName","migrationHead",
      "semanticSchemaSha256","edgeInventorySha256","edgeFunctionCount",
      "gomokuRoomVersion","gomokuRoomSha256","latestSharedChangeAt",
      "latestSharedChangeComponent","latestSharedChangeVersion","latestSharedChangeSha256",
      "cronJobs","activeCronJobs","cronInventorySha256"
    )
    for key in required_obs:
        if obs.get(key) in (None,""):
            errors.append("observation_missing:"+key)

    candidate={key:obs.get(key) for key in (
      "observedAt","migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
      "gomokuRoomVersion","gomokuRoomSha256","gomokuRoomUpdatedAt",
      "edgeInventorySha256","edgeFunctionCount","edgeFunctionsAllActive",
      "latestSharedChangeAt","latestSharedChangeComponent","latestSharedChangeVersion",
      "latestSharedChangeSha256","cronJobs","activeCronJobs","cronInventorySha256",
      "cronRuns24h","cronFailures24h","blockingReplicationSlots","p18Integrity",
      "p20SchemaDrift","p21Readiness","p22Maintenance"
    )}

    identity_changed=any(old_candidate.get(k)!=candidate.get(k) for k in EPOCH_KEYS)
    latest_change=dt(obs["latestSharedChangeAt"]) if obs.get("latestSharedChangeAt") else dt(obs["observedAt"])
    observed=dt(obs["observedAt"])
    quiet=max(0,(observed-latest_change).total_seconds()/60)
    required_quiet=float(p25.get("refreezePolicy",{}).get("minimumQuietMinutes",60))
    earliest=z(latest_change+timedelta(minutes=required_quiet))

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
      and backup_time is not None
    )
    backup_fresh=bool(backup_valid and backup_time>=latest_change)

    blockers=list(errors)
    if quiet<required_quiet:
        blockers.append(f"quiet_window_open:{quiet:.2f}/{required_quiet:.0f}")
    if not backup_valid:
        blockers.append("backup_evidence_invalid")
    elif not backup_fresh:
        blockers.append("backup_predates_latest_shared_change")

    healthy=not errors
    ready=healthy and quiet>=required_quiet and backup_fresh

    outdir=Path(a.out_dir)
    outdir.mkdir(parents=True,exist_ok=True)

    preview=copy.deepcopy(p25)
    preview["latestObservedEpoch"]=candidate
    preview.setdefault("refreezePolicy",{})["quietClockStartsAfterLatestObservedSharedChange"]=obs.get("latestSharedChangeAt")
    preview["refreezePolicy"]["earliestRefreezeAt"]=earliest
    preview["refreezePolicy"]["minimumQuietMinutes"]=required_quiet
    pp=preview.setdefault("pendingGeneration5",{})
    previous_summary={
      "candidateObservedAt":pp.get("candidateObservedAt"),
      "migrationHead":(pp.get("candidateEpoch") or {}).get("migrationHead"),
      "gomokuRoomVersion":(pp.get("candidateEpoch") or {}).get("gomokuRoomVersion"),
      "latestSharedChangeAt":(pp.get("candidateEpoch") or {}).get("latestSharedChangeAt"),
      "edgeInventorySha256":(pp.get("candidateEpoch") or {}).get("edgeInventorySha256")
    }
    revision=int(pp.get("candidateRevision",1))
    if identity_changed:
        revision+=1
    pp.update({
      "generation":5,
      "state":"ready_to_activate" if ready else (
        "waiting_fresh_backup" if quiet>=required_quiet and not backup_fresh
        else "waiting_quiet_window_and_fresh_backup" if not backup_fresh
        else "waiting_quiet_window"
      ),
      "candidateRevision":revision,
      "candidateObservedAt":obs.get("observedAt"),
      "candidateEpoch":candidate,
      "minimumQuietMinutes":required_quiet,
      "migrationQuietMinutesObserved":round(max(0,(observed-dt(obs["migrationChangedAt"])).total_seconds()/60),2)
          if obs.get("migrationChangedAt") else None,
      "edgeQuietMinutesObserved":round(quiet,2),
      "earliestRefreezeAt":earliest,
      "postFinalChangeEncryptedBackupVerified":backup_fresh,
      "backupEvidenceRef":backup.get("evidenceRef") if backup_fresh else None,
      "latestSuccessfulBackup":{
        "runId":backup.get("runId"),"createdAt":backup.get("createdAt"),
        "artifactId":backup.get("artifactId"),"artifactDigest":backup.get("artifactDigest"),
        "freshForCandidate":backup_fresh
      },
      "eligibleToActivate":ready,
      "lastRecheckedAt":obs.get("observedAt"),
      "lastDecision":"ready_to_activate" if ready else "blocked",
      "lastBlockers":sorted(set(blockers))
    })
    if identity_changed:
        pp["previousCandidate"]=previous_summary
        pp["candidateRebasedAt"]=obs.get("observedAt")
        pp["candidateRebaseReason"]="pre_activation_shared_epoch_changed"
    preview["completionState"]["invalidated"]=True

    receipt={
      "schemaVersion":1,
      "phase":"P39",
      "generation":5,
      "candidateRevision":revision,
      "candidateRebased":identity_changed,
      "observedAt":obs.get("observedAt"),
      "latestSharedChangeAt":obs.get("latestSharedChangeAt"),
      "quietMinutesObserved":round(quiet,2),
      "minimumQuietMinutes":required_quiet,
      "earliestRefreezeAt":earliest,
      "backupValid":backup_valid,
      "backupFresh":backup_fresh,
      "backupRunId":backup.get("runId"),
      "decision":"ready_for_p37_refreeze" if ready else "blocked",
      "sourceFilesMutated":False,
      "productionMutationPerformed":False,
      "blockers":sorted(set(blockers)),
      "candidateEpochSha256":digest(candidate)
    }
    receipt["receiptId"]=digest({k:v for k,v in receipt.items() if k!="receiptId"})

    (outdir/"platform-p25-burn-in-plan.json").write_text(json.dumps(preview,indent=2)+"\n",encoding="utf-8")
    (outdir/"p39-refreeze-reconcile-receipt.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(receipt,separators=(",",":")))
    if a.require_ready and not ready:
        raise SystemExit(1)

if __name__=="__main__":
    main()
