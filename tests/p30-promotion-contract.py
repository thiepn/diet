#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUILD=ROOT/"scripts/p30-build-candidate.py"
PROMOTE=ROOT/"scripts/p30-validate-promotion.py"
CERTIFY=ROOT/"scripts/p30-certify-rollout.py"

EPOCH={
 "semanticSchemaSha256":"5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375",
 "migrationHead":"20261003105645",
 "edgeInventorySha256":"8400fe3f4f203d37e8208a8541c2e6ffc7d49ace98871ecdb80fef1026842da8",
 "cronInventorySha256":"9d229da38afa923fb839eaf59e5c3d19dbec96edd47abe008b7c7e00969f2396"
}
BASE={
 "trainId":"train-app-fast-001",
 "trainType":"app_fast",
 "gitSha":"2c1bd74dfab8c45425054e552ba92bc65713c6b5",
 "dependencyGraphVersion":"2026-10-03.1",
 "dependencyGraphSha256":"a"*64,
 "p29CertificateId":"b"*64,
 "changeManifestSha256":"c"*64,
 "impactAnalysisSha256":"d"*64,
 **EPOCH,
 "environmentTopologyVersion":"2026-10-03.2"
}

def run(cmd,expect=0):
    p=subprocess.run(cmd,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

def build(d,manifest):
    mp=d/"manifest.json"; cp=d/"candidate.json"
    mp.write_text(json.dumps(manifest),encoding="utf-8")
    run([sys.executable,str(BUILD),str(mp),"--out",str(cp)])
    return json.loads(cp.read_text()),cp

def decide(d,candidate_path,candidate,evidence,from_stage,to_stage,expect=0):
    ep=d/"evidence.json"; op=d/f"{from_stage}-{to_stage}.json"
    ep.write_text(json.dumps(evidence),encoding="utf-8")
    run([sys.executable,str(PROMOTE),str(candidate_path),str(ep),
         "--from-stage",from_stage,"--to-stage",to_stage,"--out",str(op)],expect)
    return json.loads(op.read_text())

def common(candidate,kind="logical"):
    return {
      "candidateId":candidate["candidateId"],
      "p29CertificateId":candidate["immutable"]["p29CertificateId"],
      "p29CertificateStatus":"pass",
      "observed":dict(EPOCH),
      "organizationPlan":"free",
      "integrationEnvironment":{"kind":kind,"status":"healthy"},
      "gates":{}
    }

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    candidate,cp=build(d,BASE)
    assert len(candidate["candidateId"])==64
    changed=dict(BASE); changed["gitSha"]="f"*40
    candidate2,_=build(d,changed)
    assert candidate["candidateId"]!=candidate2["candidateId"]

    # app_fast may use logical CI
    good=common(candidate)
    r=decide(d,cp,candidate,good,"candidate","integration")
    assert r["status"]=="pass" and r["promotionReceiptId"]

    # stage skipping fails
    r=decide(d,cp,candidate,good,"candidate","production",1)
    assert "stage_skip_or_reverse_not_allowed" in r["errors"]

    # exact P29 certificate binding
    bad=json.loads(json.dumps(good)); bad["p29CertificateId"]="0"*64
    r=decide(d,cp,candidate,bad,"candidate","integration",1)
    assert "p29_certificate_id_mismatch" in r["errors"]

    # stateful release cannot use logical CI alone
    shared=dict(BASE); shared["trainId"]="train-shared-001"; shared["trainType"]="shared_standard"
    shared_candidate,scp=build(d,shared)
    bad=common(shared_candidate)
    r=decide(d,scp,shared_candidate,bad,"candidate","integration",1)
    assert "stateful_release_requires_isolated_stateful_environment" in r["errors"]

    # free ephemeral local Supabase isolation is eligible when fully exercised
    local=common(shared_candidate,"local_supabase_ephemeral")
    local["integrationEnvironment"].update({
      "candidateId":shared_candidate["candidateId"],
      "productionDataUsed":False,
      "migrationsApplied":True,
      "servicesHealthy":True,
      "edgeValidatedWhenInScope":True
    })
    r=decide(d,scp,shared_candidate,local,"candidate","integration")
    assert r["status"]=="pass"

    # hosted preview is not available while org remains Free
    hosted=json.loads(json.dumps(local))
    hosted["integrationEnvironment"]["kind"]="supabase_branch"
    hosted["integrationEnvironment"]["branchActionStatus"]="READY"
    r=decide(d,scp,shared_candidate,hosted,"candidate","integration",1)
    assert "hosted_branch_not_available_on_current_plan" in r["errors"]

    # candidate epoch drift is fail-closed
    stale=json.loads(json.dumps(local)); stale["observed"]["cronInventorySha256"]="e"*64
    r=decide(d,scp,shared_candidate,stale,"candidate","integration",1)
    assert any(x.startswith("stale_candidate:") for x in r["errors"])

    # build a complete app_fast receipt chain
    receipts=[]
    ev=common(candidate)
    receipts.append(decide(d,cp,candidate,ev,"candidate","integration"))

    ev=common(candidate)
    ev["gates"]={
      "p29Compatibility":"pass","securityIntegrity":"pass",
      "productionArtifact":"pass","rollbackOrForwardFix":"pass"
    }
    receipts.append(decide(d,cp,candidate,ev,"integration","production_ready"))

    ev=common(candidate)
    ev["manualProductionApproval"]={"approved":True,"approvalRef":"operator-approval:test"}
    ev["frozenCandidate"]=True
    receipts.append(decide(d,cp,candidate,ev,"production_ready","production"))

    ev=common(candidate); ev["productionDeploymentStatus"]="success"
    receipts.append(decide(d,cp,candidate,ev,"production","observation"))

    ev=common(candidate); ev["observationMinutes"]=30; ev["postReleaseHealth"]="pass"; ev["stopConditions"]={}
    receipts.append(decide(d,cp,candidate,ev,"observation","certified"))

    rollout={
      "promotionReceipts":receipts,
      "p29CertificateId":candidate["immutable"]["p29CertificateId"],
      "p29CertificateStatus":"pass",
      "productionObserved":dict(EPOCH),
      "observationMinutes":30,
      "postReleaseHealth":"pass",
      "stopConditions":{},
      "productionApproval":{"approved":True,"approvalRef":"operator-approval:test"},
      "rolloutMode":"all_at_once"
    }
    ep=d/"rollout.json"; op=d/"certificate.json"
    ep.write_text(json.dumps(rollout),encoding="utf-8")
    run([sys.executable,str(CERTIFY),str(cp),str(ep),"--out",str(op)])
    cert=json.loads(op.read_text())
    assert cert["status"]=="pass"
    assert len(cert["rolloutCertificateId"])==64
    assert cert["productionPromotionPerformedByCertifier"] is False

    short=json.loads(json.dumps(rollout)); short["observationMinutes"]=29
    ep.write_text(json.dumps(short),encoding="utf-8")
    run([sys.executable,str(CERTIFY),str(cp),str(ep),"--out",str(op)],1)
    assert "observation_window_incomplete" in json.loads(op.read_text())["errors"]

    stopped=json.loads(json.dumps(rollout)); stopped["stopConditions"]={"userFacing5xxRegression":True}
    ep.write_text(json.dumps(stopped),encoding="utf-8")
    run([sys.executable,str(CERTIFY),str(cp),str(ep),"--out",str(op)],1)
    assert any(x.startswith("active_stop_conditions:") for x in json.loads(op.read_text())["errors"])

    fake=json.loads(json.dumps(rollout)); fake["rolloutMode"]="canary"; fake.pop("trafficRoutingEvidence",None)
    ep.write_text(json.dumps(fake),encoding="utf-8")
    run([sys.executable,str(CERTIFY),str(cp),str(ep),"--out",str(op)],1)
    assert "false_canary_claim" in json.loads(op.read_text())["errors"]

    drift=json.loads(json.dumps(rollout)); drift["productionObserved"]["migrationHead"]="20261003110000"
    ep.write_text(json.dumps(drift),encoding="utf-8")
    run([sys.executable,str(CERTIFY),str(cp),str(ep),"--out",str(op)],1)
    assert any(x.startswith("production_epoch_mismatch:") for x in json.loads(op.read_text())["errors"])

print("P30 immutable candidate, promotion and rollout-certificate contracts passed.")
