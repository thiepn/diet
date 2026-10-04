#!/usr/bin/env python3
import argparse,hashlib,json
from datetime import datetime,timedelta,timezone
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def ts(v):
    if v.endswith("Z"): v=v[:-1]+"+00:00"
    d=datetime.fromisoformat(v)
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def z(v): return v.isoformat().replace("+00:00","Z")
def hobj(v): return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("decision")
    ap.add_argument("--out",default="p36-operating-effectiveness-activation.json")
    ap.add_argument("--period-out",default="p36-operating-effectiveness-period.json")
    a=ap.parse_args()
    d=load(a.decision)
    if d.get("decision")!="ready_to_activate":
        raise SystemExit("refusing OE activation: decision is not ready_to_activate")
    if not d.get("activationAuthorizationId"):
        raise SystemExit("refusing OE activation: activation authorization missing")
    start=ts(d["observedAt"])
    activation={
      "schemaVersion":2,"phase":"P36","state":"active",
      "periodId":"p36-oe-001","periodStart":z(start),
      "internalDryRunMinimumEnd":z(start+timedelta(days=30)),
      "externalReadinessPlanningTargetEnd":z(start+timedelta(days=90)),
      "activationIsRetroactive":False,"externalAttestation":False,
      "sourceDecisionId":d["decisionId"],
      "activationAuthorizationId":d["activationAuthorizationId"]
    }
    activation["activationId"]=hobj(activation)
    period={
      "periodId":"p36-oe-001","mode":"operating",
      "periodStart":z(start),"periodEnd":z(start+timedelta(days=30)),
      "expectedChangeIds":[],"expectedIncidentIds":[],"expectedExceptionIds":[],
      "startAuthorizationId":d["activationAuthorizationId"],"backfilled":False,
      "sourceActivationId":activation["activationId"]
    }
    Path(a.out).write_text(json.dumps(activation,indent=2)+"\n",encoding="utf-8")
    Path(a.period_out).write_text(json.dumps(period,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(activation,separators=(",",":")))

if __name__=="__main__": main()
