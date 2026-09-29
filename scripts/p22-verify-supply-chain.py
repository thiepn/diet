#!/usr/bin/env python3
import argparse, hashlib, json, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LOCK_PATH=ROOT/"supply-chain.lock.json"
parser=argparse.ArgumentParser()
parser.add_argument("--out",default=None)
args=parser.parse_args()
lock=json.loads(LOCK_PATH.read_text(encoding="utf-8"))
checks=[]

def check(name,condition,detail=None):
    row={"name":name,"passed":bool(condition)}
    if detail is not None: row["detail"]=detail
    checks.append(row)
    if not condition:
        raise AssertionError(f"{name}: {detail or 'failed'}")

for item in lock["vendoredRuntime"]:
    path=ROOT/item["path"]
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    check("vendored hash "+item["package"],digest==item["sha256"],{"expected":item["sha256"],"actual":digest,"path":item["path"]})

vendor_readme=(ROOT/"vendor/README.md").read_text(encoding="utf-8")
check("vendored Supabase source version documented","@supabase/supabase-js@2.116.0" in vendor_readme or "Supabase JS 2.116.0" in vendor_readme)

allowed=lock["githubActions"]
seen=set()
floating=[]
unexpected=[]
mismatched=[]
dangerous=[]
for path in sorted((ROOT/".github/workflows").glob("*.yml")):
    text=path.read_text(encoding="utf-8")
    if re.search(r"(?:curl|wget)[^\n]*\|\s*(?:sh|bash)\b",text,re.I):
        dangerous.append(str(path.relative_to(ROOT)))
    for line in text.splitlines():
        m=re.search(r"\buses:\s*([^\s#]+)",line)
        if not m: continue
        ref=m.group(1)
        if ref.startswith("./"): continue
        if "@" not in ref:
            floating.append({"file":str(path.relative_to(ROOT)),"ref":ref})
            continue
        action,revision=ref.rsplit("@",1)
        if action not in allowed:
            unexpected.append({"file":str(path.relative_to(ROOT)),"ref":ref})
            continue
        seen.add(action)
        if not re.fullmatch(r"[0-9a-f]{40}",revision):
            floating.append({"file":str(path.relative_to(ROOT)),"ref":ref})
        elif revision!=allowed[action]["sha"]:
            mismatched.append({"file":str(path.relative_to(ROOT)),"action":action,"expected":allowed[action]["sha"],"actual":revision})

check("all external actions immutable",not floating,floating)
check("all external actions allowlisted",not unexpected,unexpected)
check("action pins match reviewed lock",not mismatched,mismatched)
check("every locked action is used",seen==set(allowed),{"seen":sorted(seen),"locked":sorted(allowed)})
check("no pipe-to-shell workflow install",not dangerous,dangerous)

for path in [ROOT/"index.html",ROOT/"v2/index.html"]:
    text=path.read_text(encoding="utf-8")
    remote=re.findall(r"<script[^>]+src=[\"'](https?://[^\"']+)",text,re.I)
    check("no remote runtime scripts "+str(path.relative_to(ROOT)),not remote,remote)

remote_imports=[]
for path in (ROOT/"v2").rglob("*"):
    if path.suffix not in {".js",".mjs"}: continue
    text=path.read_text(encoding="utf-8")
    for m in re.finditer(r"(?:from\s+|import\s*\()\s*[\"'](https?://[^\"']+)",text):
        remote_imports.append({"file":str(path.relative_to(ROOT)),"url":m.group(1)})
check("no remote ESM runtime imports",not remote_imports,remote_imports)

playwright_versions=set()
for path in (ROOT/".github/workflows").glob("*.yml"):
    text=path.read_text(encoding="utf-8")
    playwright_versions.update(re.findall(r"playwright==([0-9.]+)",text))
expected=lock["ciTools"]["playwright"]["version"]
check("Playwright CI version pinned exactly",not playwright_versions or playwright_versions=={expected},{"expected":expected,"seen":sorted(playwright_versions)})

dependabot=(ROOT/".github/dependabot.yml").read_text(encoding="utf-8")
check("Dependabot tracks GitHub Actions",'package-ecosystem: "github-actions"' in dependabot and 'interval: "weekly"' in dependabot)

result={"release":"P22","passed":all(x["passed"] for x in checks),"checks":checks}
if args.out:
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,separators=(",",":")))
