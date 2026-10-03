#!/usr/bin/env python3
import argparse,hashlib,json,re
from datetime import datetime,timezone
from pathlib import Path

FORBIDDEN_PATTERNS=[
  r"\bSOC\s*2\s+certified\b",r"\bISO\s*27001\s+certified\b",
  r"\bHIPAA\s+certified\b",r"\bGDPR\s+certified\b",
  r"\bSOC\s*2\s+compliant\b",r"\bexternally\s+certified\b",
  r"\bexternal\s+attestation\s+(has\s+been\s+)?obtained\b"
]

def load(path): return json.loads(Path(path).read_text(encoding="utf-8"))
def parse_dt(v):
    if v.endswith("Z"): v=v[:-1]+"+00:00"
    dt=datetime.fromisoformat(v)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
def sha_file(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""): h.update(block)
    return h.hexdigest()
def canonical(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
def root(v): return hashlib.sha256(canonical(v)).hexdigest()
def fail(path,errors):
    out={"schemaVersion":2,"phase":"P34","status":"fail","errors":errors}
    Path(path).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":"))); raise SystemExit(1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--out",default="p34-audit-readiness-package.json")
    args=ap.parse_args()
    m=load(args.manifest); errors=[]

    if m.get("externalAttestation") is not False:
        errors.append("external_attestation_must_be_false")
    statement=m.get("readinessStatement","")
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern,statement,re.I):
            errors.append("unsupported_compliance_claim"); break
    try:
        start=parse_dt(m["periodStart"]); end=parse_dt(m["periodEnd"])
        if start>=end: errors.append("invalid_assessment_period")
    except Exception:
        errors.append("invalid_assessment_period")

    assessment_path=m.get("assessmentResultPath")
    deficiency_path=m.get("deficiencyRegisterPath")
    ledger_path=m.get("p33LedgerPath")
    anchor_path=m.get("p33AnchorPath")
    for label,path in (("assessment",assessment_path),("deficiencies",deficiency_path),("p33_ledger",ledger_path),("p33_anchor",anchor_path)):
        if not path or not Path(path).is_file(): errors.append("missing_"+label)

    artifacts=m.get("requiredArtifacts") or []
    names=[x.get("name") for x in artifacts]
    if not artifacts: errors.append("required_artifacts_empty")
    if len(names)!=len(set(names)): errors.append("duplicate_artifact_name")
    if any(not x for x in names): errors.append("artifact_name_missing")

    if errors: fail(args.out,errors)

    assessment=load(assessment_path)
    defs=load(deficiency_path)
    anchor=load(anchor_path)
    ledger_bytes=Path(ledger_path).read_bytes()
    ledger_sha=hashlib.sha256(ledger_bytes).hexdigest()
    ledger_entries=[json.loads(x) for x in ledger_bytes.decode("utf-8").splitlines() if x.strip()]
    if assessment.get("status")!="pass": errors.append("assurance_assessment_not_valid")
    if assessment.get("auditReady") is True and m.get("readinessLevel",0)<4:
        errors.append("audit_ready_assessment_level_mismatch")
    if ledger_sha!=anchor.get("ledgerSha256"): errors.append("p33_anchor_ledger_sha_mismatch")
    if len(ledger_entries)!=anchor.get("entryCount"): errors.append("p33_anchor_entry_count_mismatch")
    if not ledger_entries or ledger_entries[-1].get("entryHash")!=anchor.get("headHash"):
        errors.append("p33_anchor_head_mismatch")

    open_ids=sorted(d["id"] for d in defs.get("items",[]) if d.get("state")!="closed")
    if sorted(m.get("openDeficiencyIds") or [])!=open_ids:
        errors.append("open_deficiency_set_mismatch")

    resolved=[]; missing=[]
    for item in sorted(artifacts,key=lambda x:x["name"]):
        p=Path(item["path"])
        if not p.is_file(): missing.append(item["name"]); continue
        resolved.append({
          "name":item["name"],"path":item["path"],"kind":item.get("kind","file"),
          "sha256":sha_file(p),"bytes":p.stat().st_size
        })
    if missing: errors.append("missing_artifacts:"+",".join(missing))
    if errors: fail(args.out,errors)

    package={
      "schemaVersion":2,"phase":"P34","status":"pass",
      "scope":m["scope"],"periodStart":m["periodStart"],"periodEnd":m["periodEnd"],
      "readinessStatement":statement,"readinessLevel":m.get("readinessLevel"),
      "externalAttestation":False,
      "frameworkMappings":m.get("frameworkMappings",[]),
      "assessment":{
        "path":assessment_path,"sha256":sha_file(assessment_path),
        "assessmentDigest":assessment.get("assessmentDigest"),
        "auditReady":assessment.get("auditReady"),
        "controlCount":assessment.get("controlCount"),
        "openDeficiencyCount":assessment.get("openDeficiencyCount")
      },
      "openDeficiencyIds":open_ids,
      "p33Evidence":{
        "ledgerPath":ledger_path,"ledgerSha256":ledger_sha,
        "anchorPath":anchor_path,"anchorSha256":sha_file(anchor_path),
        "headHash":anchor.get("headHash"),"entryCount":anchor.get("entryCount")
      },
      "artifacts":resolved
    }
    package["rootHash"]=root(package)
    Path(args.out).write_text(json.dumps(package,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(package,separators=(",",":")))

if __name__=="__main__": main()
