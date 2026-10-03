#!/usr/bin/env python3
import argparse, json
from pathlib import Path

STAGES=("source","candidate","integration","production_ready","production","observation","certified")
STATEFUL_TYPES={"shared_standard","coordinated_breaking","platform_maintenance"}

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def fail(out,errors,path):
    out["status"]="fail";out["errors"]=errors
    Path(path).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    raise SystemExit(1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("candidate")
    ap.add_argument("evidence")
    ap.add_argument("--from-stage",required=True,choices=STAGES)
    ap.add_argument("--to-stage",required=True,choices=STAGES)
    ap.add_argument("--out",default="p30-promotion-decision.json")
    args=ap.parse_args()
    c=load(args.candidate);e=load(args.evidence)
    errors=[]

    try:
        fi=STAGES.index(args.from_stage);ti=STAGES.index(args.to_stage)
    except ValueError:
        raise SystemExit("unknown stage")
    if ti!=fi+1:
        errors.append("stage_skip_or_reverse_not_allowed")
    if c.get("status")!="candidate":
        errors.append("candidate_status_invalid")
    imm=c.get("immutable") or {}
    train_type=imm.get("trainType")
    if train_type not in {"app_fast","shared_standard","coordinated_breaking","platform_maintenance"}:
        errors.append("unknown_train_type")

    if e.get("p29CertificateStatus")!="pass":
        errors.append("p29_certificate_not_pass")
    if e.get("candidateId")!=c.get("candidateId"):
        errors.append("candidate_id_mismatch")

    observed=e.get("observed") or {}
    compare={
      "semanticSchemaSha256":"semanticSchemaSha256",
      "migrationHead":"migrationHead",
      "edgeInventorySha256":"edgeInventorySha256",
      "cronInventorySha256":"cronInventorySha256",
      "environmentTopologyVersion":"environmentTopologyVersion"
    }
    stale=[]
    for ik,ok in compare.items():
        if imm.get(ik) and observed.get(ok) and imm[ik]!=observed[ok]:
            stale.append(ik)
    if stale:
        errors.append("stale_candidate:"+",".join(stale))

    env=e.get("integrationEnvironment") or {}
    if args.to_stage in ("integration","production_ready"):
        if train_type in STATEFUL_TYPES:
            if env.get("kind") not in ("supabase_branch","supabase_persistent_branch"):
                errors.append("stateful_release_requires_isolated_supabase_environment")
            if env.get("status")!="healthy":
                errors.append("stateful_integration_environment_not_healthy")
            if env.get("branchActionStatus")=="MIGRATIONS_FAILED":
                errors.append("branch_action_state_failed")
        elif env.get("kind") not in ("logical","supabase_branch","supabase_persistent_branch"):
            errors.append("integration_environment_invalid")

    if args.to_stage=="production_ready":
        required=("securityAdvisor","crossAppCompatibility","productionArtifact","rollbackOrForwardFix")
        for k in required:
            if e.get("gates",{}).get(k)!="pass":
                errors.append("gate_not_pass:"+k)
        if train_type!="app_fast":
            for k in ("p18","p20","p21","p22"):
                if e.get("gates",{}).get(k)!="pass":
                    errors.append("gate_not_pass:"+k)

    if args.to_stage=="production":
        if e.get("manualProductionApproval") is not True:
            errors.append("manual_production_approval_required")
        if e.get("frozenCandidate") is not True:
            errors.append("candidate_not_frozen")
        if train_type=="coordinated_breaking" and e.get("maintenanceWindowDeclared") is not True:
            errors.append("maintenance_window_required")

    if args.to_stage=="observation":
        if e.get("productionDeploymentStatus")!="success":
            errors.append("production_deployment_not_success")

    if args.to_stage=="certified":
        required_minutes={
          "app_fast":30,"shared_standard":60,"coordinated_breaking":120,"platform_maintenance":120
        }.get(train_type,10**9)
        if int(e.get("observationMinutes",0))<required_minutes:
            errors.append("observation_window_incomplete")
        if e.get("postReleaseHealth")!="pass":
            errors.append("post_release_health_not_pass")
        if e.get("p29CertificateStatus")!="pass":
            errors.append("p29_certificate_not_pass")

    out={
      "schemaVersion":1,"phase":"P30","candidateId":c.get("candidateId"),
      "trainId":imm.get("trainId"),"trainType":train_type,
      "fromStage":args.from_stage,"toStage":args.to_stage,
      "status":"pass","errors":[],"staleFields":stale
    }
    if errors: fail(out,errors,args.out)
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
