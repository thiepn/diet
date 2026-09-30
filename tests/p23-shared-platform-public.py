#!/usr/bin/env python3
import json, re, time, urllib.error, urllib.request
from pathlib import Path

BASE="https://thiepn.dev/diet/"
SUPABASE="https://hycegznamzjhwinegaai.supabase.co"
TIMEOUT=20
source=Path("v2/data.js").read_text(encoding="utf-8")
match=re.search(r"DIET_V2_SUPABASE_KEY='(sb_publishable_[A-Za-z0-9_-]+)'",source)
if not match:
    raise SystemExit("P23 probe could not find publishable key")
key=match.group(1)
checks=[]

def record(name,passed,**detail):
    checks.append({"name":name,"passed":bool(passed),**detail})
    if not passed:
        raise AssertionError(f"{name}: {detail}")

def request(url,method="GET",body=None,headers=None):
    req=urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"User-Agent":"Diet-Copilot-P23-Platform-Probe/1","Cache-Control":"no-cache",**(headers or {})},
    )
    try:
        with urllib.request.urlopen(req,timeout=TIMEOUT) as response:
            return response.status,response.read()
    except urllib.error.HTTPError as exc:
        return exc.code,exc.read()

status,body=request(BASE)
record("Diet production shell reachable",status==200,status=status,bytes=len(body))

status,auth=request(SUPABASE+"/auth/v1/health",headers={"apikey":key})
auth_obj=json.loads(auth.decode("utf-8","replace")) if status==200 else {}
record("shared Auth healthy",status==200 and auth_obj.get("name")=="GoTrue",status=status,serviceName=auth_obj.get("name"))

status,health=request(SUPABASE+"/functions/v1/platform-health")
health_obj=json.loads(health.decode("utf-8","replace")) if status in (200,503) else {}
record(
    "platform-health Edge Function healthy",
    status==200 and health_obj.get("status")=="healthy",
    status=status,
    platformStatus=health_obj.get("status"),
    authStatus=(health_obj.get("checks") or {}).get("auth",{}).get("status"),
    databaseStatus=(health_obj.get("checks") or {}).get("database",{}).get("status"),
)

status,body=request(
    SUPABASE+"/rest/v1/rpc/platform_p23_upgrade_status",
    method="POST",
    body=b"{}",
    headers={
        "apikey":key,
        "Authorization":"Bearer "+key,
        "Content-Type":"application/json",
        "Accept":"application/json",
    },
)
record("P23 operator RPC denied to public client",status in (401,403),status=status,returnedData=status==200)

payload={
    "checkedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
    "passed":all(x["passed"] for x in checks),
    "checks":checks,
}
Path("p23-shared-platform-public.json").write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
print(json.dumps(payload,separators=(",",":")))
