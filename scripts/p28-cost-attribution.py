#!/usr/bin/env python3
import argparse, json
from collections import Counter
from pathlib import Path

DIET_TABLES=(
 "profiles","activity_daily","ai_actions","change_log","daily_logs","goal_phases",
 "meal_items","meals","saved_food_portions","saved_foods","saved_meal_items","saved_meals",
 "target_recommendations","training_days","training_distribution_settings","weekly_reviews","weight_entries"
)

def classify(path: str) -> str:
    p=(path or "").lower()
    if "canvas-ci-assets" in p or "canvas_" in p: return "canvas"
    if "gomoku" in p: return "gomoku"
    if "micro_arcade" in p or "micro-arcade" in p: return "micro_arcade"
    if "leaderboard" in p: return "leaderboard"
    if "wordstrike" in p: return "wordstrike"
    if "tms60" in p: return "tms60"
    if "wttn" in p: return "wttn"
    if "notes_" in p or "/notes/" in p: return "notes"
    if "account_" in p or "thiepn_account" in p: return "account"
    if "diet_" in p or "/functions/v1/diet-" in p: return "diet"
    if any(("/rest/v1/"+name) in p for name in DIET_TABLES): return "diet"
    if "platform_" in p or "platform-health" in p: return "platform"
    if p.startswith("/auth/"): return "shared_auth"
    if p.startswith("/realtime/"): return "shared_realtime"
    if p.startswith("/storage/"): return "shared_storage"
    return "unattributed"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("input",help="JSON array or object with events[]")
    ap.add_argument("--out",default="p28-cost-attribution.json")
    args=ap.parse_args()
    raw=json.loads(Path(args.input).read_text(encoding="utf-8"))
    events=raw.get("events") if isinstance(raw,dict) else raw
    if not isinstance(events,list): raise SystemExit("input must be a JSON list or object with events[]")

    requests=Counter(); response_bytes=Counter(); unknown=Counter(); total=0
    for e in events:
        path=str(e.get("path") or "")
        n=max(0,int(e.get("requests",1)))
        b=max(0,int(e.get("responseBytes",0)))
        owner=classify(path)
        requests[owner]+=n
        response_bytes[owner]+=b
        total+=n
        if owner=="unattributed": unknown[path]+=n

    classified=total-requests["unattributed"]
    coverage=100.0*classified/total if total else 100.0
    out={
      "schemaVersion":2,"phase":"P28","costModel":"showback_usage_units_only",
      "totalRequests":total,"classifiedRequests":classified,
      "classificationCoveragePct":round(coverage,4),
      "requestPools":dict(sorted(requests.items())),
      "responseBytePools":dict(sorted(response_bytes.items())),
      "unattributedPaths":[{"path":p,"requests":n} for p,n in unknown.most_common()],
      "currencyCostCalculated":False,
      "chargebackEligible":coverage>=90.0 and total>0,
      "warning":"Request share is not invoice share. Billing units and shared pools remain separate."
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__": main()
