#!/usr/bin/env python3
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dt(value):
    d=datetime.fromisoformat(value.replace("Z","+00:00"))
    if d.tzinfo is None:
        d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)

def iso(d):
    return d.isoformat().replace("+00:00","Z")

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("samples")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--at",required=True)
    ap.add_argument("--out",default="p38-burnin-progress.json")
    ap.add_argument("--require-certifiable",action="store_true")
    a=ap.parse_args()

    p25=load(a.p25)
    payload=load(a.samples)
    now=dt(a.at)
    errors=[]

    if p25.get("state")!="burn_in_active":
        errors.append("p25_not_burn_in_active")
    if p25.get("generationState")!="burn_in_active":
        errors.append("generation_state_not_active")
    if p25.get("currentGenerationEligible") is not True:
        errors.append("current_generation_not_eligible")
    generation=p25.get("generation")
    if not isinstance(generation,int):
        errors.append("generation_missing")
    if not p25.get("activatedAt") or not p25.get("minimumCompleteAfter"):
        errors.append("activation_window_missing")

    start=dt(p25["activatedAt"]) if p25.get("activatedAt") else now
    minimum=dt(p25["minimumCompleteAfter"]) if p25.get("minimumCompleteAfter") else now

    good=[]
    rejected=[]
    seen=set()
    for idx,row in enumerate(payload.get("samples") or []):
        stamp=row.get("timestamp") or row.get("checkedAt")
        if not stamp:
            rejected.append({"index":idx,"reason":"timestamp_missing"})
            continue
        try:
            t=dt(stamp)
        except Exception:
            rejected.append({"index":idx,"reason":"timestamp_invalid"})
            continue
        key=("run",str(row["runId"])) if row.get("runId") is not None else ("sample",stamp,str(row.get("artifactId","")))
        if key in seen:
            rejected.append({"index":idx,"reason":"duplicate_sample"})
            continue
        seen.add(key)
        if row.get("generation")!=generation:
            rejected.append({"index":idx,"reason":"wrong_generation"})
            continue
        if row.get("qualifiesForBurnIn") is not True:
            rejected.append({"index":idx,"reason":"not_qualifying"})
            continue
        healthy=(row.get("healthy") is True) or (row.get("passed") is True)
        if not healthy or row.get("status") not in (None,"success"):
            rejected.append({"index":idx,"reason":"unsuccessful"})
            continue
        if t<start:
            rejected.append({"index":idx,"reason":"pre_activation"})
            continue
        if t>now:
            rejected.append({"index":idx,"reason":"after_observation_time"})
            continue
        good.append((t,row))

    good.sort(key=lambda x:x[0])
    coverage=set()
    for t,_ in good:
        hours=(t-start).total_seconds()/3600
        if 0<=hours<24:
            coverage.add(int(hours//4))
    terminal=[t for t,_ in good if t>=minimum]
    elapsed=max(0,(now-start).total_seconds()/3600)
    remaining=max(0,(minimum-now).total_seconds()/3600)
    required_samples=int(p25.get("generation5Sampling",{}).get("minimumSuccessfulSamples",12))
    required_buckets=int(p25.get("generation5Sampling",{}).get("minimumCoverageBuckets",6))
    missing=[i for i in range(required_buckets) if i not in coverage]

    blockers=list(errors)
    if len(good)<required_samples:
        blockers.append(f"successful_samples:{len(good)}/{required_samples}")
    if missing:
        blockers.append("missing_coverage_buckets:"+",".join(map(str,missing)))
    if now<minimum:
        blockers.append("minimum_24h_not_reached")
    if not terminal:
        blockers.append("terminal_sample_missing")

    out={
      "schemaVersion":1,
      "phase":"P38",
      "generation":generation,
      "observedAt":iso(now),
      "state":"certifiable" if not blockers else ("evidence_accumulating" if not errors else "blocked"),
      "activatedAt":iso(start),
      "minimumCompleteAfter":iso(minimum),
      "elapsedHours":round(elapsed,3),
      "remainingHoursToMinimum":round(remaining,3),
      "successfulQualifyingSamples":len(good),
      "requiredSuccessfulSamples":required_samples,
      "coverageBuckets":sorted(coverage),
      "missingCoverageBuckets":missing,
      "terminalSamplePresent":bool(terminal),
      "terminalSampleAt":iso(terminal[-1]) if terminal else None,
      "rejectedSamples":rejected,
      "blockers":sorted(set(blockers)),
      "readyForP37Certification":not blockers
    }
    out["progressId"]=digest({k:v for k,v in out.items() if k!="progressId"})
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_certifiable and blockers:
        raise SystemExit(1)

if __name__=="__main__":
    main()
