#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path

FORBIDDEN=("soc 2 certified","soc 2 compliant","iso 27001 certified","audit certified","externally attested")

def sha(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()
def canon(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--plan",default="platform-p35-audit-dry-run-plan.json")
    ap.add_argument("--out",default="p35-audit-dry-run-result.json")
    args=ap.parse_args()
    plan=json.loads(Path(args.plan).read_text())
    m=json.loads(Path(args.manifest).read_text())
    errors=[]
    statement=(m.get("statement") or "").lower()
    if any(x in statement for x in FORBIDDEN): errors.append("unsupported_external_claim")
    if m.get("externalAttestation") is not False: errors.append("external_attestation_must_be_false")
    required=set(plan["requiredSections"])
    sections=m.get("sections") or {}
    missing=sorted(required-set(sections))
    if missing: errors.append("missing_sections:"+",".join(missing))
    artifacts=[]
    for name,path in sorted((m.get("artifacts") or {}).items()):
        p=Path(path)
        if not p.is_file():
            errors.append("missing_artifact:"+name);continue
        artifacts.append({"name":name,"path":path,"sha256":sha(p),"bytes":p.stat().st_size})
    if int(m.get("periodDays",0))<30: errors.append("period_shorter_than_dry_run_minimum")
    if m.get("operatingEffectivenessStatus")!="pass": errors.append("operating_effectiveness_not_pass")
    if m.get("unexplainedFailures",0)!=0: errors.append("unexplained_control_failures")
    if any(x.get("state")=="closed" and not x.get("retestEvidence") for x in m.get("deficiencies",[])):
        errors.append("closed_deficiency_without_retest")
    out={
      "schemaVersion":1,"phase":"P35",
      "status":"pass" if not errors else "fail",
      "dryRunCertified":not errors,
      "certificationMeaning":plan["certificationMeaning"],
      "externalAttestation":False,
      "artifacts":artifacts,"errors":errors
    }
    out["rootHash"]=hashlib.sha256(canon(out)).hexdigest()
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
