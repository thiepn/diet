#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

sample={"events":[
  {"path":"/rest/v1/gomoku_rooms","requests":100},
  {"path":"/realtime/v1/api/broadcast","requests":20},
  {"path":"/auth/v1/user","requests":10},
  {"path":"/rest/v1/account_apps","requests":5},
  {"path":"/rest/v1/rpc/diet_p18_integrity_report","requests":4},
  {"path":"/rest/v1/leaderboard_profiles","requests":3},
  {"path":"/functions/v1/platform-health","requests":2},
  {"path":"/rest/v1/unknown_legacy","requests":1}
]}

with tempfile.TemporaryDirectory() as d:
    inp=Path(d)/"in.json"; out=Path(d)/"out.json"
    inp.write_text(json.dumps(sample),encoding="utf-8")
    subprocess.run(
      [sys.executable,str(ROOT/"scripts/p28-cost-attribution.py"),str(inp),"--out",str(out)],
      check=True,capture_output=True,text=True
    )
    result=json.loads(out.read_text(encoding="utf-8"))

assert result["totalRequests"]==145
assert result["classifiedRequests"]==144
assert round(result["classificationCoveragePct"],2)==99.31
assert result["requestPools"]["gomoku"]==100
assert result["requestPools"]["shared_realtime"]==20
assert result["requestPools"]["shared_auth"]==10
assert result["requestPools"]["account"]==5
assert result["requestPools"]["diet"]==4
assert result["requestPools"]["leaderboard"]==3
assert result["requestPools"]["platform"]==2
assert result["requestPools"]["unattributed"]==1
assert result["currencyCostCalculated"] is False
assert result["unattributedPaths"][0]["path"]=="/rest/v1/unknown_legacy"

print("P28 cost-attribution contract passed.")
