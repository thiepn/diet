#!/usr/bin/env python3
import argparse,json,hashlib
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def digest(v):
    raw=json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
    return hashlib.sha256(raw).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--plan",default="platform-p35-remediation-plan.json")
    ap.add_argument("--p34-deficiencies",default="platform-p34-deficiency-register.json")
    ap.add_argument("--p34-snapshot",default="platform-p34-assurance-snapshot.json")
    ap.add_argument("--out",default="p35-remediation-assessment.json")
    a=ap.parse_args()
    plan=load(a.plan); old=load(a.p34_deficiencies); snap=load(a.p34_snapshot)
    errors=[]
    p34={x["id"]:x for x in old.get("items",[])}
    p35={x["id"]:x for x in plan.get("deficiencies",[])}
    if set(p34)!=set(p35): errors.append("p34_deficiency_coverage_mismatch")
    if len(p35)!=8: errors.append("expected_eight_p34_deficiencies")

    tri=plan.get("technicalTriage",{})
    rls=tri.get("rlsNoPolicy",{})
    if rls.get("advisorTables")!=73: errors.append("rls_advisor_count_mismatch")
    if rls.get("withAnonEffectiveDmlPrivilege")!=0: errors.append("rls_no_policy_anon_dml_present")
    if rls.get("withAuthenticatedEffectiveDmlPrivilege")!=0: errors.append("rls_no_policy_authenticated_dml_present")

    sd=tri.get("securityDefiner",{})
    checks={
      "functions":47,"anonExecutable":0,"authenticatedExecutable":47,
      "referencesAuthUid":47,"controlledSearchPath":47,"emptySearchPath":47,
      "explicitStaticRejectSignal":41
    }
    for k,v in checks.items():
        if sd.get(k)!=v: errors.append("security_definer_"+k+"_mismatch")
    if len(sd.get("withoutStaticRejectSignal",[]))!=6:
        errors.append("security_definer_review_target_count_mismatch")

    leaked=tri.get("leakedPasswordProtection",{})
    if leaked.get("currentPlan")!="free": errors.append("leaked_password_plan_snapshot_invalid")
    if "Pro Plan and above" not in leaked.get("currentSupabaseDocsRequirement",""):
        errors.append("leaked_password_plan_requirement_missing")

    if tri.get("authRlsInitplan",{}).get("warnings")!=38:
        errors.append("auth_rls_initplan_count_mismatch")

    for did,item in p35.items():
        if item.get("productionChangePrepared") is not False: errors.append("production_change_prepared:"+did)
        if item.get("automaticClosure") is not False: errors.append("automatic_closure_enabled:"+did)
        if item.get("severity")!=p34[did].get("severity"): errors.append("severity_changed:"+did)

    if plan.get("closureRules",{}).get("noAutomaticClosure") is not True:
        errors.append("no_automatic_closure_rule_missing")
    if plan.get("operatorOverride",{}).get("doesNotAuthorizeRiskAcceptance") is not True:
        errors.append("risk_acceptance_boundary_missing")

    current_sec=plan["advisorBaseline"]["security"]
    current_perf=plan["advisorBaseline"]["performance"]
    prior_sec=snap["securityAdvisor"]
    prior_perf=snap["performanceAdvisor"]
    prior=lambda name: next(x["count"] for x in prior_sec["findings"] if x["lint"]==name)
    priorp=lambda name: next(x["count"] for x in prior_perf["findings"] if x["lint"]==name)
    drift={
      "rlsEnabledNoPolicy":current_sec["rlsEnabledNoPolicy"]["count"]-prior("rls_enabled_no_policy"),
      "authenticatedSecurityDefinerExecutable":current_sec["authenticatedSecurityDefinerExecutable"]["count"]-prior("authenticated_security_definer_function_executable"),
      "authRlsInitplan":current_perf["authRlsInitplan"]["count"]-priorp("auth_rls_initplan")
    }
    if drift!={"rlsEnabledNoPolicy":2,"authenticatedSecurityDefinerExecutable":4,"authRlsInitplan":2}:
        errors.append("unexpected_p34_to_p35_advisor_drift")

    out={
      "schemaVersion":2,"phase":"P35","status":"pass" if not errors else "fail",
      "deficienciesCovered":len(p35),"deficienciesClosedByP35":0,
      "productionChangesPrepared":0,
      "advisorDriftSinceP34":drift,
      "rlsNoPolicyDisposition":"zero_effective_client_dml_but_classification_and_retest_required",
      "securityDefinerDisposition":"authenticated_auth_uid_empty_search_path_pattern_requires_function_authorization_review",
      "leakedPasswordDisposition":"pro_plan_or_bounded_risk_decision_required",
      "operatingPeriodReady":False,
      "errors":errors
    }
    out["assessmentDigest"]=digest({k:v for k,v in out.items() if k!="assessmentDigest"})
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
