#!/usr/bin/env python3
import argparse, json, urllib.request, urllib.parse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
lock=json.loads((ROOT/"supply-chain.lock.json").read_text(encoding="utf-8"))
parser=argparse.ArgumentParser()
parser.add_argument("--out",default="p22-upstream-watch.json")
args=parser.parse_args()

def get_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Diet-Copilot-P22-Upstream-Watch/1","Accept":"application/vnd.github+json"})
    with urllib.request.urlopen(req,timeout=20) as r:
        return json.load(r)

action_updates=[]
for action,item in lock["githubActions"].items():
    owner,name=action.split("/",1)
    tag=item["trackedTag"]
    data=get_json(f"https://api.github.com/repos/{owner}/{name}/git/ref/tags/{urllib.parse.quote(tag,safe='')}")
    current=data.get("object",{}).get("sha")
    changed=bool(current and current!=item["sha"])
    action_updates.append({"action":action,"tag":tag,"pinnedSha":item["sha"],"tagSha":current,"reviewRecommended":changed})
    if changed:
        print(f"::warning::{action}@{tag} now points to {current}; reviewed pin is {item['sha']}")

pkg=lock["vendoredRuntime"][0]
npm=get_json("https://registry.npmjs.org/%40supabase%2Fsupabase-js/latest")
latest=npm.get("version")
vendor_update=bool(latest and latest!=pkg["version"])
if vendor_update:
    print(f"::warning::@supabase/supabase-js latest is {latest}; vendored runtime remains reviewed at {pkg['version']}")

result={
  "release":"P22",
  "actionUpdates":action_updates,
  "supabaseJs":{"vendored":pkg["version"],"latest":latest,"reviewRecommended":vendor_update},
  "reviewRecommended":vendor_update or any(x["reviewRecommended"] for x in action_updates)
}
Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,separators=(",",":")))
