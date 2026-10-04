#!/usr/bin/env python3
import argparse,hashlib,json
from datetime import datetime,timezone
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def dt(v):
    d=datetime.fromisoformat(v.replace("Z","+00:00"))
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation"); ap.add_argument("samples")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--out",default="p37-burnin-certificate.json")
    ap.add_argument("--require-certified",action="store_true")
    a=ap.parse_args()
    p25=load(a.p25); obs=load(a.observation); samples=load(a.samples); errors=[]
    freeze=p25.get("currentEpochFreezeEvidence") or {}
    generation=p25.get("generation")

    if p25.get("state")!="burn_in_active" or p25.get("generationState")!="burn_in_active":
        errors.append("p25_not_active_burnin")
    if p25.get("currentGenerationEligible") is not True: errors.append("p25_generation_not_eligible")
    if p25.get("completionState",{}).get("invalidated") is True: errors.append("p25_generation_invalidated")

    for key in ("migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
                "edgeInventorySha256","edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256",
                "cronJobs","cronInventorySha256"):
        if obs.get(key)!=freeze.get(key): errors.append("frozen_epoch_changed:"+key)

    exact={"projectStatus":"ACTIVE_HEALTHY","p18Integrity":"clean","p20SchemaDrift":False,
           "p21Readiness":"pass","p22Maintenance":"pass"}
    for k,v in exact.items():
        if obs.get(k)!=v: errors.append("bad_"+k)
    if obs.get("edgeFunctionsAllActive") is not True: errors.append("edge_inventory_not_all_active")
    if int(obs.get("activeCronJobs",-1))!=int(freeze.get("activeCronJobs",-2)): errors.append("active_cron_inventory_mismatch")
    if int(obs.get("cronFailures24h",-1))!=0: errors.append("cron_failures_present")
    if int(obs.get("blockingReplicationSlots",-1))!=0: errors.append("blocking_replication_slots_present")

    if freeze.get("postFinalChangeEncryptedBackupVerified") is not True:
        errors.append("post_final_change_backup_not_verified")
    if obs.get("postFinalSharedChangeBackupVerified") is not True:
        errors.append("observation_backup_not_verified")
    for flag in ("crossAppSmokePassed","authHealthy","realtimeHealthy","postgrestHealthy","storageHealthy",
                 "securityAdvisorsReviewed","performanceAdvisorsReviewed"):
        if obs.get(flag) is not True: errors.append("required_"+flag+"_false")

    observed=dt(obs["observedAt"]); start=dt(p25["activatedAt"]); minimum=dt(p25["minimumCompleteAfter"])
    if observed<minimum: errors.append("minimum_24h_not_reached")

    good=[]
    for row in samples.get("samples") or []:
        try: t=dt(row.get("timestamp") or row.get("checkedAt"))
        except Exception: continue
        healthy=(row.get("healthy") is True) or (row.get("passed") is True)
        success=(row.get("status") in (None,"success")) and healthy
        if (success and row.get("generation")==generation and row.get("qualifiesForBurnIn") is True
                and t>=start):
            good.append((t,row))
    good.sort(key=lambda x:x[0])
    required_samples=int(p25.get("burnInRequirements",{}).get("minimumHourlyPublicSamples",12))
    if len(good)<required_samples: errors.append("insufficient_successful_samples")

    covered=set()
    for t,_ in good:
        elapsed=(t-start).total_seconds()/3600
        if 0<=elapsed<24: covered.add(int(elapsed//4))
    missing=sorted(set(range(6))-covered)
    if missing: errors.append("missing_4h_coverage_buckets:"+",".join(map(str,missing)))
    terminal=[t for t,_ in good if t>=minimum]
    if not terminal: errors.append("no_terminal_sample_at_or_after_24h")

    out={
      "schemaVersion":2,"phase":"P37","certificateType":"p25_current_generation_burnin",
      "decision":"certified" if not errors else "blocked","generation":generation,
      "windowStart":p25.get("activatedAt"),"minimumCompleteAfter":p25.get("minimumCompleteAfter"),
      "certifiedAt":obs.get("observedAt") if not errors else None,
      "successfulSamples":len(good),"coveredBuckets":sorted(covered),
      "terminalSampleAt":terminal[-1].isoformat().replace("+00:00","Z") if terminal else None,
      "epoch":{"migrationHead":freeze.get("migrationHead"),"semanticSchemaSha256":freeze.get("semanticSchemaSha256"),
               "edgeInventorySha256":freeze.get("edgeInventorySha256"),"cronInventorySha256":freeze.get("cronInventorySha256")},
      "errors":sorted(set(errors))
    }
    out["certificateId"]=hid(out) if not errors else None
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_certified and errors: raise SystemExit(1)

if __name__=="__main__": main()
