#!/usr/bin/env python3
import argparse, hashlib, json
from datetime import datetime, timedelta, timezone
from pathlib import Path

EPOCH_FIELDS=(
    "migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
    "edgeInventorySha256","edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256",
    "cronJobs","cronInventorySha256"
)

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dt(value):
    d=datetime.fromisoformat(value.replace("Z","+00:00"))
    if d.tzinfo is None:
        d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)

def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def healthy_sample(row):
    return row.get("status") in (None,"success") and (row.get("healthy") is True or row.get("passed") is True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("samples")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--out",default="p41-burnin-epoch-evaluation.json")
    ap.add_argument("--require-certifiable",action="store_true")
    ap.add_argument("--require-invalidated",action="store_true")
    args=ap.parse_args()

    p25=load(args.p25)
    obs=load(args.observation)
    samples=load(args.samples)
    freeze=p25.get("currentEpochFreezeEvidence") or obs.get("frozenEpoch") or {}
    current=obs.get("currentEpoch") or obs
    generation=int(p25.get("generation",obs.get("generation",0)))
    observed=dt(obs["observedAt"])
    activated=dt(p25.get("activatedAt") or obs.get("activatedAt"))
    minimum=dt(p25.get("minimumCompleteAfter") or obs.get("minimumCompleteAfter"))
    changed=[key for key in EPOCH_FIELDS if current.get(key)!=freeze.get(key)]

    health_errors=[]
    exact={"projectStatus":"ACTIVE_HEALTHY","p18Integrity":"clean","p20SchemaDrift":False,
           "p21Readiness":"pass","p22Maintenance":"pass"}
    health_view={**obs,**current}
    for key,value in exact.items():
        if health_view.get(key)!=value:
            health_errors.append("bad_"+key)
    if current.get("edgeFunctionsAllActive") is False:
        health_errors.append("edge_inventory_not_all_active")
    if current.get("cronFailures24h") not in (None,0):
        health_errors.append("cron_failures_present")
    if current.get("blockingReplicationSlots") not in (None,0):
        health_errors.append("blocking_replication_slots_present")

    result={
      "schemaVersion":1,"phase":"P41","generation":generation,"observedAt":obs["observedAt"],
      "activatedAt":iso(activated),"minimumCompleteAfter":iso(minimum),
      "changedEpochFields":changed,"healthErrors":sorted(set(health_errors)),
      "certificationReady":False,"productionMutationPerformed":False
    }

    if changed:
        latest_change=dt(obs.get("latestSharedChangeAt") or obs.get("firstPostActivationEpochChange",{}).get("at"))
        quiet=max(0,(observed-latest_change).total_seconds()/60)
        earliest=latest_change+timedelta(minutes=int(p25.get("refreezePolicy",{}).get("minimumQuietMinutes",60)))
        backup=obs.get("latestSuccessfulEncryptedBackup") or {}
        backup_time=dt(backup["createdAt"]) if backup.get("createdAt") else None
        backup_fresh=bool(
            backup.get("conclusion")=="success" and backup.get("verificationPassed") is True
            and backup.get("encrypted") is True and backup_time and backup_time>=latest_change
        )
        blockers=[f"generation_{generation}_invalidated_epoch_changed"]
        if quiet < int(p25.get("refreezePolicy",{}).get("minimumQuietMinutes",60)):
            blockers.append(f"quiet_window_open:{round(quiet,3)}/{int(p25.get('refreezePolicy',{}).get('minimumQuietMinutes',60))}")
        if not backup_fresh:
            blockers.append("backup_predates_latest_shared_change")
        blockers.extend(health_errors)
        result.update({
          "decision":"generation_invalidated_refreeze_pending",
          "state":"invalidated_epoch_changed",
          "currentGenerationEligible":False,
          "nextGeneration":generation+1,
          "firstEpochChangeAt":obs.get("firstPostActivationEpochChange",{}).get("at"),
          "candidateEpoch":current,
          "latestSharedChangeAt":iso(latest_change),
          "quietMinutesObserved":round(quiet,3),
          "earliestRefreezeAt":iso(earliest),
          "backupFreshForCandidate":backup_fresh,
          "blockers":sorted(set(blockers))
        })
    else:
        good=[]
        rejected=[]
        seen=set()
        for idx,row in enumerate(samples.get("samples") or []):
            stamp=row.get("timestamp") or row.get("checkedAt")
            if not stamp:
                rejected.append({"index":idx,"reason":"timestamp_missing"}); continue
            try: when=dt(stamp)
            except Exception:
                rejected.append({"index":idx,"reason":"timestamp_invalid"}); continue
            key=("run",str(row["runId"])) if row.get("runId") is not None else ("sample",stamp,str(row.get("artifactId","")))
            if key in seen:
                rejected.append({"index":idx,"reason":"duplicate_sample"}); continue
            seen.add(key)
            if row.get("generation")!=generation:
                rejected.append({"index":idx,"reason":"wrong_generation"}); continue
            if row.get("qualifiesForBurnIn") is not True:
                rejected.append({"index":idx,"reason":"not_qualifying"}); continue
            if not healthy_sample(row):
                rejected.append({"index":idx,"reason":"unsuccessful"}); continue
            if when<activated:
                rejected.append({"index":idx,"reason":"pre_activation"}); continue
            if when>observed:
                rejected.append({"index":idx,"reason":"after_observation_time"}); continue
            good.append((when,row))
        good.sort(key=lambda pair:pair[0])
        buckets={int((when-activated).total_seconds()//14400) for when,_ in good if 0 <= (when-activated).total_seconds() < 86400}
        required_samples=int(p25.get("generation5Sampling",{}).get("minimumSuccessfulSamples",12))
        required_buckets=int(p25.get("generation5Sampling",{}).get("minimumCoverageBuckets",6))
        missing=[i for i in range(required_buckets) if i not in buckets]
        terminal=[when for when,_ in good if when>=minimum]
        blockers=list(health_errors)
        if len(good)<required_samples: blockers.append(f"successful_samples:{len(good)}/{required_samples}")
        if missing: blockers.append("missing_coverage_buckets:"+",".join(map(str,missing)))
        if observed<minimum: blockers.append("minimum_24h_not_reached")
        if not terminal: blockers.append("terminal_sample_missing")
        result.update({
          "decision":"ready_for_certification" if not blockers else "evidence_accumulating",
          "state":"certifiable" if not blockers else "evidence_accumulating",
          "currentGenerationEligible":True,
          "nextGeneration":None,
          "successfulQualifyingSamples":len(good),
          "coverageBuckets":sorted(buckets),
          "missingCoverageBuckets":missing,
          "terminalSamplePresent":bool(terminal),
          "terminalSampleAt":iso(terminal[-1]) if terminal else None,
          "rejectedSamples":rejected,
          "blockers":sorted(set(blockers)),
          "certificationReady":not blockers
        })

    result["evaluationId"]=digest({k:v for k,v in result.items() if k!="evaluationId"})
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))

    if args.require_certifiable and not result["certificationReady"]:
        raise SystemExit(1)
    if args.require_invalidated and result["decision"]!="generation_invalidated_refreeze_pending":
        raise SystemExit(1)

if __name__=="__main__":
    main()
