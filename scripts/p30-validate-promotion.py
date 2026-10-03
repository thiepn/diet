#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path

STAGES=("source","candidate","integration","production_ready","production","observation","certified")
STATEFUL={"shared_standard","coordinated_breaking","platform_maintenance"}
STATEFUL_KINDS={"local_supabase_ephemeral","isolated_supabase_project","supabase_branch"}
EPOCH=("semanticSchemaSha256","migrationHead","edgeInventorySha256","cronInventorySha256")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def canon(o): return json.dumps(o,sort_keys=True,separators=(",",":")).encode()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("candidate"); ap.add_argument("evidence")
    ap.add_argument("--from-stage",required=True,choices=STAGES)
    ap.add_argument("--to-stage",required=True,choices=STAGES)
    ap.add_argument("--out",default="p30-promotion-decision.json")
    args=ap.parse_args()
    c=load(args.candidate); ev=load(args.evidence); errors=[]
    imm=c.get("immutable") or {}; train=imm.get("trainType")

    if STAGES.index(args.to_stage)!=STAGES.index(args.from_stage)+1:
        errors.append("stage_skip_or_reverse_not_allowed")
    if c.get("status")!="candidate": errors.append("candidate_status_invalid")
    if ev.get("candidateId")!=c.get("candidateId"): errors.append("candidate_id_mismatch")
    if ev.get("p29CertificateId")!=imm.get("p29CertificateId"): errors.append("p29_certificate_id_mismatch")
    if ev.get("p29CertificateStatus")!="pass": errors.append("p29_certificate_not_pass")

    obs=ev.get("observed") or {}; stale=[]
    for key in EPOCH:
        if imm.get(key)!=obs.get(key): stale.append(key)
    if stale: errors.append("stale_candidate:"+",".join(stale))

    if args.to_stage in ("integration","production_ready"):
        env=ev.get("integrationEnvironment") or {}
        kind=env.get("kind")
        if train in STATEFUL:
            if kind not in STATEFUL_KINDS:
                errors.append("stateful_release_requires_isolated_stateful_environment")
            else:
                if env.get("status")!="healthy": errors.append("stateful_integration_environment_not_healthy")
                if env.get("candidateId")!=c.get("candidateId"): errors.append("environment_candidate_mismatch")
                if env.get("productionDataUsed") is not False: errors.append("production_data_not_allowed_in_integration")
                if env.get("migrationsApplied") is not True: errors.append("candidate_migrations_not_applied")
                if env.get("servicesHealthy") is not True: errors.append("integration_services_not_healthy")
                if env.get("edgeValidatedWhenInScope") is not True: errors.append("edge_scope_not_validated")
                if kind=="supabase_branch":
                    if ev.get("organizationPlan")!="pro": errors.append("hosted_branch_not_available_on_current_plan")
                    if env.get("branchActionStatus")!="READY": errors.append("branch_action_state_not_ready")
        else:
            if kind not in {"logical"}|STATEFUL_KINDS: errors.append("integration_environment_invalid")
            if kind!="logical" and env.get("candidateId")!=c.get("candidateId"): errors.append("environment_candidate_mismatch")

    if args.to_stage=="production_ready":
        for gate in ("p29Compatibility","securityIntegrity","productionArtifact","rollbackOrForwardFix"):
            if ev.get("gates",{}).get(gate)!="pass": errors.append("gate_not_pass:"+gate)
        if train in STATEFUL:
            for gate in ("p18","p20","p21","p22"):
                if ev.get("gates",{}).get(gate)!="pass": errors.append("gate_not_pass:"+gate)

    if args.to_stage=="production":
        approval=ev.get("manualProductionApproval") or {}
        if approval.get("approved") is not True: errors.append("manual_production_approval_required")
        if not approval.get("approvalRef"): errors.append("production_approval_reference_required")
        if ev.get("frozenCandidate") is not True: errors.append("candidate_not_frozen")
        if train in {"coordinated_breaking","platform_maintenance"} and ev.get("maintenanceWindowDeclared") is not True:
            errors.append("maintenance_window_required")

    if args.to_stage=="observation":
        if ev.get("productionDeploymentStatus")!="success": errors.append("production_deployment_not_success")

    if args.to_stage=="certified":
        minimum={"app_fast":30,"shared_standard":60,"coordinated_breaking":120,"platform_maintenance":120}.get(train,10**9)
        if int(ev.get("observationMinutes",0))<minimum: errors.append("observation_window_incomplete")
        if ev.get("postReleaseHealth")!="pass": errors.append("post_release_health_not_pass")
        if any(ev.get("stopConditions",{}).values()): errors.append("active_stop_condition")

    base={
      "schemaVersion":2,"phase":"P30","candidateId":c.get("candidateId"),
      "trainId":imm.get("trainId"),"trainType":train,
      "fromStage":args.from_stage,"toStage":args.to_stage,
      "status":"fail" if errors else "pass","errors":errors,"staleFields":stale,
      "productionPromotionPerformed":False
    }
    receipt_material={k:v for k,v in base.items() if k not in ("status","errors","productionPromotionPerformed")}
    receipt_material["evidenceDigest"]=hashlib.sha256(canon(ev)).hexdigest()
    base["promotionReceiptId"]=hashlib.sha256(canon(receipt_material)).hexdigest() if not errors else None
    Path(args.out).write_text(json.dumps(base,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(base,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
