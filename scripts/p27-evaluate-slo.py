#!/usr/bin/env python3
import argparse, json, math
from datetime import datetime, timezone
from pathlib import Path

def parse_ts(v):
    if not v: return None
    if v.endswith("Z"): v=v[:-1]+"+00:00"
    dt=datetime.fromisoformat(v)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def percentile(values,p):
    if not values: return None
    xs=sorted(float(v) for v in values)
    rank=max(1,math.ceil(p*len(xs)))
    return xs[rank-1]

def window_burn(samples,end,hours,budget_fraction):
    start=end.timestamp()-hours*3600
    subset=[s for s in samples if s["_ts"] and s["_ts"].timestamp()>=start]
    req=sum(int(s.get("requests",0)) for s in subset)
    bad=sum(int(s.get("failures5xx",0)) for s in subset)
    if req<=0: return None
    return (bad/req)/budget_fraction

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("samples")
    ap.add_argument("--out",default="p27-slo-evaluation.json")
    ap.add_argument("--availability-target",type=float,default=99.9)
    ap.add_argument("--window-days",type=float,default=30.0)
    ap.add_argument("--rest-warning-ms",type=float,default=750.0)
    ap.add_argument("--rest-critical-ms",type=float,default=1500.0)
    ap.add_argument("--auth-warning-ms",type=float,default=929.0)
    ap.add_argument("--auth-critical-ms",type=float,default=1500.0)
    ap.add_argument("--fast-burn",type=float,default=14.4)
    ap.add_argument("--slow-burn",type=float,default=6.0)
    args=ap.parse_args()

    raw=json.loads(Path(args.samples).read_text(encoding="utf-8"))
    samples=raw["samples"] if isinstance(raw,dict) and "samples" in raw else raw
    if not isinstance(samples,list) or not samples:
        raise SystemExit("samples must be a non-empty list")

    for s in samples: s["_ts"]=parse_ts(s.get("checkedAt"))
    total=sum(int(s.get("requests",0)) for s in samples)
    failures=sum(int(s.get("failures5xx",0)) for s in samples)
    synthetic_failures=sum(1 for s in samples if s.get("syntheticPassed") is False)
    rest=[s["restP95Ms"] for s in samples if isinstance(s.get("restP95Ms"),(int,float))]
    auth=[s["authP95Ms"] for s in samples if isinstance(s.get("authP95Ms"),(int,float))]
    availability=(100.0*(total-failures)/total) if total else None
    budget_fraction=1.0-args.availability_target/100.0
    budget_minutes=args.window_days*24*60*budget_fraction
    failure_fraction=(failures/total) if total else None
    overall_burn=(failure_fraction/budget_fraction) if failure_fraction is not None else None
    timestamps=[s["_ts"] for s in samples if s["_ts"]]
    end=max(timestamps) if timestamps else None
    fast=window_burn(samples,end,1,budget_fraction) if end else None
    slow=window_burn(samples,end,6,budget_fraction) if end else None

    rest_p95=percentile(rest,.95)
    auth_p95=percentile(auth,.95)
    latency_state="healthy"
    if (rest_p95 is not None and rest_p95>=args.rest_critical_ms) or (auth_p95 is not None and auth_p95>=args.auth_critical_ms):
        latency_state="critical"
    elif (rest_p95 is not None and rest_p95>=args.rest_warning_ms) or (auth_p95 is not None and auth_p95>=args.auth_warning_ms):
        latency_state="warning"

    burn_state="healthy"
    if fast is not None and fast>=args.fast_burn:
        burn_state="critical_fast"
    elif slow is not None and slow>=args.slow_burn:
        burn_state="critical_slow"
    elif overall_burn is not None and overall_burn>1:
        burn_state="budget_overrun"

    state="healthy"
    if synthetic_failures>0 or burn_state.startswith("critical") or latency_state=="critical":
        state="critical"
    elif burn_state=="budget_overrun" or latency_state=="warning":
        state="warning"

    out={
      "schemaVersion":2,
      "phase":"P27",
      "sampleCount":len(samples),
      "requestCount":total,
      "failure5xxCount":failures,
      "syntheticFailureCount":synthetic_failures,
      "availabilityPct":round(availability,6) if availability is not None else None,
      "availabilityTargetPct":args.availability_target,
      "errorBudgetMinutes":round(budget_minutes,3),
      "errorBudgetConsumedPct":round((overall_burn or 0)*100,3) if overall_burn is not None else None,
      "overallBurnRate":round(overall_burn,3) if overall_burn is not None else None,
      "fastBurnRate1h":round(fast,3) if fast is not None else None,
      "slowBurnRate6h":round(slow,3) if slow is not None else None,
      "burnState":burn_state,
      "restP95AcrossSamplesMs":round(rest_p95,3) if rest_p95 is not None else None,
      "authP95AcrossSamplesMs":round(auth_p95,3) if auth_p95 is not None else None,
      "latencyState":latency_state,
      "state":state,
      "sloMet":state=="healthy",
      "humanReviewRequired":state!="healthy",
      "productionMutationAllowed":False
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
