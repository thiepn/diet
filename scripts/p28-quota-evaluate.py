#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def band(pct):
    if pct is None: return "unknown"
    if pct >= 90: return "protect"
    if pct >= 80: return "plan"
    if pct >= 60: return "observe"
    return "normal"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out",default="p28-quota-evaluation.json")
    args=ap.parse_args()
    raw=json.loads(Path(args.input).read_text(encoding="utf-8"))
    items={}
    for name,item in (raw.get("usage") or {}).items():
        used=item.get("used")
        quota=item.get("quota")
        if used is None or quota in (None,0):
            pct=None
        else:
            pct=100.0*float(used)/float(quota)
        items[name]={
          "used":used,"quota":quota,
          "utilizationPct":round(pct,4) if pct is not None else None,
          "band":band(pct),
          "known":pct is not None
        }
    highest="normal"
    order={"normal":0,"unknown":1,"observe":2,"plan":3,"protect":4}
    for x in items.values():
        if order[x["band"]]>order[highest]: highest=x["band"]
    out={
      "schemaVersion":1,"phase":"P28","bandsPct":{"observe":60,"plan":80,"protect":90},
      "items":items,"highestBand":highest,
      "automaticPurchaseAllowed":False,
      "automaticThrottleAllowed":False,
      "unknownMeansZero":False
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__": main()
