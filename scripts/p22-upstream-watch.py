#!/usr/bin/env python3
import argparse, json, os, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
lock=json.loads((ROOT/"supply-chain.lock.json").read_text(encoding="utf-8"))
parser=argparse.ArgumentParser()
parser.add_argument("--out",default="p22-upstream-watch.json")
args=parser.parse_args()
errors=[]

def get_json(url,provider):
    headers={"User-Agent":"Diet-Copilot-P22-Upstream-Watch/1"}
    if provider=="github":
        headers["Accept"]="application/vnd.github+json"
        token=os.environ.get("GITHUB_TOKEN","").strip()
        if token:
            headers["Authorization"]="Bearer "+token
        headers["X-GitHub-Api-Version"]="2022-11-28"
    elif provider=="npm":
        headers["Accept"]="application/json"
    req=urllib.request.Request(url,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=20) as r:
            return json.load(r)
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError) as exc:
        errors.append({"provider":provider,"url":url,"error":type(exc).__name__,"detail":str(exc)})
        print(f"::warning::{provider} upstream check unavailable: {exc}")
        return None

action_updates=[]
for action,item in lock["githubActions"].items():
    owner,name=action.split("/",1)
    tag=item["trackedTag"]
    url=f"https://api.github.com/repos/{owner}/{name}/git/ref/tags/{urllib.parse.quote(tag,safe='')}"
    data=get_json(url,"github")
    current=(data or {}).get("object",{}).get("sha")
    changed=bool(current and current!=item["sha"])
    unavailable=current is None
    action_updates.append({
        "action":action,
        "tag":tag,
        "pinnedSha":item["sha"],
        "tagSha":current,
        "reviewRecommended":changed,
        "upstreamUnavailable":unavailable
    })
    if changed:
        print(f"::warning::{action}@{tag} now points to {current}; reviewed pin is {item['sha']}")

pkg=lock["vendoredRuntime"][0]
npm=get_json("https://registry.npmjs.org/%40supabase%2Fsupabase-js/latest","npm")
latest=(npm or {}).get("version")
vendor_update=bool(latest and latest!=pkg["version"])
if vendor_update:
    print(f"::warning::@supabase/supabase-js latest is {latest}; vendored runtime remains reviewed at {pkg['version']}")

review=vendor_update or any(x["reviewRecommended"] for x in action_updates)
result={
  "release":"P22",
  "actionUpdates":action_updates,
  "supabaseJs":{
    "vendored":pkg["version"],
    "latest":latest,
    "reviewRecommended":vendor_update,
    "upstreamUnavailable":npm is None
  },
  "reviewRecommended":review,
  "upstreamChecksComplete":not errors,
  "errors":errors
}
Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,separators=(",",":")))
