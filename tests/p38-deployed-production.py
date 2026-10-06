"""P38: wait until the public stable Diet Copilot artifact matches this checkout exactly."""
import hashlib, json, os, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

BASE="https://thiepn.dev/diet/"
ROOT=Path(".")
FILES={
    "index.html","manifest.webmanifest","sw.js",
    ".well-known/thiepn-app.json",".well-known/thiepn-account-release.json",
    "legacy-v1.html","legacy-v1-app.js","diet-app.js","diet.css",
    "vendor/supabase-2.116.0.js","icon.svg","icon-192.png","icon-512.png"
}
FILES.update("v2/"+str(path.relative_to("v2")).replace("\\","/") for path in Path("v2").rglob("*") if path.is_file())
FILES=sorted(FILES)
REVISION=os.environ.get("GITHUB_SHA","manual")
DEADLINE=time.monotonic()+480

def digest(data):
    return hashlib.sha256(data).hexdigest()

expected={name:digest((ROOT/name).read_bytes()) for name in FILES}

def fetch_one(name):
    try:
        req=Request(BASE+name+"?p38_verify="+REVISION,headers={"Cache-Control":"no-cache","User-Agent":"Diet-P38-release-candidate"})
        with urlopen(req,timeout=15) as response:
            body=response.read()
            actual=digest(body)
            return {"path":name,"status":response.status,"sha256":actual,"expected":expected[name],"matches":actual==expected[name]}
    except Exception as error:
        return {"path":name,"matches":False,"error":type(error).__name__}

while True:
    with ThreadPoolExecutor(max_workers=12) as pool:
        results=list(pool.map(fetch_one,FILES))
    passed=bool(results) and all(item["matches"] for item in results)
    evidence={"revision":REVISION,"production":BASE,"passed":passed,"assetCount":len(results),"assets":results}
    Path("p38-deployed-production.json").write_text(json.dumps(evidence,indent=2),encoding="utf-8")
    if passed:
        print(f"PASS: all {len(results)} P38 production assets match this commit byte-for-byte.")
        break
    if time.monotonic()>=DEADLINE:
        bad=[item["path"] for item in results if not item["matches"]]
        raise SystemExit("P38 production deployment did not converge. Mismatched assets: "+", ".join(bad))
    time.sleep(10)
