#!/usr/bin/env python3
import argparse,hashlib,json
from datetime import datetime,timezone
from pathlib import Path

ALLOWED_HIGH={"closed","remediating","ready_for_retest","accepted_temporarily"}
MODE_ORDER={"shadow":0,"warn":1,"enforce":2,"production":3}

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def ts(v):
    if v.endswith("Z"): v=v[:-1]+"+00:00"
    d=datetime.fromisoformat(v)
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def fsha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def hobj(v): return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("samples")
    ap.add_argument("activation_context")
    ap.add_argument("--freeze",default="platform-p36-stable-epoch-freeze.json")
    ap.add_argument("--remediation",default="platform-p36-remediation-execution.json")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--p33-anchor",default="platform-p33-ledger-anchor.json")
    ap.add_argument("--catalog",default="platform-p34-control-catalog.json")
    ap.add_argument("--snapshot",default="platform-p34-assurance-snapshot.json")
    ap.add_argument("--out",default="p36-activation-decision.json")
    ap.add_argument("--require-ready",action="store_true")
    a=ap.parse_args()

    freeze=load(a.freeze); rem=load(a.remediation); p25=load(a.p25)
    obs=load(a.observation); samples=load(a.samples); ctx=load(a.activation_context)
    errors=[]

    if freeze.get("generation")!=4 or freeze.get("state")!="frozen_burn_in_active":
        errors.append("generation4_freeze_not_active")
    if p25.get("generation")!=4 or p25.get("currentGenerationEligible") is not True:
        errors.append("p25_generation4_not_eligible")
    if p25.get("currentEpochFreezeEvidence",{}).get("migrationHead")!=freeze.get("frozenEpoch",{}).get("migrationHead"):
        errors.append("p25_freeze_identity_mismatch")

    expected=freeze["frozenEpoch"]
    for key in ("migrationVersion","migrationName","migrationHead","semanticSchemaSha256","edgeFunctionCount","edgeInventorySha256","gomokuRoomVersion","gomokuRoomSha256","cronJobs","cronInventorySha256"):
        if obs.get(key)!=expected.get(key):
            errors.append("frozen_epoch_changed:"+key)

    if obs.get("projectStatus")!="ACTIVE_HEALTHY": errors.append("project_not_active_healthy")
    if obs.get("p18Integrity")!="clean": errors.append("p18_not_clean")
    if obs.get("p20SchemaDrift") is not False: errors.append("p20_schema_drift")
    if obs.get("p21Readiness")!="pass": errors.append("p21_not_pass")
    if obs.get("p22Maintenance")!="pass": errors.append("p22_not_pass")
    if int(obs.get("cronFailures24h",-1))!=0: errors.append("cron_failures_present")
    if int(obs.get("blockingReplicationSlots",-1))!=0: errors.append("blocking_replication_slots_present")

    observed=ts(obs["observedAt"])
    frozen_at=ts(freeze["frozenAt"])
    minimum=ts(freeze["minimumCertificationAt"])
    if observed<minimum: errors.append("generation4_minimum_time_not_reached")

    rows=[]
    for r in samples.get("samples") or []:
        try: t=ts(r["timestamp"])
        except Exception: continue
        if r.get("status")=="success" and r.get("healthy") is True and t>=frozen_at:
            rows.append((t,r))
    rows.sort(key=lambda x:x[0])
    need=int(freeze["certificationRequirements"]["minimumSuccessfulSamples"])
    if len(rows)<need: errors.append("generation4_insufficient_samples")

    bucket_seconds=freeze["certificationRequirements"]["coverageBucketHours"]*3600
    covered=set()
    for t,_ in rows:
        seconds=(t-frozen_at).total_seconds()
        if 0<=seconds<24*3600:
            covered.add(int(seconds//bucket_seconds))
    expected_buckets=set(range(freeze["certificationRequirements"]["coverageBuckets"]))
    if not expected_buckets.issubset(covered):
        errors.append("generation4_coverage_buckets_missing:"+",".join(map(str,sorted(expected_buckets-covered))))
    terminal=any(t>=minimum for t,_ in rows)
    if not terminal: errors.append("generation4_terminal_sample_missing")

    if ctx.get("postFinalSharedChangeBackupVerified") is not True:
        errors.append("post_final_change_backup_not_verified")
    if not ctx.get("backupEvidenceRef"):
        errors.append("backup_evidence_ref_missing")

    states=ctx.get("highDeficiencyStates") or {}
    for did in ("P34-D001","P34-D002"):
        if states.get(did) not in ALLOWED_HIGH:
            errors.append("high_deficiency_not_dispositioned:"+did)
    if states.get("P34-D005")!="closed":
        errors.append("semester_os_governance_not_closed")
    if rem.get("governanceMutations",{}).get("p31DependencyCoveragePct")!=100:
        errors.append("fleet_dependency_coverage_not_100")
    if rem.get("governanceMutations",{}).get("p31RegisteredAppGovernanceCoveragePct")!=100:
        errors.append("registered_app_governance_coverage_not_100")

    if MODE_ORDER.get(ctx.get("p32Mode"),-1)<MODE_ORDER["warn"]:
        errors.append("p32_below_warn")
    if ctx.get("p33CanonicalEvidenceActive") is not True:
        errors.append("p33_evidence_not_active")
    if ctx.get("controlCatalogFrozen") is not True:
        errors.append("control_catalog_not_frozen")
    if ctx.get("evidenceCollectionDryRunPass") is not True:
        errors.append("evidence_collection_dry_run_not_pass")
    if int(ctx.get("criticalOpenDeficiencies",-1))!=0:
        errors.append("critical_deficiency_open")
    if ctx.get("explicitActivationAuthorization") is not True:
        errors.append("explicit_activation_authorization_missing")
    if not ctx.get("requestedBy") or not ctx.get("authorizedBy") or ctx.get("requestedBy")==ctx.get("authorizedBy"):
        errors.append("independent_authorizer_required")

    try:
        anchor=load(a.p33_anchor)
        actual={
          "p33HeadHash":anchor["headHash"],
          "p33AnchorSha256":fsha(a.p33_anchor),
          "controlCatalogSha256":fsha(a.catalog),
          "p34SnapshotSha256":fsha(a.snapshot)
        }
        for key,value in actual.items():
            if ctx.get(key)!=value: errors.append("baseline_hash_mismatch:"+key)
    except Exception:
        errors.append("baseline_hash_verification_failed")

    result={
      "schemaVersion":2,"phase":"P36",
      "decision":"ready_to_activate" if not errors else "blocked",
      "observedAt":obs.get("observedAt"),
      "generation":freeze.get("generation"),
      "successfulSamples":len(rows),
      "coverageBuckets":sorted(covered),
      "terminalSamplePresent":terminal,
      "postFinalSharedChangeBackupVerified":ctx.get("postFinalSharedChangeBackupVerified") is True,
      "activationIsRetroactive":False,
      "errors":sorted(set(errors))
    }
    result["decisionId"]=hobj(result)
    if not errors:
        auth_material={
          "decisionId":result["decisionId"],"observedAt":result["observedAt"],
          "authorizedBy":ctx["authorizedBy"],"p33HeadHash":ctx["p33HeadHash"],
          "catalogSha256":ctx["controlCatalogSha256"],"snapshotSha256":ctx["p34SnapshotSha256"]
        }
        result["activationAuthorizationId"]=hobj(auth_material)
    Path(a.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    if a.require_ready and errors: raise SystemExit(1)

if __name__=="__main__": main()
