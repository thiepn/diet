#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
payload={"usage":{
 "database":{"used":70,"quota":100},
 "storage":{"used":85,"quota":100},
 "egress":{"used":None,"quota":100},
 "edge":{"used":95,"quota":100}
}}
with tempfile.TemporaryDirectory() as d:
    inp=Path(d)/"in.json"; out=Path(d)/"out.json"
    inp.write_text(json.dumps(payload),encoding="utf-8")
    subprocess.run([sys.executable,str(ROOT/"scripts/p28-quota-evaluate.py"),str(inp),"--out",str(out)],check=True,capture_output=True,text=True)
    x=json.loads(out.read_text(encoding="utf-8"))
assert x["items"]["database"]["band"]=="observe"
assert x["items"]["storage"]["band"]=="plan"
assert x["items"]["egress"]["band"]=="unknown"
assert x["items"]["edge"]["band"]=="protect"
assert x["highestBand"]=="protect"
assert x["automaticPurchaseAllowed"] is False
assert x["automaticThrottleAllowed"] is False
assert x["unknownMeansZero"] is False
print("P28 quota contract passed.")
