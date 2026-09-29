"""P13 hourly production health monitor: public shell + Supabase Auth health."""
import json, re, time
from pathlib import Path
from urllib.request import Request, urlopen

BASE="https://thiepn.dev/diet/"
TIMEOUT=15
results=[]

def check(name,condition,detail=None):
    results.append({"name":name,"passed":bool(condition),"detail":detail})
    if not condition:
        raise AssertionError(f"{name}: {detail or 'failed'}")

def get(path,headers=None):
    url=path if path.startswith("http") else BASE+path
    started=time.monotonic()
    request=Request(url,headers={"Cache-Control":"no-cache","User-Agent":"Diet-P13-health-monitor",**(headers or {})})
    with urlopen(request,timeout=TIMEOUT) as response:
        body=response.read()
        elapsed=round((time.monotonic()-started)*1000)
        results.append({"name":"fetch "+path,"passed":response.status==200,"status":response.status,"latencyMs":elapsed,"bytes":len(body)})
        if response.status!=200:
            raise AssertionError(f"{path} returned {response.status}")
        return body,elapsed,response.headers.get("content-type","")

root,_,_=get("")
html=root.decode("utf-8","replace")
check("production is Diet Copilot 2.0",'dc-version-badge">2.0<' in html)
check("production has no RC marker","2.0 RC" not in html)
check("production loads telemetry module path",'src="./v2/data.js"' in html)

manifest_raw,_,_=get("manifest.webmanifest")
manifest=json.loads(manifest_raw)
check("manifest production name",manifest.get("name")=="Diet Copilot 2.0",manifest.get("name"))
check("manifest standalone",manifest.get("display")=="standalone",manifest.get("display"))

sw_raw,_,_=get("sw.js")
sw=sw_raw.decode("utf-8","replace")
check("P13 production worker","diet-copilot-prod-v2-p13-1" in sw)
check("telemetry available offline","./v2/telemetry.mjs" in sw)

telemetry_raw,_,_=get("v2/telemetry.mjs")
telemetry=telemetry_raw.decode("utf-8","replace")
check("P13 telemetry module live","local-only-sanitized-operations" in telemetry)

data_source=Path("v2/data.js").read_text(encoding="utf-8")
url_match=re.search(r"DIET_V2_SUPABASE_URL='([^']+)'",data_source)
key_match=re.search(r"DIET_V2_SUPABASE_KEY='([^']+)'",data_source)
check("Supabase public config parse",bool(url_match and key_match))
auth_health=url_match.group(1)+"/auth/v1/health"
auth_raw,auth_ms,_=get(auth_health,{"apikey":key_match.group(1)})
auth=json.loads(auth_raw)
check("Supabase Auth healthy",auth.get("name")=="GoTrue",{"name":auth.get("name"),"latencyMs":auth_ms})

payload={"checkedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"base":BASE,"passed":all(x.get("passed") for x in results),"checks":results}
Path("p13-monitor.json").write_text(json.dumps(payload,indent=2),encoding="utf-8")
print("PASS: P13 production shell and Auth health are reachable.")
