"""P12: wait until canonical Diet Copilot 2.0 production bytes match this checkout."""
import hashlib, json, os, time
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "https://thiepn.dev/diet/"
ROOT = Path(".")
FILES = {
    "index.html","manifest.webmanifest","sw.js",".well-known/thiepn-app.json",
    "legacy-v1.html","diet-app.js","diet.css","vendor/supabase-2.116.0.js",
    "icon.svg","icon-192.png","icon-512.png"
}
FILES.update("v2/" + str(path.relative_to("v2")).replace("\\","/") for path in Path("v2").rglob("*") if path.is_file())
FILES = sorted(FILES)
REVISION = os.environ.get("P12_PROD_SHA") or os.environ.get("GITHUB_SHA","manual")
DEADLINE = time.monotonic() + 360

def digest(data):
    return hashlib.sha256(data).hexdigest()

expected={name:digest((ROOT/name).read_bytes()) for name in FILES}
while True:
    results=[]
    for name in FILES:
        try:
            req=Request(BASE+name+"?verify="+REVISION,headers={"Cache-Control":"no-cache","User-Agent":"Diet-P12-production-verification"})
            with urlopen(req,timeout=15) as response:
                body=response.read()
                actual=digest(body)
                results.append({"path":name,"status":response.status,"sha256":actual,"expected":expected[name],"matches":actual==expected[name]})
        except Exception as error:
            results.append({"path":name,"matches":False,"error":type(error).__name__})
    passed=bool(results) and all(item["matches"] for item in results)
    Path("p12-deployed-production.json").write_text(json.dumps({"revision":REVISION,"production":BASE,"passed":passed,"assetCount":len(results),"assets":results},indent=2),encoding="utf-8")
    if passed:
        print(f"PASS: all {len(results)} production assets match this commit byte-for-byte.")
        break
    if time.monotonic()>=DEADLINE:
        bad=[item["path"] for item in results if not item["matches"]]
        raise SystemExit("Production deployment did not converge. Mismatched assets: "+", ".join(bad))
    time.sleep(10)
