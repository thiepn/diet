#!/usr/bin/env python3
import argparse, json, re, time, urllib.error, urllib.request
from pathlib import Path

BASE="https://thiepn.dev/diet/"
SUPABASE="https://hycegznamzjhwinegaai.supabase.co"
TIMEOUT=10
AUTH_INTERNAL_WARN_MS=1422
DB_INTERNAL_WARN_MS=2100

def request(url,method="GET",body=None,headers=None):
    started=time.perf_counter()
    req=urllib.request.Request(
        url,data=body,method=method,
        headers={"User-Agent":"Diet-P26-SteadyState/1","Cache-Control":"no-cache",**(headers or {})},
    )
    try:
        with urllib.request.urlopen(req,timeout=TIMEOUT) as r:
            return r.status,r.read(),round((time.perf_counter()-started)*1000,1)
    except urllib.error.HTTPError as e:
        return e.code,e.read(),round((time.perf_counter()-started)*1000,1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--out",default="p26-public-steady-state.json")
    args=ap.parse_args()

    plan=json.loads(Path("platform-p26-steady-state-plan.json").read_text(encoding="utf-8"))
    source=Path("v2/data.js").read_text(encoding="utf-8")
    m=re.search(r"DIET_V2_SUPABASE_KEY='(sb_publishable_[A-Za-z0-9_-]+)'",source)
    if not m:
        raise SystemExit("publishable key not found")
    key=m.group(1)
    checks=[]

    def record(name,passed,**detail):
        checks.append({"name":name,"passed":bool(passed),**detail})

    status,body,lat=request(BASE)
    record("diet_shell",status==200,status=status,endToEndLatencyMs=lat,bytes=len(body))

    status,body,lat=request(SUPABASE+"/auth/v1/health",headers={"apikey":key})
    auth=json.loads(body.decode("utf-8","replace")) if status==200 else {}
    record("auth_health",status==200 and auth.get("name")=="GoTrue",status=status,endToEndLatencyMs=lat)

    status,body,lat=request(SUPABASE+"/functions/v1/platform-health")
    health=json.loads(body.decode("utf-8","replace")) if status in (200,503) else {}
    checks_obj=health.get("checks") or {}
    auth_ms=(checks_obj.get("auth") or {}).get("latencyMs")
    db_ms=(checks_obj.get("database") or {}).get("latencyMs")
    record(
        "platform_health",
        status==200 and health.get("status")=="healthy",
        status=status,
        platformStatus=health.get("status"),
        endToEndLatencyMs=lat,
        authLatencyMs=auth_ms,
        databaseLatencyMs=db_ms,
        authLatencyWarning=isinstance(auth_ms,(int,float)) and auth_ms>AUTH_INTERNAL_WARN_MS,
        databaseLatencyWarning=isinstance(db_ms,(int,float)) and db_ms>DB_INTERNAL_WARN_MS,
    )

    for rpc in (
        "platform_p23_upgrade_status",
        "platform_p24_execution_status",
        "platform_p24_post_upgrade_status",
    ):
        status,_,lat=request(
            SUPABASE+"/rest/v1/rpc/"+rpc,
            method="POST",body=b"{}",
            headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Accept":"application/json"},
        )
        record(rpc+"_service_only",status in (401,403),status=status,endToEndLatencyMs=lat)

    payload={
        "schemaVersion":1,
        "phase":"P26",
        "state":plan.get("state","unknown"),
        "activeOperationsRelease":plan.get("activeOperationsRelease"),
        "checkedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
        "passed":all(x["passed"] for x in checks),
        "performanceWarning":any(
            x.get("authLatencyWarning") or x.get("databaseLatencyWarning") for x in checks
        ),
        "thresholds":{
            "authInternalWarningMs":AUTH_INTERNAL_WARN_MS,
            "databaseInternalWarningMs":DB_INTERNAL_WARN_MS
        },
        "checks":checks,
    }
    Path(args.out).write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(payload,separators=(",",":")))
    if not payload["passed"]:
        raise SystemExit(1)

if __name__=="__main__":
    main()
