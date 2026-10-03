#!/usr/bin/env python3
import argparse,json,re,time,urllib.error,urllib.request
from pathlib import Path

BASE="https://thiepn.dev/diet/"
SUPABASE="https://hycegznamzjhwinegaai.supabase.co"
TIMEOUT=10

def req(url,method="GET",body=None,headers=None):
    started=time.perf_counter()
    r=urllib.request.Request(url,data=body,method=method,headers={
        "User-Agent":"Diet-P27-SLO/2","Cache-Control":"no-cache",**(headers or {})
    })
    try:
        with urllib.request.urlopen(r,timeout=TIMEOUT) as x:
            return x.status,x.read(),round((time.perf_counter()-started)*1000,1)
    except urllib.error.HTTPError as e:
        return e.code,e.read(),round((time.perf_counter()-started)*1000,1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--out",default="p27-public-slo.json")
    args=ap.parse_args()
    plan=json.loads(Path("platform-p27-capacity-slo-plan.json").read_text(encoding="utf-8"))
    src=Path("v2/data.js").read_text(encoding="utf-8")
    m=re.search(r"DIET_V2_SUPABASE_KEY='(sb_publishable_[A-Za-z0-9_-]+)'",src)
    if not m: raise SystemExit("publishable key not found")
    key=m.group(1)
    checks=[]

    def add(name,ok,**d): checks.append({"name":name,"passed":bool(ok),**d})

    st,body,lat=req(BASE)
    add("diet_shell",st==200,status=st,latencyMs=lat)

    st,body,lat=req(SUPABASE+"/auth/v1/health",headers={"apikey":key})
    auth=json.loads(body.decode("utf-8","replace")) if st==200 else {}
    add("auth_health",st==200 and auth.get("name")=="GoTrue",status=st,latencyMs=lat)

    st,body,lat=req(SUPABASE+"/functions/v1/platform-health")
    health=json.loads(body.decode("utf-8","replace")) if st in (200,503) else {}
    health_checks=health.get("checks") or {}
    add("platform_health",st==200 and health.get("status")=="healthy",
        status=st,latencyMs=lat,platformStatus=health.get("status"),
        authLatencyMs=(health_checks.get("auth") or {}).get("latencyMs"),
        databaseLatencyMs=(health_checks.get("database") or {}).get("latencyMs"))

    for rpc in ("platform_p23_upgrade_status","platform_p24_execution_status","platform_p24_post_upgrade_status"):
        st,_,lat=req(SUPABASE+"/rest/v1/rpc/"+rpc,method="POST",body=b"{}",
                     headers={"apikey":key,"Authorization":"Bearer "+key,
                              "Content-Type":"application/json","Accept":"application/json"})
        add(rpc+"_service_only",st in (401,403),status=st,latencyMs=lat)

    out={
        "schemaVersion":2,
        "phase":"P27",
        "state":plan.get("state"),
        "checkedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
        "passed":all(x["passed"] for x in checks),
        "candidateSlo":plan.get("sloPolicy"),
        "autonomyLevel":plan.get("autonomyModel",{}).get("activeLevel"),
        "productionMutationAllowed":False,
        "checks":checks
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if not out["passed"]: raise SystemExit(1)

if __name__=="__main__": main()
