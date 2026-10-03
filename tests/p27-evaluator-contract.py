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

slo=run("scripts/p27-evaluate-slo.py",{
  "samples":[
    {"requests":1000,"failures5xx":0,"syntheticPassed":True,"restP95Ms":400,"authP95Ms":500},
    {"requests":1000,"failures5xx":1,"syntheticPassed":True,"restP95Ms":450,"authP95Ms":550}
  ]
})
assert slo["requestCount"]==2000
assert slo["failure5xxCount"]==1
assert abs(slo["availabilityPct"]-99.95)<1e-9
assert abs(slo["errorBudgetMinutes"]-43.2)<1e-9
assert slo["sloMet"] is True

capacity=run("scripts/p27-capacity-forecast.py",[
  {"date":"2026-10-01T00:00:00Z","databaseBytes":1000},
  {"date":"2026-10-15T00:00:00Z","databaseBytes":2400}
])
assert capacity["sampleCount"]==2
assert capacity["observationDays"]==14.0
assert abs(capacity["estimatedDailyGrowthBytes"]-100.0)<1e-9
assert capacity["forecasts"]["30"]["databaseBytes"]==5400

print("P27 evaluator/forecast contracts passed.")
