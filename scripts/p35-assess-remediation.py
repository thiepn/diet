#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--plan",default="platform-p35-remediation-plan.json")
    ap.add_argument("--p34-deficiencies",default="platform-p34-deficiency-register.json")
    ap.add_argument("--out",default="p35-remediation-assessment.json")
    args=ap.parse_args()
    plan=load(args.plan); old=load(args.p34_deficiencies)
    errors=[]
    old_ids={x["id"] for x in old["items"]}
    new={x["id"]:x for x in plan["deficiencies"]}
    if set(new)!=old_ids:
        errors.append("p34_deficiency_coverage_mismatch")
    if plan["technicalTriage"]["rlsNoPolicy"]["withAnonAnyDmlGrant"]!=0:
        errors.append("rls_no_policy_anon_grants_present")
    if plan["technicalTriage"]["rlsNoPolicy"]["withAuthenticatedAnyDmlGrant"]!=0:
        errors.append("rls_no_policy_authenticated_grants_present")
    sd=plan["technicalTriage"]["securityDefiner"]
    if sd["functions"]!=39 or sd["anonExecutable"]!=0 or sd["referencesAuthUid"]!=sd["functions"]:
        errors.append("security_definer_triage_incomplete")
    if sd["controlledSearchPath"]!=sd["functions"] or sd["emptySearchPath"]!=sd["functions"]:
        errors.append("security_definer_search_path_not_controlled")
    if plan["technicalTriage"]["leakedPasswordProtection"]["currentPlan"]!="free":
        errors.append("leaked_password_plan_snapshot_invalid")
    if "Pro Plan or above" not in plan["technicalTriage"]["leakedPasswordProtection"]["currentSupabaseDocsRequirement"]:
        errors.append("leaked_password_plan_requirement_missing")
    if any(x.get("productionChangePrepared") for x in new.values()):
        errors.append("p35_staging_must_not_prepare_unreviewed_production_change")
    if plan["closureRules"]["noAutomaticClosure"] is not True:
        errors.append("automatic_closure_not_allowed")
    out={
      "schemaVersion":1,"phase":"P35",
      "status":"pass" if not errors else "fail",
      "deficienciesCovered":len(new),
      "rlsNoPolicyDisposition":"intentional_deny_pattern_requires_documented_classification",
      "securityDefinerDisposition":"intentional_authenticated_rpc_pattern_requires_authorization_review",
      "leakedPasswordDisposition":"plan_or_risk_decision_required",
      "errors":errors
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
