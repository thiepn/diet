"""Version-aware hourly production monitor for Diet Copilot."""
import json, re, time
from pathlib import Path
from urllib.request import Request, urlopen

BASE="https://thiepn.dev/diet/"
TIMEOUT=15
DEADLINE=time.monotonic()+360
results=[]

local_sw=Path("sw.js").read_text(encoding="utf-8")
cache_match=re.search(r"const CACHE='([^']+)'",local_sw)
if not cache_match:
    raise SystemExit("Could not parse local production service-worker cache")
expected_cache=cache_match.group(1)
local_app=json.loads(Path(".well-known/thiepn-app.json").read_text(encoding="utf-8"))

def raw_get(url,headers=None):
    request=Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Diet-P21-hourly-monitor",**(headers or {})})
    with urlopen(request,timeout=TIMEOUT) as response:
        return response.status,response.read()

def wait_for_release():
    while True:
        try:
            status,sw=raw_get(BASE+"sw.js")
            status2,app_raw=raw_get(BASE+".well-known/thiepn-app.json")
            if status==200 and status2==200:
                app=json.loads(app_raw)
                if expected_cache.encode() in sw and app.get("operationsVersion")==local_app.get("operationsVersion"):
                    return
        except Exception:
            pass
        if time.monotonic()>=DEADLINE:
            raise SystemExit("Current Diet release did not become live before monitoring deadline")
        time.sleep(10)

def check(name,condition,detail=None):
    results.append({"name":name,"passed":bool(condition),"detail":detail})
    if not condition:
        raise AssertionError(f"{name}: {detail or 'failed'}")

def get(url,headers=None):
    started=time.monotonic()
    status,body=raw_get(url,headers)
    elapsed=round((time.monotonic()-started)*1000)
    results.append({"name":"fetch "+url,"passed":status==200,"status":status,"latencyMs":elapsed,"bytes":len(body)})
    if status!=200:
        raise AssertionError(f"{url} returned {status}")
    return body,elapsed

wait_for_release()
root,_=get(BASE)
check("production stable shell",b'dc-version-badge">2.0<' in root)
check("no RC marker",b"2.0 RC" not in root)

remote_app_raw,_=get(BASE+".well-known/thiepn-app.json")
remote_app=json.loads(remote_app_raw)
check("app id",remote_app.get("app")=="diet",remote_app.get("app"))
check("operations release matches main",remote_app.get("operationsVersion")==local_app.get("operationsVersion"),remote_app.get("operationsVersion"))
check("stable release",remote_app.get("stable") is True)
check("schema drift metadata clean",remote_app.get("health",{}).get("schemaDriftDetected") is False)
check("incident writes not paused",remote_app.get("health",{}).get("writesPaused") is False)

sw_raw,_=get(BASE+"sw.js")
check("service worker matches main",expected_cache.encode() in sw_raw,expected_cache)
telemetry,_=get(BASE+"v2/telemetry.mjs")
check("local-only telemetry live",b"local-only-sanitized-operations" in telemetry)

data_source=Path("v2/data.js").read_text(encoding="utf-8")
url_match=re.search(r"DIET_V2_SUPABASE_URL='([^']+)'",data_source)
key_match=re.search(r"DIET_V2_SUPABASE_KEY='([^']+)'",data_source)
check("Supabase public config parse",bool(url_match and key_match))
auth_raw,auth_ms=get(url_match.group(1)+"/auth/v1/health",{"apikey":key_match.group(1)})
auth=json.loads(auth_raw)
check("Supabase Auth healthy",auth.get("name")=="GoTrue",{"name":auth.get("name"),"latencyMs":auth_ms})

payload={
    "checkedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
    "base":BASE,
    "operationsVersion":remote_app.get("operationsVersion"),
    "expectedCache":expected_cache,
    "passed":all(x.get("passed") for x in results),
    "checks":results,
}
Path("p21-hourly-monitor.json").write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
print("PASS: current Diet production shell, metadata, PWA and Auth health are reachable.")
