#!/usr/bin/env python3
import hashlib,json,re,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVAL=ROOT/"scripts/p36-evaluate-activation.py"
ACT=ROOT/"scripts/p36-activate-oe.py"

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def fsha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

freeze=load(ROOT/"platform-p36-stable-epoch-freeze.json")
rem=load(ROOT/"platform-p36-remediation-execution.json")
oe=load(ROOT/"platform-p36-operating-effectiveness-state.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")
p28=load(ROOT/"platform-p28-resource-ownership.json")
p29=load(ROOT/"platform-p29-dependency-graph.json")
p31=load(ROOT/"platform-p31-fleet-registry.json")
p32=load(ROOT/"platform-p32-policy-bundle.json")
p34defs=load(ROOT/"platform-p34-deficiency-register.json")

assert freeze["generation"]==4
assert freeze["state"]=="frozen_burn_in_active"
assert freeze["certified"] is False
assert freeze["frozenEpoch"]["migrationHead"]=="20261003221217_hub_h15_tms60_projection"
assert freeze["frozenEpoch"]["edgeFunctionCount"]==12
assert freeze["frozenEpoch"]["cronJobs"]==14
assert freeze["quietEvidence"]["satisfied"] is True
assert freeze["backupEvidence"]["postFinalSharedChangeEncryptedBackupVerified"] is False

assert rem["state"]=="partial_remediation_executed"
closed={x["deficiencyId"]:x for x in rem["executedDispositions"]}
assert closed["P34-D005"]["state"]=="closed"
assert closed["P34-D005"]["retest"]["dependencyGraphCoveragePct"]==100
assert closed["P34-D002"]["state"]=="remediating"
assert closed["P34-D003"]["state"]=="ready_for_retest"
assert closed["P34-D006"]["state"]=="remediating"
assert rem["productionMutationPerformed"] is False

assert len(p28["registeredApps"])==7
assert any(x["id"]=="semester-os" and x["owner"]=="thiepn" for x in p28["registeredApps"])
assert len(p29["nodes"])==18
assert len(p29["edges"])==51
assert len([x for x in p29["edges"] if x["consumer"]=="semester-os"])==4
assert p31["coverage"]["dependencyGraphCoveragePct"]==100
assert p31["coverage"]["registeredAppGovernanceCoveragePct"]==100
sem=next(x for x in p31["components"] if x["id"]=="semester-os")
assert sem["governance"]=="governed" and sem["owner"]=="thiepn"
assert not any(x.get("id")=="p29-graph-missing-semester-os" for x in p31.get("observedDrift",[]))
assert p32["mode"]=="warn"
assert p32["fleetRegistryVersion"]=="2026-10-04.6"
assert p32["dependencyGraphVersion"]=="2026-10-04.1"

# Historical P34 register remains immutable; P36 is the closure event.
assert next(x for x in p34defs["items"] if x["id"]=="P34-D005")["state"]=="open"

assert p25["generation"]==5
assert p25["currentGenerationEligible"] is False
assert p25["state"]=="refreeze_pending"
assert p25["nextGeneration"]==6
assert p25["previousGeneration"]["generation"]==4
assert p25["previousGeneration"]["invalidated"] is True
assert p25["currentEpochFreezeEvidence"]["migrationHead"]!=freeze["frozenEpoch"]["migrationHead"]
assert p25["latestObservedEpoch"]["migrationHead"]!=freeze["frozenEpoch"]["migrationHead"]
assert p25["currentEpochFreezeEvidence"]["postFinalChangeEncryptedBackupVerified"] is True

assert oe["active"] is False
assert oe["state"]=="armed_waiting_generation4_and_high_deficiency_gate"
assert oe["activationIsRetroactive"] is False
assert oe["activationGates"]["p34D005Closed"] is True
assert oe["activationGates"]["p34D001Dispositioned"] is False

sql=(ROOT/"scripts/p36-remediation-retest.sql").read_text()
no_comments=re.sub(r'--[^\n]*','',sql)
stmts=[s.strip().lower() for s in no_comments.split(';') if s.strip()]
assert stmts and all(s.startswith("select") or s.startswith("with") for s in stmts),stmts
for forbidden in ("insert ","update ","delete ","alter ","create ","drop ","grant ","revoke "):
    assert forbidden not in no_comments.lower()

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obsf=d/"obs.json"; samplesf=d/"samples.json"; ctxf=d/"ctx.json"; decision=d/"decision.json"

    ep=freeze["frozenEpoch"]
    current_obs={
      "observedAt":freeze["frozenAt"],"projectStatus":"ACTIVE_HEALTHY",
      **ep,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass",
      "cronFailures24h":0,"blockingReplicationSlots":0
    }
    anchor=load(ROOT/"platform-p33-ledger-anchor.json")
    base_ctx={
      "postFinalSharedChangeBackupVerified":False,"backupEvidenceRef":None,
      "highDeficiencyStates":{"P34-D001":"decision_required","P34-D002":"remediating","P34-D005":"closed"},
      "p32Mode":"warn","p33CanonicalEvidenceActive":True,"controlCatalogFrozen":True,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "explicitActivationAuthorization":False,"requestedBy":"platform","authorizedBy":"reviewer",
      "p33HeadHash":anchor["headHash"],
      "p33AnchorSha256":fsha(ROOT/"platform-p33-ledger-anchor.json"),
      "controlCatalogSha256":fsha(ROOT/"platform-p34-control-catalog.json"),
      "p34SnapshotSha256":fsha(ROOT/"platform-p34-assurance-snapshot.json")
    }
    historical_p25=json.loads(json.dumps(p25))
    historical_p25.update({
      "state":"burn_in_active","generation":4,"generationState":"burn_in_active",
      "currentGenerationEligible":True,"nextGeneration":None,
      "activatedAt":freeze["frozenAt"],"minimumCompleteAfter":freeze["minimumCertificationAt"],
      "currentEpochFreezeEvidence":freeze["frozenEpoch"],
      "completionState":{"complete":False,"invalidated":False,"remaining":[]}
    })
    historical_file=d/"p25-generation4-historical.json"; write(historical_file,historical_p25)
    write(obsf,current_obs); write(samplesf,{"samples":[]}); write(ctxf,base_ctx)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(decision)])
    cur=load(decision)
    assert cur["decision"]=="blocked"
    for e in (
      "generation4_minimum_time_not_reached","generation4_insufficient_samples",
      "generation4_terminal_sample_missing","post_final_change_backup_not_verified",
      "backup_evidence_ref_missing","high_deficiency_not_dispositioned:P34-D001",
      "explicit_activation_authorization_missing"
    ): assert e in cur["errors"]
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"required.json"),"--require-ready"],1)

    # Build a complete future-ready evidence set.
    start=datetime.fromisoformat(freeze["frozenAt"].replace("Z","+00:00"))
    minimum=datetime.fromisoformat(freeze["minimumCertificationAt"].replace("Z","+00:00"))
    future_obs=dict(current_obs); future_obs["observedAt"]=z(minimum+timedelta(minutes=5))
    rows=[]
    for hour in (1,3,5,7,9,11,13,15,17,19,21,23):
        rows.append({"timestamp":z(start+timedelta(hours=hour)),"status":"success","healthy":True})
    rows.append({"timestamp":z(minimum+timedelta(minutes=1)),"status":"success","healthy":True})
    ready_ctx=dict(base_ctx)
    ready_ctx.update({
      "postFinalSharedChangeBackupVerified":True,
      "backupEvidenceRef":"github-actions:P15:future-qualified-backup",
      "highDeficiencyStates":{"P34-D001":"accepted_temporarily","P34-D002":"remediating","P34-D005":"closed"},
      "explicitActivationAuthorization":True
    })
    write(obsf,future_obs); write(samplesf,{"samples":rows}); write(ctxf,ready_ctx)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(decision),"--require-ready"])
    ready=load(decision)
    assert ready["decision"]=="ready_to_activate"
    assert ready["successfulSamples"]==13
    assert ready["coverageBuckets"]==[0,1,2,3,4,5]
    assert ready["terminalSamplePresent"] is True
    assert len(ready["decisionId"])==64
    assert len(ready["activationAuthorizationId"])==64

    activation=d/"activation.json"; period=d/"period.json"
    run([sys.executable,str(ACT),str(decision),"--out",str(activation),"--period-out",str(period)])
    activated=load(activation); p=load(period)
    assert activated["state"]=="active"
    assert activated["periodStart"]==future_obs["observedAt"]
    assert activated["activationIsRetroactive"] is False
    assert activated["externalAttestation"] is False
    assert p["mode"]=="operating" and p["backfilled"] is False
    assert p["periodStart"]==future_obs["observedAt"]

    # Epoch drift fails.
    bad=dict(future_obs); bad["migrationHead"]="20990101000000_fake"
    write(obsf,bad)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"drift.json"),"--require-ready"],1)
    assert any(x.startswith("frozen_epoch_changed:migrationHead") for x in load(d/"drift.json")["errors"])

    # Missing a 4-hour bucket fails even with enough total samples.
    write(obsf,future_obs)
    no_bucket=[r for r in rows if not (8 <= (datetime.fromisoformat(r["timestamp"].replace("Z","+00:00"))-start).total_seconds()/3600 < 12)]
    no_bucket += [
      {"timestamp":z(start+timedelta(hours=1,minutes=i)),"status":"success","healthy":True}
      for i in range(5)
    ]
    write(samplesf,{"samples":no_bucket})
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"bucket.json"),"--require-ready"],1)
    assert any(x.startswith("generation4_coverage_buckets_missing:") for x in load(d/"bucket.json")["errors"])

    # Backup is a hard gate.
    write(samplesf,{"samples":rows})
    no_backup=dict(ready_ctx); no_backup["postFinalSharedChangeBackupVerified"]=False
    write(ctxf,no_backup)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"backup.json"),"--require-ready"],1)

    # D001 cannot be skipped by phase override.
    d001=dict(ready_ctx); d001["highDeficiencyStates"]=dict(ready_ctx["highDeficiencyStates"]); d001["highDeficiencyStates"]["P34-D001"]="decision_required"
    write(ctxf,d001)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"d001.json"),"--require-ready"],1)

    # Self authorization and fake baseline hashes fail.
    self_ctx=dict(ready_ctx); self_ctx["authorizedBy"]="platform"
    write(ctxf,self_ctx)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"self.json"),"--require-ready"],1)

    fake=dict(ready_ctx); fake["controlCatalogSha256"]="0"*64
    write(ctxf,fake)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(historical_file),"--out",str(d/"hash.json"),"--require-ready"],1)

    # Stale generation-3 P25 cannot activate generation 4.
    stale_p25=json.loads(json.dumps(p25)); stale_p25["generation"]=3
    stale_file=d/"p25-old.json"; write(stale_file,stale_p25)
    write(ctxf,ready_ctx)
    run([sys.executable,str(EVAL),str(obsf),str(samplesf),str(ctxf),"--p25",str(stale_file),"--out",str(d/"oldgen.json"),"--require-ready"],1)

    # Activator rejects blocked decisions.
    write(decision,cur)
    run([sys.executable,str(ACT),str(decision),"--out",str(d/"badact.json"),"--period-out",str(d/"badperiod.json")],1)

print("P36 remediation, generation-4 freeze and OE activation contracts passed.")
