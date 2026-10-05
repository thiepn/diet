#!/usr/bin/env python3
import argparse, copy, hashlib, json
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("decision")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--backend",default="supabase/backend.json")
    ap.add_argument("--app",default=".well-known/thiepn-app.json")
    ap.add_argument("--p41",default="platform-p41-generation5-epoch-watch.json")
    ap.add_argument("--p42",default="platform-p42-generation6-refreeze-plan.json")
    ap.add_argument("--out-dir",default="p43-generation6-activation-preview")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()

    d=load(a.decision); p25=load(a.p25); backend=load(a.backend); app=load(a.app); p41=load(a.p41); p42=load(a.p42)
    errors=[]
    if d.get("decision")!="ready_to_activate_generation6": errors.append("final_revalidation_not_ready")
    if d.get("generation")!=6: errors.append("decision_generation_not_6")
    if d.get("errors"): errors.append("final_revalidation_has_errors")
    if not isinstance(d.get("frozenEpoch"),dict): errors.append("frozen_epoch_missing")
    if not d.get("minimumCompleteAfter"): errors.append("minimum_complete_after_missing")
    if p41.get("state")!="generation5_invalidated_epoch_changed": errors.append("generation5_not_invalidated")
    if p42.get("state")!="refreeze_pending" or p42.get("generation")!=6: errors.append("p42_candidate_not_pending")
    if d.get("candidateRevision")!=p42.get("candidateRevision"): errors.append("candidate_revision_mismatch")

    receipt={
      "schemaVersion":1,"phase":"P43","generation":6,
      "decision":"ready_to_commit_generation6_activation" if not errors else "blocked",
      "activatedAt":d.get("observedAt") if not errors else None,
      "minimumCompleteAfter":d.get("minimumCompleteAfter") if not errors else None,
      "sourceDecisionId":d.get("decisionId"),
      "sourceFilesMutated":False,
      "productionMutationPerformed":False,
      "errors":sorted(set(errors))
    }
    out=Path(a.out_dir); out.mkdir(parents=True,exist_ok=True)

    if not errors:
        frozen=d["frozenEpoch"]
        newp=copy.deepcopy(p25)
        old={"generation":5,"activatedAt":p25.get("activatedAt"),"minimumCompleteAfter":p25.get("minimumCompleteAfter"),
             "invalidated":True,"invalidationReason":"shared_release_epoch_changed_after_generation5",
             "previousMigrationHead":(p25.get("currentEpochFreezeEvidence") or {}).get("migrationHead")}
        newp.update({
          "state":"burn_in_active","generation":6,"generationState":"burn_in_active",
          "currentGenerationEligible":True,"nextGeneration":None,
          "activatedAt":d["observedAt"],"minimumCompleteAfter":d["minimumCompleteAfter"],
          "restartReason":"Generation 6 activated only after P43 exact live epoch revalidation, >=60 quiet minutes, healthy controls/advisor review, and a verified encrypted backup after the final shared change.",
          "previousGeneration":old,
          "currentEpochFreezeEvidence":frozen,
          "completionState":{"complete":False,"invalidated":False,"remaining":[
            "collect at least 12 successful qualifying generation-6 samples",
            "cover all six 4-hour buckets across the first 24 hours",
            "include a terminal qualifying sample at or after minimumCompleteAfter",
            "revalidate exact frozen epoch and service/advisor health",
            "run current-generation burn-in certification"
          ]}
        })
        newp["pendingGeneration6"]={
          "generation":6,"state":"activated","candidateRevision":p42.get("candidateRevision"),
          "candidateEpoch":copy.deepcopy(p42.get("candidateEpoch")),
          "eligibleToActivate":True,"activatedAt":d["observedAt"],
          "minimumCompleteAfter":d["minimumCompleteAfter"],
          "postFinalChangeEncryptedBackupVerified":True,
          "backupEvidenceRef":frozen.get("backupEvidenceRef"),
          "activationSource":"P43 final epoch revalidation and deterministic activation transform"
        }
        newp["generation6Sampling"]={
          "workflow":".github/workflows/p25-post-upgrade-burnin.yml",
          "minimumSuccessfulSamples":12,"sampleWindowMustSpanBurnIn":True,
          "minimumCoverageBuckets":6,"coverageBucketHours":4,
          "terminalSampleRequiredAtOrAfterMinimumCompleteAfter":True,
          "preActivationSamplesQualify":False,"evidenceRuleUnchanged":True
        }
        newp["latestSuccessfulEncryptedOffsiteBackup"]={
          "workflow":"P15 Encrypted Offsite Backup",
          "runId":d.get("backupRunId"),"conclusion":"success",
          "freshForCandidate":True,"evidenceRef":frozen.get("backupEvidenceRef")
        }

        newb=copy.deepcopy(backend)
        pol=newb.setdefault("post_upgrade_burn_in_policy",{})
        pol.update({
          "state":"burn_in_active","current_generation":6,"last_generation":5,
          "last_generation_state":"invalidated_epoch_changed","next_generation":None,
          "current_generation_eligible":True,"generation6_state":"burn_in_active",
          "generation6_activated_at":d["observedAt"],
          "generation6_minimum_complete_after":d["minimumCompleteAfter"],
          "generation6_backup_prerequisite_satisfied":True,
          "generation6_backup_evidence_ref":frozen.get("backupEvidenceRef"),
          "generation6_migration":frozen.get("migrationHead"),
          "generation6_schema_sha256":frozen.get("semanticSchemaSha256")
        })

        newa=copy.deepcopy(app)
        h=newa.setdefault("health",{})
        h.update({
          "p25BurnInActive":True,"p25CurrentGenerationValid":True,
          "p25BurnInGeneration":6,"p25BurnInGenerationState":"burn_in_active",
          "p25NextGeneration":None,"p25Generation6State":"burn_in_active",
          "p25Generation6ActivatedAt":d["observedAt"],
          "p25Generation6MinimumCompleteAfter":d["minimumCompleteAfter"],
          "p25Generation6BackupPrerequisiteSatisfied":True,
          "p25Generation6BackupEvidenceRef":frozen.get("backupEvidenceRef"),
          "p25FrozenMigrationHead":frozen.get("migrationHead"),
          "p25FrozenSemanticSchemaSha256":frozen.get("semanticSchemaSha256"),
          "p25FrozenGomokuEdgeVersion":frozen.get("gomokuRoomVersion"),
          "p25FrozenCronJobCount":frozen.get("cronJobs")
        })

        outputs={"platform-p25-burn-in-plan.json":newp,"supabase-backend.json":newb,"thiepn-app.json":newa}
        receipt["outputHashes"]={k:hid(v) for k,v in outputs.items()}
        receipt["activationReceiptId"]=hid({
          "generation":6,"activatedAt":d["observedAt"],"minimumCompleteAfter":d["minimumCompleteAfter"],
          "sourceDecisionId":d.get("decisionId"),"frozenEpoch":frozen,"outputHashes":receipt["outputHashes"]
        })
        for name,value in outputs.items():
            (out/name).write_text(json.dumps(value,indent=2)+"\n",encoding="utf-8")
    else:
        receipt["outputHashes"]={}; receipt["activationReceiptId"]=None

    (out/"p43-generation6-activation-receipt.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(receipt,separators=(",",":")))
    if a.require_ready and errors: raise SystemExit(1)

if __name__=="__main__": main()
