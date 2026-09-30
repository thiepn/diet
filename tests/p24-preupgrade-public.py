#!/usr/bin/env python3
import json, re, time, urllib.error, urllib.request
from pathlib import Path

SUPABASE="https://hycegznamzjhwinegaai.supabase.co"
TIMEOUT=20
source=Path("v2/data.js").read_text(encoding="utf-8")
match=re.search(r"DIET_V2_SUPABASE_KEY='(sb_publishable_[A-Za-z0-9_-]+)'",source)
if not match:
    raise SystemExit("P24 probe could not find publishable key")
key=match.group(1)
checks=[]

def record(name,passed,**detail):
    checks.append({"name":name,"passed":bool(passed),**detail})
    if not passed: raise AssertionError(f"{name}: {detail}")

def request(url,method="GET",body=None,headers=None):
    req=urllib.request.Request(url,data=body,method=method,headers={
      "User-Agent":"Diet-P24-Preupgrade/1","Cache-Control":"no-cache",**(headers or {})
    })
    try:
        with urllib.request.urlopen(req,timeout=TIMEOUT) as r:
            return r.status,r.read()
    except urllib.error.HTTPError as e:
        return e.code,e.read()

status,auth=request(SUPABASE+"/auth/v1/health",headers={"apikey":key})
obj=json.loads(auth.decode("utf-8","replace")) if status==200 else {}
record("shared Auth healthy",status==200 and obj.get("name")=="GoTrue",status=status)

status,health=request(SUPABASE+"/functions/v1/platform-health")
h=json.loads(health.decode("utf-8","replace")) if status in (200,503) else {}
record("platform-health healthy",status==200 and h.get("status")=="healthy",status=status,platformStatus=h.get("status"))

status,body=request(
  SUPABASE+"/rest/v1/rpc/platform_p24_execution_status",
  method="POST",body=b"{}",
  headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Accept":"application/json"}
)
record("P24 execution status denied to public client",status in (401,403),status=status,returnedData=status==200)

payload={"checkedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"passed":all(x["passed"] for x in checks),"checks":checks}
Path("p24-preupgrade-public.json").write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
print(json.dumps(payload,separators=(",",":")))
