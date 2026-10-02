#!/usr/bin/env python3
import argparse,json,math
from datetime import datetime,timedelta
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dt(value):
    return datetime.fromisoformat(value.replace("Z","+00:00"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("samples")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--freeze",default="platform-p36-stable-epoch-freeze.json")
    ap.add_argument("--out",default="p37-burnin-certification.json")
    args=ap.parse_args()

    obs=load(args.observation)
    samples=load(args.samples)
    p25=load(args.p25)
    freeze=load(args.freeze)
    errors=[]

    start=dt(p25["activatedAt"])
    minimum=dt(p25["minimumCompleteAfter"])
    observed=dt(obs["observedAt"])
    frozen=freeze["frozenEpoch"]

    expected={
      "migrationVersion":frozen["migrationVersion"],
      "migrationName":frozen["migrationName"],
      "semanticSchemaSha256":frozen["semanticSchemaSha256"],
      "gomokuRoomVersion":frozen["gomokuRoomVersion"],
      "gomokuRoomSha256":frozen["gomokuRoomSha256"],
      "cronJobs":frozen["cronJobs"]
    }
    changed=[]
    for k,v in expected.items():
        if obs.get(k)!=v:
            changed.append(k)
    if changed:
        errors.append("frozen_epoch_changed:"+",".join(changed))

    required_exact={
      "projectStatus":"ACTIVE_HEALTHY",
      "p18Integrity":"clean",
      "p20SchemaDrift":False,
      "p21Readiness":"pass",
      "p22Maintenance":"pass"
    }
    for k,v in required_exact.items():
        if obs.get(k)!=v:
            errors.append("bad_"+k)

    if int(obs.get("activeCronJobs",-1))!=int(frozen["cronJobs"]):
        errors.append("active_cron_inventory_mismatch")
    if int(obs.get("cronFailures24h",0))!=0:
        errors.append("cron_failures_present")
    if int(obs.get("blockingReplicationSlots",0))!=0:
        errors.append("blocking_replication_slots_present")
    if observed < minimum:
        errors.append("minimum_24h_not_reached")

    if obs.get("encryptedBackupConclusion")!="success":
        errors.append("encrypted_backup_not_successful")
    if obs.get("encryptedBackupAfterFinalSharedChange") is not True:
        errors.append("backup_not_after_final_shared_change")

    for flag in (
      "crossAppSmokePassed","edgeInventoryAllActive","authHealthy","realtimeHealthy",
      "postgrestHealthy","storageHealthy","securityAdvisorsReviewed",
      "performanceAdvisorsReviewed"
    ):
        if obs.get(flag) is not True:
            errors.append("required_"+flag+"_false")

    if int(obs.get("postgres1711HazardCount",-1))!=0:
        errors.append("postgres1711_hazards_present")

    good=[]
    for row in samples.get("samples") or []:
        try:
            t=dt(row["timestamp"])
        except Exception:
            continue
        if t>=start and row.get("status")=="success" and row.get("healthy") is True:
            good.append((t,row))
    good.sort(key=lambda x:x[0])

    minimum_samples=int(p25["burnInRequirements"]["minimumHourlyPublicSamples"])
    if len(good)<minimum_samples:
        errors.append("insufficient_successful_samples")

    bucket_hours=4
    required_buckets=6
    bucket_ids=set()
    for t,_ in good:
        elapsed=(t-start).total_seconds()/3600
        if 0<=elapsed<24:
            bucket_ids.add(int(elapsed//bucket_hours))
    missing=[i for i in range(required_buckets) if i not in bucket_ids]
    if missing:
        errors.append("missing_4h_coverage_buckets:"+",".join(map(str,missing)))

    terminal=[x for x in good if x[0]>=minimum]
    if not terminal:
        errors.append("no_terminal_sample_at_or_after_24h")

    cert={
      "schemaVersion":1,
      "phase":"P37",
      "certificateType":"p25_generation2_burnin",
      "decision":"certified" if not errors else "blocked",
      "generation":p25.get("generation"),
      "windowStart":p25["activatedAt"],
      "minimumCompleteAfter":p25["minimumCompleteAfter"],
      "certifiedAt":obs["observedAt"] if not errors else None,
      "frozenEpochMatches":not changed,
      "successfulSamples":len(good),
      "coverageBucketHours":bucket_hours,
      "coveredBuckets":sorted(bucket_ids),
      "requiredBuckets":list(range(required_buckets)),
      "terminalSampleAt":terminal[-1][0].isoformat().replace("+00:00","Z") if terminal else None,
      "errors":errors
    }
    Path(args.out).write_text(json.dumps(cert,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(cert,separators=(",",":")))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
