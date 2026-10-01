#!/usr/bin/env python3
import argparse, json
from datetime import datetime
from pathlib import Path

HORIZONS=(30,90,180,365)

def ts(v):
    return datetime.fromisoformat(v.replace("Z","+00:00")).timestamp()/86400.0

def linear_rate(points):
    if len(points)<2:
        return None
    xs=[ts(p["date"]) for p in points]
    ys=[float(p["databaseBytes"]) for p in points]
    xbar=sum(xs)/len(xs); ybar=sum(ys)/len(ys)
    den=sum((x-xbar)**2 for x in xs)
    if den==0:
        return None
    return sum((x-xbar)*(y-ybar) for x,y in zip(xs,ys))/den

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("snapshots",help="JSON array or object with snapshots[]")
    ap.add_argument("--out",default="p27-capacity-forecast.json")
    args=ap.parse_args()

    raw=json.loads(Path(args.snapshots).read_text(encoding="utf-8"))
    points=raw["snapshots"] if isinstance(raw,dict) and "snapshots" in raw else raw
    if not isinstance(points,list) or len(points)<2:
        raise SystemExit("at least two dated snapshots are required")
    points=sorted(points,key=lambda x:x["date"])
    rate=linear_rate(points)
    latest=float(points[-1]["databaseBytes"])
    out={
      "schemaVersion":1,
      "phase":"P27",
      "sampleCount":len(points),
      "observationDays":round(ts(points[-1]["date"])-ts(points[0]["date"]),3),
      "latestDatabaseBytes":int(latest),
      "estimatedDailyGrowthBytes":round(rate,3) if rate is not None else None,
      "forecasts":{}
    }
    for days in HORIZONS:
        out["forecasts"][str(days)]={
          "days":days,
          "databaseBytes":round(max(0.0,latest+(rate or 0.0)*days))
        }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
