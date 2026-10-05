#!/usr/bin/env python3
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path

EPOCH_KEYS = (
    "migrationHead","semanticSchemaSha256","edgeFunctionCount",
    "gomokuRoomVersion","gomokuRoomSha256","cronJobs"
)

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dt(value):
    x=datetime.fromisoformat(value.replace("Z","+00:00"))
    if x.tzinfo is None: x=x.replace(tzinfo=timezone.utc)
    return x.astimezone(timezone.utc)

def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--samples")
    ap.add_argument("--out",default="p41-certification-readiness.json")
    ap.add_argument("--require-certifiable",action="store_true")
    a=ap.parse_args()

    p25=load(a.p25); obs=load(a.observation)
    freeze=p25.get("currentEpochFreezeEvidence") or {}
    generation=p25.get("generation")
    start=dt(p25["activatedAt"])
    boundary=dt(p25["minimumCompleteAfter"])
    observed=dt(obs["observedAt"])

    mismatches=[]
    for key in EPOCH_KEYS:
        if obs.get(key)!=freeze.get(key):
            mismatches.append({
                "field":key,
                "frozen":freeze.get(key),
                "observed":obs.get(key)
            })

    state_errors=[]
    if generation != 5: state_errors.append("unexpected_generation")
    if p25.get("state")!="burn_in_active": state_errors.append("p25_not_burn_in_active")
    if p25.get("generationState")!="burn_in_active": state_errors.append("generation_not_burn_in_active")
    if p25.get("currentGenerationEligible") is not True: state_errors.append("generation_not_eligible")

    evidence={"successfulQualifyingSamples":0,"coverageBuckets":[],"terminalSamplePresent":False}
    if a.samples:
        rows=load(a.samples).get("samples") or []
        good=[]; buckets=set()
        for row in rows:
            stamp=row.get("timestamp") or row.get("checkedAt")
            if not stamp: continue
            try: t=dt(stamp)
            except Exception: continue
            healthy=(row.get("healthy") is True) or (row.get("passed") is True)
            if row.get("generation")!=5 or row.get("qualifiesForBurnIn") is not True or not healthy:
                continue
            if row.get("status") not in (None,"success") or t < start: continue
            good.append(t)
            h=(t-start).total_seconds()/3600
            if 0 <= h < 24: buckets.add(int(h//4))
        evidence={
          "successfulQualifyingSamples":len(good),
          "coverageBuckets":sorted(buckets),
          "terminalSamplePresent":any(t>=boundary for t in good)
        }

    blockers=list(state_errors)
    if mismatches: blockers.append("frozen_epoch_changed")
    if observed < boundary: blockers.append("minimum_24h_not_reached")
    if evidence["successfulQualifyingSamples"] < int(p25.get("generation5Sampling",{}).get("minimumSuccessfulSamples",12)):
        blockers.append("insufficient_successful_samples")
    if len(evidence["coverageBuckets"]) < int(p25.get("generation5Sampling",{}).get("minimumCoverageBuckets",6)):
        blockers.append("coverage_incomplete")
    if not evidence["terminalSamplePresent"]: blockers.append("terminal_sample_missing")

    out={
      "schemaVersion":1,
      "phase":"P41",
      "generation":generation,
      "observedAt":iso(observed),
      "decision":"certifiable" if not blockers else ("blocked_epoch_changed" if mismatches else "blocked"),
      "certifiable":not blockers,
      "frozenEpochMatch":not mismatches,
      "epochMismatches":mismatches,
      "window":{
        "activatedAt":p25["activatedAt"],
        "minimumCompleteAfter":p25["minimumCompleteAfter"],
        "elapsedHours":round((observed-start).total_seconds()/3600,3)
      },
      "evidence":evidence,
      "blockers":sorted(set(blockers)),
      "requiresNewGeneration":bool(mismatches),
      "nextGeneration":6 if mismatches else None,
      "productionMutationPerformed":False
    }
    out["readinessId"]=digest({k:v for k,v in out.items() if k!="readinessId"})
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_certifiable and blockers: raise SystemExit(1)

if __name__=="__main__":
    main()
