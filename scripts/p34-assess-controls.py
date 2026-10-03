#!/usr/bin/env python3
import argparse,json,hashlib
from collections import Counter
from datetime import datetime,timezone,timedelta
from pathlib import Path

VALID_DESIGN={"implemented_point_in_time","partial","needs_review","needs_remediation","not_tested"}
VALID_OPERATION={"insufficient_period","effective","ineffective","not_tested"}
VALID_DEF_STATES={"open","accepted_temporarily","remediating","ready_for_retest","closed"}
SEVERITY_ORDER={"low":1,"medium":2,"high":3,"critical":4}

def load(path): return json.loads(Path(path).read_text(encoding="utf-8"))
def parse_dt(v):
    if v.endswith("Z"): v=v[:-1]+"+00:00"
    dt=datetime.fromisoformat(v)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
def canon(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
def sha(v): return hashlib.sha256(canon(v)).hexdigest()
def is_hash(v): return isinstance(v,str) and len(v)==64 and all(c in "0123456789abcdef" for c in v)

def assess(catalog,snapshot,defs):
    errors=[]; warnings=[]
    controls=catalog.get("controls",[])
    ids=[c.get("id") for c in controls]
    control_ids=set(ids)

    if catalog.get("phase")!="P34": errors.append("catalog_phase_invalid")
    if len(controls)!=18: errors.append("control_count_not_18")
    if len(ids)!=len(set(ids)): errors.append("duplicate_control_id")
    expected_nist={"GOVERN","IDENTIFY","PROTECT","DETECT","RESPOND","RECOVER"}
    mapped=set()
    for c in controls:
        mapped.update(c.get("nist") or [])
        if not c.get("owner") or not c.get("objective") or not c.get("test"):
            errors.append("control_required_field_missing:"+str(c.get("id")))
        if not c.get("soc2") or not c.get("evidence"):
            errors.append("control_mapping_or_evidence_missing:"+str(c.get("id")))
        if not isinstance(c.get("maxEvidenceAgeHours"),(int,float)) or c["maxEvidenceAgeHours"]<=0:
            errors.append("control_freshness_limit_invalid:"+str(c.get("id")))
    if mapped!=expected_nist:
        errors.append("nist_function_coverage_invalid:"+",".join(sorted(expected_nist-mapped)))

    if snapshot.get("externalAttestationClaim") is not False:
        errors.append("external_attestation_claim_forbidden")
    if snapshot.get("overallState")=="audit_ready" and snapshot.get("currentReadinessLevel",0)<4:
        errors.append("audit_ready_state_without_level4")

    assessments=snapshot.get("controlAssessments") or []
    a_ids=[a.get("controlId") for a in assessments]
    if set(a_ids)!=control_ids or len(a_ids)!=len(control_ids):
        errors.append("assessment_control_set_mismatch")

    c_map={c["id"]:c for c in controls}
    stale=[]; not_tested=[]; design_counts=Counter(); op_counts=Counter()
    for a in assessments:
        cid=a.get("controlId")
        if cid not in c_map: continue
        design=a.get("designState"); op=a.get("operatingEffectiveness")
        design_counts[design]+=1; op_counts[op]+=1
        if design not in VALID_DESIGN: errors.append("invalid_design_state:"+cid)
        if op not in VALID_OPERATION: errors.append("invalid_operating_state:"+cid)
        max_age=c_map[cid]["maxEvidenceAgeHours"]
        age=a.get("evidenceAgeHours")
        if not isinstance(age,(int,float)) or age<0:
            errors.append("invalid_evidence_age:"+cid)
        elif age>max_age:
            stale.append(cid)
        expected_fresh="stale" if isinstance(age,(int,float)) and age>max_age else "fresh"
        if a.get("freshness")!=expected_fresh:
            errors.append("freshness_label_mismatch:"+cid)
        if design=="not_tested" or op=="not_tested":
            not_tested.append(cid)
        if op=="effective":
            period=snapshot.get("operatingEffectivenessPeriod") or {}
            if snapshot.get("currentReadinessLevel",0)<3 or not period.get("start") or not period.get("end"):
                errors.append("effective_without_defined_period:"+cid)
    if stale: warnings.append("stale_controls:"+",".join(sorted(stale)))
    if not_tested: warnings.append("not_tested_controls:"+",".join(sorted(not_tested)))

    items=defs.get("items") or []
    def_ids=[d.get("id") for d in items]
    if len(def_ids)!=len(set(def_ids)): errors.append("duplicate_deficiency_id")
    snapshot_at=parse_dt(snapshot["snapshotAt"])
    open_items=[]; sev_counts=Counter()
    for d in items:
        did=d.get("id")
        if d.get("state") not in VALID_DEF_STATES: errors.append("invalid_deficiency_state:"+str(did))
        if d.get("severity") not in SEVERITY_ORDER: errors.append("invalid_deficiency_severity:"+str(did))
        if d.get("automaticRemediation") is not False: errors.append("automatic_remediation_forbidden:"+str(did))
        bad_controls=sorted(set(d.get("controlIds") or [])-control_ids)
        if bad_controls: errors.append("deficiency_unknown_controls:"+str(did)+":"+",".join(bad_controls))
        state=d.get("state")
        if state!="closed":
            open_items.append(d); sev_counts[d["severity"]]+=1
        if state=="closed":
            hashes=d.get("closureEvidenceHashes") or []
            if not d.get("closedAt") or not d.get("retestAt") or not hashes or not all(is_hash(x) for x in hashes):
                errors.append("closed_without_retest_evidence:"+str(did))
        if state=="ready_for_retest" and not d.get("remediationEvidenceHashes"):
            errors.append("ready_for_retest_without_remediation_evidence:"+str(did))
        if state=="accepted_temporarily":
            if not d.get("expiresAt") or not d.get("acceptedBy") or not d.get("decisionRef"):
                errors.append("temporary_acceptance_incomplete:"+str(did))
            else:
                exp=parse_dt(d["expiresAt"])
                if exp<=snapshot_at: errors.append("temporary_acceptance_expired:"+str(did))
                if exp-snapshot_at>timedelta(days=defs["closurePolicy"]["acceptedTemporarilyMaximumDays"]):
                    errors.append("temporary_acceptance_too_long:"+str(did))
            if d.get("severity")=="critical" and not d.get("executiveDecisionRef"):
                errors.append("critical_acceptance_without_executive_decision:"+str(did))

    declared=snapshot.get("deficiencies") or {}
    expected_declared={
      "open":len(open_items),"high":sev_counts["high"],"medium":sev_counts["medium"],"critical":sev_counts["critical"]
    }
    if declared!=expected_declared:
        errors.append("snapshot_deficiency_totals_mismatch")

    high_or_critical=[d["id"] for d in open_items if d["severity"] in ("high","critical")]
    effective_count=op_counts["effective"]
    readiness_level=snapshot.get("currentReadinessLevel")
    audit_ready=(
      not errors and not stale and not not_tested and not high_or_critical and
      effective_count==len(controls) and readiness_level>=4 and
      snapshot.get("externalAttestationClaim") is False
    )
    if audit_ready and snapshot.get("overallState")!="audit_ready":
        errors.append("derived_audit_ready_but_snapshot_not_ready")
        audit_ready=False
    if snapshot.get("overallState")=="audit_ready" and not audit_ready:
        errors.append("snapshot_claims_audit_ready_but_gate_fails")

    result={
      "schemaVersion":2,"phase":"P34",
      "status":"pass" if not errors else "fail",
      "auditReady":audit_ready,
      "readinessLevel":readiness_level,
      "controlCount":len(controls),
      "designCounts":dict(sorted(design_counts.items())),
      "operatingCounts":dict(sorted(op_counts.items())),
      "freshControls":len(controls)-len(stale),
      "staleControls":sorted(stale),
      "notTestedControls":sorted(not_tested),
      "openDeficiencyCount":len(open_items),
      "openSeverityCounts":dict(sorted(sev_counts.items())),
      "openHighOrCritical":high_or_critical,
      "errors":errors,"warnings":warnings
    }
    result["assessmentDigest"]=sha({k:v for k,v in result.items() if k!="assessmentDigest"})
    return result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--catalog",default="platform-p34-control-catalog.json")
    ap.add_argument("--snapshot",default="platform-p34-assurance-snapshot.json")
    ap.add_argument("--deficiencies",default="platform-p34-deficiency-register.json")
    ap.add_argument("--out",default="p34-assurance-result.json")
    args=ap.parse_args()
    result=assess(load(args.catalog),load(args.snapshot),load(args.deficiencies))
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    if result["status"]!="pass": raise SystemExit(1)

if __name__=="__main__": main()
