#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def run(script,payload,*args):
    with tempfile.TemporaryDirectory() as d:
        inp=Path(d)/"in.json"; out=Path(d)/"out.json"
        inp.write_text(json.dumps(payload),encoding="utf-8")
        subprocess.run([sys.executable,str(ROOT/script),str(inp),"--out",str(out),*args],check=True,capture_output=True,text=True)
        return json.loads(out.read_text(encoding="utf-8"))

healthy=run("scripts/p27-evaluate-slo.py",{"samples":[
  {"checkedAt":"2026-10-03T00:00:00Z","requests":10000,"failures5xx":0,"syntheticPassed":True,"restP95Ms":300,"authP95Ms":600},
  {"checkedAt":"2026-10-03T01:00:00Z","requests":10000,"failures5xx":0,"syntheticPassed":True,"restP95Ms":330,"authP95Ms":620}
]})
assert healthy["state"]=="healthy"
assert healthy["productionMutationAllowed"] is False
assert abs(healthy["errorBudgetMinutes"]-43.2)<1e-9

fast=run("scripts/p27-evaluate-slo.py",{"samples":[
  {"checkedAt":"2026-10-03T00:30:00Z","requests":10000,"failures5xx":0,"syntheticPassed":True,"restP95Ms":300,"authP95Ms":600},
  {"checkedAt":"2026-10-03T01:00:00Z","requests":10000,"failures5xx":300,"syntheticPassed":True,"restP95Ms":300,"authP95Ms":600}
]})
assert fast["fastBurnRate1h"]>=14.4
assert fast["state"]=="critical"

short=run("scripts/p27-capacity-forecast.py",[
  {"date":"2026-10-01T00:00:00Z","databaseBytes":1000},
  {"date":"2026-10-02T00:00:00Z","databaseBytes":1100}
])
assert short["qualified"] is False

qualified=run("scripts/p27-capacity-forecast.py",[
  {"date":"2026-10-01T00:00:00Z","databaseBytes":1000},
  {"date":"2026-10-08T00:00:00Z","databaseBytes":1700},
  {"date":"2026-10-15T00:00:00Z","databaseBytes":2400}
],"--capacity-bytes","10000")
assert qualified["qualified"] is True
assert qualified["observationDays"]==14.0
assert abs(qualified["estimatedDailyGrowthBytes"]-100.0)<1e-9
assert qualified["forecasts"]["30"]["databaseBytes"]==5400
assert qualified["daysToCapacity"]==76.0

print("P27 SLO and capacity evaluator contracts passed.")
