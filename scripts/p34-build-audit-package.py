#!/usr/bin/env python3
import argparse, hashlib, json
from pathlib import Path

FORBIDDEN_CLAIMS=("certified","soc 2 compliant","iso 27001 compliant","audit passed")

def file_sha(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()

def canon(v):
    return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--out",default="p34-audit-readiness-package.json")
    args=ap.parse_args()
    m=json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    errors=[]
    if not m.get("scope") or not m.get("periodStart") or not m.get("periodEnd"):
        errors.append("scope_and_period_required")
    statement=(m.get("readinessStatement") or "").lower()
    if any(x in statement for x in FORBIDDEN_CLAIMS):
        errors.append("unsupported_external_compliance_claim")
    if m.get("externalAttestation") is not False:
        errors.append("external_attestation_must_be_false_for_p34_staging")

    artifacts=[];missing=[]
    for x in sorted(m.get("requiredArtifacts",[]),key=lambda x:x["name"]):
        p=Path(x["path"])
        if not p.is_file():
            missing.append(x["name"]);continue
        artifacts.append({"name":x["name"],"path":x["path"],"sha256":file_sha(p),"bytes":p.stat().st_size})
    if missing: errors.append("missing_artifacts:"+",".join(missing))

    pack={
      "schemaVersion":1,"phase":"P34",
      "status":"fail" if errors else "pass",
      "scope":m.get("scope"),"periodStart":m.get("periodStart"),"periodEnd":m.get("periodEnd"),
      "readinessStatement":m.get("readinessStatement"),
      "externalAttestation":False,
      "frameworkMappings":m.get("frameworkMappings",[]),
      "openDeficiencyIds":sorted(m.get("openDeficiencyIds",[])),
      "artifacts":artifacts,"errors":errors
    }
    pack["rootHash"]=hashlib.sha256(canon(pack)).hexdigest()
    Path(args.out).write_text(json.dumps(pack,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(pack,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
