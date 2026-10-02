#!/usr/bin/env python3
import argparse, json
from collections import Counter
from pathlib import Path

VALID_STATES={"pass","partial","review","gap","not_tested"}

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--catalog",default="platform-p34-control-catalog.json")
    ap.add_argument("--snapshot",default="platform-p34-assurance-snapshot.json")
    ap.add_argument("--deficiencies",default="platform-p34-deficiency-register.json")
    ap.add_argument("--out",default="p34-assurance-result.json")
    args=ap.parse_args()

    catalog=load(args.catalog); snap=load(args.snapshot); defs=load(args.deficiencies)
    errors=[]

    controls=catalog.get("controls",[])
    ids=[c.get("id") for c in controls]
    if len(controls)!=18: errors.append("control_count_must_be_18")
    if len(set(ids))!=len(ids): errors.append("duplicate_control_id")
    for c in controls:
        for field in ("id","title","owner","objective","nist","soc2","frequency","evidence","test"):
            if not c.get(field): errors.append(f"control_missing_{field}:{c.get('id')}")
        if not set(c.get("nist",[])).issubset({"GOVERN","IDENTIFY","PROTECT","DETECT","RESPOND","RECOVER"}):
            errors.append(f"invalid_nist_mapping:{c.get('id')}")

    assessments=snap.get("controlAssessments",[])
    byid={a.get("controlId"):a for a in assessments}
    if set(byid)!=set(ids): errors.append("assessment_control_coverage_mismatch")
    for cid,a in byid.items():
        if a.get("state") not in VALID_STATES:
            errors.append(f"invalid_assessment_state:{cid}")
        op=str(a.get("operation",""))
        if a.get("state")=="pass" and any(x in op for x in ("not_yet","manual_snapshot_only","staged_only","invalidated")):
            errors.append(f"pass_without_operating_evidence:{cid}")

    deficiency_items=defs.get("items",[])
    def_ids=[d.get("id") for d in deficiency_items]
    if len(def_ids)!=len(set(def_ids)): errors.append("duplicate_deficiency_id")
    open_items=[d for d in deficiency_items if d.get("state")!="closed"]
    for d in deficiency_items:
        if not d.get("controlIds") or not set(d["controlIds"]).issubset(set(ids)):
            errors.append(f"deficiency_control_mapping_invalid:{d.get('id')}")
        if d.get("state")=="closed" and not d.get("retestEvidence"):
            errors.append(f"closed_without_retest:{d.get('id')}")
        if d.get("state")=="accepted_temporarily" and not d.get("expiresAt"):
            errors.append(f"temporary_acceptance_without_expiry:{d.get('id')}")

    states=Counter(a.get("state") for a in assessments)
    sev=Counter(d.get("severity") for d in open_items)
    readiness=int(snap.get("readinessLevel",2) if "readinessLevel" in snap else 2)
    # This staging snapshot cannot exceed level 2 while operating effectiveness
    # has not been observed and high deficiencies remain open.
    if sev.get("high",0)>0 or snap.get("readinessGates",{}).get("operatingEffectivenessWindowEstablished") is not True:
        readiness=min(readiness,2)

    result={
      "schemaVersion":1,"phase":"P34",
      "status":"pass" if not errors else "fail",
      "catalogVersion":catalog.get("catalogVersion"),
      "controlCount":len(controls),
      "assessmentStates":dict(sorted(states.items())),
      "openDeficiencies":len(open_items),
      "openDeficienciesBySeverity":dict(sorted(sev.items())),
      "calculatedReadinessLevel":readiness,
      "externalAuditReady": readiness>=4 and not open_items,
      "externalAttestationClaim":False,
      "errors":errors
    }
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
