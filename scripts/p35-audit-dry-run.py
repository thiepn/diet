#!/usr/bin/env python3
import argparse,hashlib,json,re
from pathlib import Path

FORBIDDEN=[
 r"\bSOC\s*2\s+(certified|compliant)\b",
 r"\bISO\s*27001\s+certified\b",
 r"\bHIPAA\s+certified\b",
 r"\bGDPR\s+certified\b",
 r"\bexternal(ly)?\s+(audit|attestation|certification)\s+(passed|obtained|complete)\b"
]

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def file_sha(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for b in iter(lambda:f.read(1048576),b""): h.update(b)
    return h.hexdigest()
def canon(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
def hash_obj(v): return hashlib.sha256(canon(v)).hexdigest()
def is_hash(v): return isinstance(v,str) and len(v)==64 and all(c in "0123456789abcdef" for c in v)

def fail(out,errors):
    x={"schemaVersion":2,"phase":"P35","status":"fail","dryRunPass":False,"externalAttestation":False,"errors":sorted(set(errors))}
    Path(out).write_text(json.dumps(x,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(x,separators=(",",":"))); raise SystemExit(1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--plan",default="platform-p35-audit-dry-run-plan.json")
    ap.add_argument("--out",default="p35-audit-dry-run-result.json")
    a=ap.parse_args()
    m=load(a.manifest); plan=load(a.plan); errors=[]
    mode=m.get("mode")
    if mode not in ("simulation","operating"): errors.append("invalid_dry_run_mode")
    if m.get("externalAttestation") is not False: errors.append("external_attestation_must_be_false")
    statement=m.get("statement","")
    if any(re.search(p,statement,re.I) for p in FORBIDDEN): errors.append("unsupported_compliance_claim")

    paths={
      "oe":m.get("operatingEffectivenessResultPath"),
      "p34":m.get("p34AssessmentResultPath"),
      "remediation":m.get("remediationAssessmentPath"),
      "deficiencies":m.get("deficiencyRegisterPath"),
      "ledger":m.get("p33LedgerPath"),
      "anchor":m.get("p33AnchorPath")
    }
    for key,p in paths.items():
        if not p or not Path(p).is_file(): errors.append("missing_"+key)
    if errors: fail(a.out,errors)

    oe=load(paths["oe"]); p34=load(paths["p34"]); rem=load(paths["remediation"]); defs=load(paths["deficiencies"]); anchor=load(paths["anchor"])
    if oe.get("status")!="pass": errors.append("operating_effectiveness_result_invalid")
    if rem.get("status")!="pass": errors.append("remediation_assessment_invalid")
    if p34.get("status")!="pass": errors.append("p34_assessment_invalid")
    if mode=="simulation":
        if oe.get("mode")!="simulation" or oe.get("simulationPass") is not True: errors.append("simulation_oe_result_required")
        if oe.get("operatingEffectivenessProven") is not False: errors.append("simulation_cannot_prove_operating_effectiveness")
    if mode=="operating":
        if oe.get("mode")!="operating" or oe.get("operatingEffectivenessPass") is not True: errors.append("operating_oe_result_required")

    ledger_bytes=Path(paths["ledger"]).read_bytes()
    ledger_sha=hashlib.sha256(ledger_bytes).hexdigest()
    ledger=[json.loads(x) for x in ledger_bytes.decode("utf-8").splitlines() if x.strip()]
    if ledger_sha!=anchor.get("ledgerSha256"): errors.append("p33_ledger_anchor_sha_mismatch")
    if len(ledger)!=anchor.get("entryCount"): errors.append("p33_ledger_anchor_count_mismatch")
    if not ledger or ledger[-1].get("entryHash")!=anchor.get("headHash"): errors.append("p33_ledger_anchor_head_mismatch")

    required=set(plan.get("requiredSections") or [])
    sections=m.get("sections") or {}
    missing=sorted(x for x in required if (sections.get(x) or {}).get("status")!="present")
    if missing: errors.append("missing_sections:"+",".join(missing))

    for d in defs.get("items",[]):
        if d.get("state")=="closed":
            hashes=d.get("closureEvidenceHashes") or []
            if not d.get("retestAt") or not d.get("closedAt") or not hashes or not all(is_hash(x) for x in hashes):
                errors.append("closed_deficiency_without_retest:"+d.get("id","unknown"))

    artifacts=m.get("artifacts") or {}
    if not artifacts: errors.append("artifacts_required")
    resolved={}
    for name,path in sorted(artifacts.items()):
        if not Path(path).is_file():
            errors.append("missing_artifact:"+name); continue
        resolved[name]={"path":path,"sha256":file_sha(path),"bytes":Path(path).stat().st_size}
    if errors: fail(a.out,errors)

    material={
      "mode":mode,"statement":statement,"periodId":oe.get("periodId"),
      "oeDigest":oe.get("resultDigest"),"p34AssessmentDigest":p34.get("assessmentDigest"),
      "remediationDigest":rem.get("assessmentDigest"),
      "p33HeadHash":anchor.get("headHash"),"p33LedgerSha256":ledger_sha,
      "sections":sections,"artifacts":resolved
    }
    cert=hash_obj(material)
    out={
      "schemaVersion":2,"phase":"P35","status":"pass","mode":mode,
      "dryRunPass":True,
      "certificateType":"internal_simulation_only" if mode=="simulation" else "internal_actual_period_dry_run",
      "dryRunCertificateId":cert,
      "operatingEffectivenessProven":bool(oe.get("operatingEffectivenessProven")),
      "auditReady":False,
      "externalAttestation":False,
      "openDeficiencyCount":sum(1 for d in defs.get("items",[]) if d.get("state")!="closed"),
      "p33Evidence":{"ledgerSha256":ledger_sha,"anchorSha256":file_sha(paths["anchor"]),"headHash":anchor.get("headHash"),"entryCount":anchor.get("entryCount")},
      "artifacts":resolved,
      "errors":[]
    }
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__": main()
