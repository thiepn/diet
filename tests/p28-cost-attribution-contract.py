#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sample={"events":[
 {"path":"/rest/v1/gomoku_rooms","requests":100},
 {"path":"/rest/v1/micro_arcade_best_scores","requests":20},
 {"path":"/realtime/v1/api/broadcast","requests":10},
 {"path":"/auth/v1/user","requests":9},
 {"path":"/rest/v1/account_apps","requests":8},
 {"path":"/rest/v1/profiles","requests":7},
 {"path":"/rest/v1/leaderboard_profiles","requests":6},
 {"path":"/functions/v1/wordstrike-profile-sync","requests":5},
 {"path":"/rest/v1/tms60_sync_state","requests":4},
 {"path":"/rest/v1/notes_sync_records","requests":3},
 {"path":"/storage/v1/object/public/canvas-ci-assets/test.txt","requests":2},
 {"path":"/functions/v1/platform-health","requests":1},
 {"path":"/rest/v1/unknown_legacy","requests":1}
]}
with tempfile.TemporaryDirectory() as d:
    inp=Path(d)/"in.json"; out=Path(d)/"out.json"
    inp.write_text(json.dumps(sample),encoding="utf-8")
    subprocess.run([sys.executable,str(ROOT/"scripts/p28-cost-attribution.py"),str(inp),"--out",str(out)],check=True,capture_output=True,text=True)
    x=json.loads(out.read_text(encoding="utf-8"))
assert x["totalRequests"]==176
assert x["classifiedRequests"]==175
assert x["classificationCoveragePct"]>99
assert x["requestPools"]["diet"]==7
assert x["requestPools"]["micro_arcade"]==20
assert x["requestPools"]["canvas"]==2
assert x["requestPools"]["unattributed"]==1
assert x["currencyCostCalculated"] is False
assert x["chargebackEligible"] is True
print("P28 cost-attribution contract passed.")
