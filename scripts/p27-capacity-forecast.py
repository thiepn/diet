#!/usr/bin/env python3
import argparse, json, math
from datetime import datetime
from pathlib import Path

HORIZONS=(30,90,180,365)

def ts(v):
    return datetime.fromisoformat(v.replace("Z","+00:00")).timestamp()/86400.0

def regression(points):
    xs=[ts(p["date"]) for p in points]
    ys=[float(p["databaseBytes"]) for p in points]
    xbar=sum(xs)/len(xs); ybar=sum(ys)/len(ys)
    den=sum((x-xbar)**2 for x in xs)
    if den==0:
        return None,None
    slope=sum((x-xbar)*(y-ybar) for x,y in zip(xs,ys))/den
    intercept=ybar-slope*xbar
    ss_tot=sum((y-ybar)**2 for y in ys)
    ss_res=sum((y-(intercept+slope*x))**2 for x,y in zip(xs,ys))
    r2=1.0-(ss_res/ss_tot) if ss_tot else 1.0
    return slope,r2

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("snapshots",help="JSON array or object with snapshots[]")
    ap.add_argument("--out",default="p27-capacity-forecast.json")
    ap.add_argument("--minimum-days",type=float,default=14.0)
    ap.add_argument("--minimum-samples",type=int,default=3)
    ap.add_argument("--capacity-bytes",type=int)
    args=ap.parse_args()

    raw=json.loads(Path(args.snapshots).read_text(encoding="utf-8"))
    points=raw["snapshots"] if isinstance(raw,dict) and "snapshots" in raw else raw
    if not isinstance(points,list) or len(points)<2:
        raise SystemExit("at least two dated snapshots are required")

    dedup={p["date"]:p for p in points}
    points=sorted(dedup.values(),key=lambda x:x["date"])
    observation_days=ts(points[-1]["date"])-ts(points[0]["date"])
    rate,r2=regression(points)
    latest=float(points[-1]["databaseBytes"])
    qualified=(
        len(points)>=args.minimum_samples
        and observation_days>=args.minimum_days
        and rate is not None
    )

    forecasts={}
    for days in HORIZONS:
        forecasts[str(days)]={
            "days":days,
            "databaseBytes":round(max(0.0,latest+(rate or 0.0)*days))
        }

    days_to_capacity=None
    if args.capacity_bytes and rate and rate>0 and latest<args.capacity_bytes:
        days_to_capacity=round((args.capacity_bytes-latest)/rate,3)

    out={
      "schemaVersion":2,
      "phase":"P27",
      "sampleCount":len(points),
      "observationDays":round(observation_days,3),
      "minimumDays":args.minimum_days,
      "minimumSamples":args.minimum_samples,
      "qualified":qualified,
      "latestDatabaseBytes":int(latest),
      "estimatedDailyGrowthBytes":round(rate,3) if rate is not None else None,
      "rSquared":round(r2,6) if r2 is not None else None,
      "growthClass":"growing" if rate and rate>0 else ("shrinking" if rate and rate<0 else "flat_or_unknown"),
      "capacityBytes":args.capacity_bytes,
      "daysToCapacity":days_to_capacity,
      "forecasts":forecasts,
      "disposition":"planning_signal_only" if qualified else "provisional_not_qualified"
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
