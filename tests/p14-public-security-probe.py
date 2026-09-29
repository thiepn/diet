"""P14 public security probe. Uses only the public publishable key and no user credentials."""
import json,re
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request,urlopen

source=Path("v2/data.js").read_text(encoding="utf-8")
url_match=re.search(r"DIET_V2_SUPABASE_URL='([^']+)'",source)
key_match=re.search(r"DIET_V2_SUPABASE_KEY='([^']+)'",source)
if not url_match or not key_match:
    raise SystemExit("Could not parse public Supabase configuration.")
base=url_match.group(1)
key=key_match.group(1)
if not key.startswith("sb_publishable_"):
    raise SystemExit("Diet browser config is not using a publishable key.")

evidence=[]

def request(name,url,method="GET",payload=None):
    body=None if payload is None else json.dumps(payload).encode()
    req=Request(url,data=body,method=method,headers={
        "apikey":key,
        "Accept":"application/json",
        "Content-Type":"application/json",
        "User-Agent":"Diet-P14-public-security-probe"
    })
    try:
        with urlopen(req,timeout=15) as response:
            data=response.read().decode("utf-8","replace")
            status=response.status
    except HTTPError as error:
        status=error.code
        data=error.read().decode("utf-8","replace")
    evidence.append({"name":name,"status":status,"bodyPrefix":data[:240]})
    return status,data

status,body=request("auth health",base+"/auth/v1/health")
if status!=200:
    raise SystemExit(f"Auth health failed: {status}")

status,body=request("anonymous table read",base+"/rest/v1/profiles?select=user_id&limit=1")
if 200<=status<300:
    raise SystemExit("Anonymous key unexpectedly has direct Diet table SELECT access.")
if status not in (401,403,404):
    raise SystemExit(f"Unexpected anonymous table-read response: {status} {body[:160]}")

status,body=request(
    "anonymous RPC execute",
    base+"/rest/v1/rpc/diet_app_log_meal",
    "POST",
    {
      "p_log_date":"2026-09-29",
      "p_meal_type":"Snack",
      "p_title":"P14 security probe",
      "p_items":[{"name":"probe","calories":1,"protein":0}],
      "p_request_id":"app:p14:public-probe-0001"
    }
)
if 200<=status<300 or status==400:
    raise SystemExit("Anonymous key reached the authenticated Diet RPC boundary.")
if status not in (401,403,404):
    raise SystemExit(f"Unexpected anonymous RPC response: {status} {body[:160]}")

Path("p14-public-security.json").write_text(json.dumps({"passed":True,"checks":evidence},indent=2),encoding="utf-8")
print("PASS: public key cannot read Diet tables or execute Diet write RPCs.")
