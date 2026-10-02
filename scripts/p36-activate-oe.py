#!/usr/bin/env python3
import argparse,json
from datetime import datetime,timedelta
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def dt(v): return datetime.fromisoformat(v.replace("Z","+00:00"))
def z(v): return v.astimezone().isoformat().replace("+00:00","Z")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("decision")
    ap.add_argument("--out",default="p36-operating-effectiveness-activation.json")
    args=ap.parse_args()
    d=load(args.decision)
    if d.get("decision")!="ready_to_activate":
        raise SystemExit("refusing OE activation: readiness decision is not ready_to_activate")
    start=dt(d["observedAt"])
    out={
      "schemaVersion":1,"phase":"P36",
      "state":"active",
      "periodId":"p36-oe-001",
      "periodStart":start.isoformat().replace("+00:00","Z"),
      "internalDryRunMinimumEnd":(start+timedelta(days=30)).isoformat().replace("+00:00","Z"),
      "externalReadinessPlanningTargetEnd":(start+timedelta(days=90)).isoformat().replace("+00:00","Z"),
      "activationIsRetroactive":False,
      "externalAttestation":False,
      "sourceDecision":str(args.decision)
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__": main()
