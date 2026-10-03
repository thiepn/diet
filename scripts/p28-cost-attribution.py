#!/usr/bin/env python3
import argparse, json
from collections import Counter
from pathlib import Path

def classify(path: str) -> str:
    p=(path or "").lower()
    if "gomoku" in p:
        return "gomoku"
    if "account_" in p or "thiepn_account" in p:
        return "account"
    if "diet_" in p or "/functions/v1/diet-" in p:
        return "diet"
    if "leaderboard" in p:
        return "leaderboard"
    if "wordstrike" in p:
        return "wordstrike"
    if "micro_arcade" in p or "micro-arcade" in p:
        return "micro_arcade"
    if "platform_" in p or "platform-health" in p:
        return "platform"
    if p.startswith("/auth/"):
        return "shared_auth"
    if p.startswith("/realtime/"):
        return "shared_realtime"
    if p.startswith("/storage/"):
        return "shared_storage"
    return "unattributed"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("input",help="JSON array or object with events[]; each event needs path and optional requests/responseBytes")
    ap.add_argument("--out",default="p28-cost-attribution.json")
    args=ap.parse_args()

    raw=json.loads(Path(args.input).read_text(encoding="utf-8"))
    events=raw.get("events") if isinstance(raw,dict) else raw
    if not isinstance(events,list):
        raise SystemExit("input must be a JSON list or object with events[]")

    requests=Counter()
    response_bytes=Counter()
    unknown=Counter()
    total=0
    for e in events:
        path=str(e.get("path") or "")
        n=int(e.get("requests",1))
        b=int(e.get("responseBytes",0))
        owner=classify(path)
        requests[owner]+=n
        response_bytes[owner]+=b
        total+=n
        if owner=="unattributed":
            unknown[path]+=n

    classified=total-requests["unattributed"]
    coverage=(100.0*classified/total) if total else 100.0
    out={
      "schemaVersion":1,
      "phase":"P28",
      "costModel":"showback_usage_units_only",
      "totalRequests":total,
      "classifiedRequests":classified,
      "classificationCoveragePct":round(coverage,4),
      "requestPools":dict(sorted(requests.items())),
      "responseBytePools":dict(sorted(response_bytes.items())),
      "unattributedPaths":[{"path":p,"requests":n} for p,n in unknown.most_common()],
      "currencyCostCalculated":False,
      "warning":"Request share is not invoice share. Shared pools and Supabase billing units must remain separate."
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
