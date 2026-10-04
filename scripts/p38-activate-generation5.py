#!/usr/bin/env python3
import argparse, copy, hashlib, json
from pathlib import Path

EPOCH_KEYS=(
    "migrationVersion","migrationName","migrationHead","semanticSchemaSha256",
    "edgeInventorySha256","edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256",
    "cronJobs","activeCronJobs","cronInventorySha256"
)

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("refreeze_decision")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--backend",default="supabase/backend.json")
    ap.add_argument("--app",default=".well-known/thiepn-app.json")
    ap.add_argument("--out-dir",default="p38-generation5-preview")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()

    decision=load(a.refreeze_decision)
    p25=load(a.p25)
    backend=load(a.backend)
    app=load(a.app)
    errors=[]

    if decision.get("decision")!="ready_to_activate_generation5":
        errors.append("refreeze_decision_not_ready")
    if decision.get("generation")!=5:
        errors.append("refreeze_generation_not_5")
    if decision.get("errors"):
        errors.append("refreeze_decision_has_errors")
    frozen=decision.get("frozenEpoch")
    if not isinstance(frozen,dict):
        errors.append("frozen_epoch_missing")
        frozen={}
    if frozen.get("postFinalChangeEncryptedBackupVerified") is not True:
        errors.append("post_final_change_backup_not_verified")
    if not frozen.get("backupEvidenceRef"):
        errors.append("backup_evidence_ref_missing")
    if not decision.get("minimumCompleteAfter"):
        errors.append("minimum_complete_after_missing")
    if not decision.get("observedAt"):
        errors.append("activation_time_missing")

    if p25.get("state")!="refreeze_pending":
        errors.append("p25_not_refreeze_pending")
    if p25.get("generation")!=4:
        errors.append("expected_generation4_predecessor")
    if p25.get("currentGenerationEligible") is not False:
        errors.append("generation4_still_eligible")
    if p25.get("nextGeneration")!=5:
        errors.append("next_generation_not_5")
    pending=p25.get("pendingGeneration5") or {}
    candidate=pending.get("candidateEpoch") or {}
    if pending.get("generation")!=5:
        errors.append("pending_generation5_missing")

    for key in EPOCH_KEYS:
        if frozen.get(key)!=candidate.get(key):
            errors.append("frozen_candidate_mismatch:"+key)

    receipt={
      "schemaVersion":1,
      "phase":"P38",
      "decision":"ready_to_commit_generation5_activation" if not errors else "blocked",
      "generation":5,
      "activatedAt":decision.get("observedAt") if not errors else None,
      "minimumCompleteAfter":decision.get("minimumCompleteAfter") if not errors else None,
      "sourceRefreezeDecisionId":decision.get("decisionId"),
      "sourceFilesMutated":False,
      "productionMutationPerformed":False,
      "errors":sorted(set(errors))
    }

    out=Path(a.out_dir)
    out.mkdir(parents=True,exist_ok=True)

    if not errors:
        newp=copy.deepcopy(p25)
        newp.update({
          "state":"burn_in_active",
          "generation":5,
          "generationState":"burn_in_active",
          "currentGenerationEligible":True,
          "nextGeneration":None,
          "activatedAt":decision["observedAt"],
          "minimumCompleteAfter":decision["minimumCompleteAfter"],
          "restartReason":"Generation 5 activates only from a P37 ready refreeze receipt with exact epoch identity, >=60 minutes quiet and verified post-final-change encrypted backup.",
          "currentEpochFreezeEvidence":frozen,
          "completionState":{
            "complete":False,
            "invalidated":False,
            "remaining":[
              "collect at least 12 successful qualifying generation-5 samples",
              "cover all six 4-hour buckets across the first 24 hours",
              "include a terminal qualifying sample at or after minimumCompleteAfter",
              "revalidate exact frozen epoch and service/advisor health",
              "run P37 current-generation burn-in certification"
            ]
          }
        })
        newp["pendingGeneration5"]=copy.deepcopy(pending)
        newp["pendingGeneration5"].update({
          "state":"activated",
          "eligibleToActivate":True,
          "activatedAt":decision["observedAt"],
          "minimumCompleteAfter":decision["minimumCompleteAfter"],
          "postFinalChangeEncryptedBackupVerified":True,
          "backupEvidenceRef":frozen.get("backupEvidenceRef"),
          "activationSource":"P38 reviewed activation preview"
        })
        newp["generation5Sampling"]["preActivationSamplesQualify"]=False

        newb=copy.deepcopy(backend)
        policy=newb.setdefault("post_upgrade_burn_in_policy",{})
        policy.update({
          "state":"burn_in_active",
          "current_generation":5,
          "last_generation":4,
          "last_generation_state":"invalidated_epoch_changed",
          "next_generation":None,
          "current_generation_eligible":True,
          "generation5_state":"burn_in_active",
          "generation5_activated_at":decision["observedAt"],
          "generation5_minimum_complete_after":decision["minimumCompleteAfter"],
          "generation5_backup_prerequisite_satisfied":True,
          "generation5_backup_evidence_ref":frozen.get("backupEvidenceRef"),
          "generation5_migration":frozen.get("migrationHead"),
          "generation5_schema_sha256":frozen.get("semanticSchemaSha256"),
          "generation5_edge_inventory_sha256":frozen.get("edgeInventorySha256"),
          "generation5_cron_inventory_sha256":frozen.get("cronInventorySha256")
        })

        newa=copy.deepcopy(app)
        health=newa.setdefault("health",{})
        health.update({
          "p25BurnInActive":True,
          "p25CurrentGenerationValid":True,
          "p25BurnInGeneration":5,
          "p25BurnInGenerationState":"burn_in_active",
          "p25NextGeneration":None,
          "p25Generation5State":"burn_in_active",
          "p25Generation5ActivatedAt":decision["observedAt"],
          "p25Generation5MinimumCompleteAfter":decision["minimumCompleteAfter"],
          "p25Generation5BackupPrerequisiteSatisfied":True,
          "p25Generation5BackupEvidenceRef":frozen.get("backupEvidenceRef"),
          "p25FrozenMigrationHead":frozen.get("migrationHead"),
          "p25FrozenGomokuEdgeVersion":frozen.get("gomokuRoomVersion"),
          "p25FrozenCronJobCount":frozen.get("cronJobs")
        })

        outputs={
          "platform-p25-burn-in-plan.json":newp,
          "supabase-backend.json":newb,
          "thiepn-app.json":newa
        }
        receipt["outputHashes"]={name:digest(value) for name,value in outputs.items()}
        receipt["activationReceiptId"]=digest({
          "generation":5,
          "activatedAt":decision["observedAt"],
          "minimumCompleteAfter":decision["minimumCompleteAfter"],
          "sourceRefreezeDecisionId":decision.get("decisionId"),
          "frozenEpoch":frozen,
          "outputHashes":receipt["outputHashes"]
        })
        for name,value in outputs.items():
            (out/name).write_text(json.dumps(value,indent=2)+"\n",encoding="utf-8")
    else:
        receipt["activationReceiptId"]=None
        receipt["outputHashes"]={}

    (out/"p38-generation5-activation-receipt.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(receipt,separators=(",",":")))
    if a.require_ready and errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
