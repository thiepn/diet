#!/usr/bin/env python3
import argparse, json, math
from pathlib import Path

def percentile(values, p):
    if not values:
        return None
    xs=sorted(float(v) for v in values)
    if len(xs)==1:
        return xs[0]
    k=(len(xs)-1)*p
    f=math.floor(k); c=math.ceil(k)
    if f==c:
        return xs[int(k)]
    return xs[f]*(c-k)+xs[c]*(k-f)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("samples",help="JSON array or object with samples[]")
    ap.add_argument("--out",default="p27-slo-evaluation.json")
    ap.add_argument("--availability-target",type=float,default=99.9)
    ap.add_argument("--window-days",type=float,default=30.0)
    args=ap.parse_args()

    raw=json.loads(Path(args.samples).read_text(encoding="utf-8"))
    samples=raw["samples"] if isinstance(raw,dict) and "samples" in raw else raw
    if not isinstance(samples,list) or not samples:
        raise SystemExit("samples must be a non-empty list")

    total=sum(int(s.get("requests",0)) for s in samples)
    failures=sum(int(s.get("failures5xx",0)) for s in samples)
    synthetic_failures=sum(1 for s in samples if s.get("syntheticPassed") is False)
    rest=[s["restP95Ms"] for s in samples if isinstance(s.get("restP95Ms"),(int,float))]
    auth=[s["authP95Ms"] for s in samples if isinstance(s.get("authP95Ms"),(int,float))]
    availability=(100.0*(total-failures)/total) if total else None
    budget_minutes=args.window_days*24*60*(1.0-args.availability_target/100.0)

    out={
      "schemaVersion":1,
      "phase":"P27",
      "sampleCount":len(samples),
      "requestCount":total,
      "failure5xxCount":failures,
      "syntheticFailureCount":synthetic_failures,
      "availabilityPct":availability,
      "availabilityTargetPct":args.availability_target,
      "errorBudgetMinutes":round(budget_minutes,3),
      "restP95AcrossSamplesMs":round(percentile(rest,0.95),3) if rest else None,
      "authP95AcrossSamplesMs":round(percentile(auth,0.95),3) if auth else None,
      "sloMet":(
          (availability is None or availability>=args.availability_target)
          and synthetic_failures==0
      )
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
