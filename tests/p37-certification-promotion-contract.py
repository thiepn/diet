#!/usr/bin/env python3
import hashlib,json,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REFREEZE=ROOT/"scripts/p37-evaluate-refreeze.py"
CERT=ROOT/"scripts/p37-certify-burnin.py"
STACK=ROOT/"scripts/p37-certify-governance-stack.py"
LAUNCH=ROOT/"scripts/p37-build-oe-launch.py"

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def fsha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

plan=load(ROOT/"platform-p37-certification-promotion-launch-plan.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")
risk=load(ROOT/"platform-p37-d001-risk-treatment.json")
manifest=load(ROOT/"contracts/p37-governance-stack-manifest.json")

assert plan["state"]=="implementation_active_generation5_burn_in"
assert plan["currentReality"]["generation4Invalidated"] is True
assert plan["currentReality"]["nextGeneration"] is None
assert plan["currentReality"]["oePeriodStarted"] is False
assert p25["state"]=="burn_in_active"
assert p25["generation"]==5 and p25["currentGenerationEligible"] is True and p25["nextGeneration"] is None
assert p25["pendingGeneration5"]["eligibleToActivate"] is True
assert risk["state"]=="prepared_pending_independent_risk_approval"
assert risk["riskAcceptanceAuthorized"] is False
assert len(manifest["phases"])==11
assert manifest["phases"][-1]["mergeSha"]=="c8c374917d739c971fe142cf16c3449d6c64e8cd"

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs=d/"obs.json"; ref=d/"refreeze.json"
    cand=p25["pendingGeneration5"]["candidateEpoch"]
    pending=json.loads(json.dumps(p25))
    pending.update({
      "state":"refreeze_pending","generation":4,"generationState":"invalidated_epoch_changed",
      "currentGenerationEligible":False,"nextGeneration":5
    })
    pending["pendingGeneration5"].update({
      "state":"waiting_quiet_window_and_fresh_backup","eligibleToActivate":False,
      "postFinalChangeEncryptedBackupVerified":False,"backupEvidenceRef":None
    })
    pendingf=d/"pending-p25.json"; write(pendingf,pending)
    current={
      "projectStatus":"ACTIVE_HEALTHY",
      **cand,
      "crossAppSmokePassed":True,"authHealthy":True,"realtimeHealthy":True,
      "postgrestHealthy":True,"storageHealthy":True,
      "securityAdvisorsReviewed":True,"performanceAdvisorsReviewed":True,
      "postFinalSharedChangeBackupVerified":False,"backupEvidenceRef":None
    }
    write(obs,current)
    run([sys.executable,str(REFREEZE),str(obs),"--p25",str(pendingf),"--out",str(ref)])
    r=load(ref)
    assert r["decision"]=="blocked"
    assert any(x.startswith("quiet_window_open:") for x in r["errors"])
    assert "post_final_change_backup_not_verified" in r["errors"]
    run([sys.executable,str(REFREEZE),str(obs),"--p25",str(pendingf),"--out",str(d/"ref-required.json"),"--require-ready"],1)

    # Future legitimate generation-5 refreeze, relative to whichever candidate is current.
    latest_change=datetime.fromisoformat(cand["latestSharedChangeAt"].replace("Z","+00:00"))
    future=dict(current)
    future.update({
      "observedAt":z(latest_change+timedelta(minutes=65)),
      "postFinalSharedChangeBackupVerified":True,
      "backupEvidenceRef":"github-actions:P15:future-post-final-change-backup"
    })
    write(obs,future)
    run([sys.executable,str(REFREEZE),str(obs),"--p25",str(pendingf),"--out",str(ref),"--require-ready"])
    ready=load(ref)
    assert ready["decision"]=="ready_to_activate_generation5"
    assert ready["generation"]==5
    assert ready["quietMinutesObserved"]>=60
    assert ready["frozenEpoch"]["postFinalChangeEncryptedBackupVerified"] is True

    # Epoch drift blocks refreeze.
    drift=dict(future); drift["gomokuRoomVersion"]=cand["gomokuRoomVersion"]+1
    write(obs,drift)
    run([sys.executable,str(REFREEZE),str(obs),"--p25",str(pendingf),"--out",str(d/"ref-drift.json"),"--require-ready"],1)
    assert "candidate_epoch_changed:gomokuRoomVersion" in load(d/"ref-drift.json")["errors"]

    # Build a future active generation 5 from a valid refreeze receipt.
    active=json.loads(json.dumps(pending))
    active["state"]="burn_in_active"; active["generationState"]="burn_in_active"
    active["generation"]=5; active["currentGenerationEligible"]=True; active["nextGeneration"]=None
    active["activatedAt"]=future["observedAt"]
    active["minimumCompleteAfter"]=ready["minimumCompleteAfter"]
    active["currentEpochFreezeEvidence"]=ready["frozenEpoch"]
    active["completionState"]={"complete":False,"invalidated":False,"remaining":[]}
    activef=d/"active-p25.json"; write(activef,active)

    start=datetime.fromisoformat(active["activatedAt"].replace("Z","+00:00"))
    minimum=datetime.fromisoformat(active["minimumCompleteAfter"].replace("Z","+00:00"))
    rows=[]
    for i,h in enumerate((1,3,5,7,9,11,13,15,17,19,21,23)):
        rows.append({"timestamp":z(start+timedelta(hours=h)),"status":"success","healthy":True,
                     "generation":5,"qualifiesForBurnIn":True,"runId":1000+i})
    rows.append({"timestamp":z(minimum+timedelta(minutes=1)),"status":"success","healthy":True,
                 "generation":5,"qualifiesForBurnIn":True,"runId":2000})
    samples=d/"samples.json"; write(samples,{"samples":rows})

    certobs=dict(future)
    certobs["observedAt"]=z(minimum+timedelta(minutes=5))
    certobs["postFinalSharedChangeBackupVerified"]=True
    write(obs,certobs)
    cert=d/"cert.json"
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(activef),"--out",str(cert),"--require-certified"])
    bc=load(cert)
    assert bc["decision"]=="certified" and bc["generation"]==5
    assert bc["successfulSamples"]==13
    assert bc["coveredBuckets"]==[0,1,2,3,4,5]
    assert len(bc["certificateId"])==64

    # Pre-refreeze samples never qualify.
    badrows=json.loads(json.dumps(rows))
    for row in badrows: row["qualifiesForBurnIn"]=False
    write(samples,{"samples":badrows})
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(activef),"--out",str(d/"pre.json"),"--require-certified"],1)
    pre=load(d/"pre.json")
    assert "insufficient_successful_samples" in pre["errors"]
    assert pre["successfulSamples"]==0

    # Wrong generation samples never qualify.
    wrong=json.loads(json.dumps(rows))
    for row in wrong: row["generation"]=4
    write(samples,{"samples":wrong})
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(activef),"--out",str(d/"wrong.json"),"--require-certified"],1)

    # Restore qualifying samples.
    write(samples,{"samples":rows})

    # Current merged governance stack certifies without re-promoting old PRs.
    stack=d/"stack.json"
    run([sys.executable,str(STACK),"--out",str(stack),"--require-certified"])
    gs=load(stack)
    assert gs["decision"]=="certified"
    assert gs["mergedPhases"]==[f"P{i}" for i in range(26,37)]
    assert gs["latestMergedMainSha"]=="c8c374917d739c971fe142cf16c3449d6c64e8cd"
    assert gs["p32Mode"]=="warn"
    assert len(gs["certificateId"])==64

    # Current risk file is intentionally not accepted; launch must block.
    ctx={
      "observedAt":certobs["observedAt"],"p32Mode":"warn","p33CanonicalEvidenceActive":True,
      "controlCatalogFrozen":True,"controlCatalogVersion":"2026-10-03.1",
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficiencyStates":{"P34-D001":"decision_required","P34-D002":"remediating","P34-D005":"closed","P34-D006":"closed"},
      "passwordAuthUsers":0,"explicitLaunchAuthorization":False,
      "requestedBy":"platform","authorizedBy":"independent-reviewer",
      "certifiedGeneration":5,"burninCertificateId":bc["certificateId"],
      "governanceCertificateId":gs["certificateId"],
      "p33HeadHash":load(ROOT/"platform-p33-ledger-anchor.json")["headHash"],
      "p33AnchorSha256":fsha(ROOT/"platform-p33-ledger-anchor.json"),
      "controlCatalogSha256":fsha(ROOT/"platform-p34-control-catalog.json"),
      "p34SnapshotSha256":fsha(ROOT/"platform-p34-assurance-snapshot.json")
    }
    ctxf=d/"ctx.json"; write(ctxf,ctx)
    launch=d/"launch.json"
    run([sys.executable,str(LAUNCH),str(cert),str(stack),str(ctxf),"--out",str(launch)])
    blocked=load(launch)
    assert blocked["decision"]=="blocked"
    assert "high_deficiency_not_dispositioned:P34-D001" in blocked["errors"]
    assert "explicit_launch_authorization_missing" in blocked["errors"]

    # Future independently accepted bounded D001 treatment + independent launch authorization may pass.
    activeRisk=json.loads(json.dumps(risk))
    activeRisk.update({
      "state":"active","riskAcceptanceAuthorized":True,
      "activatedAt":ctx["observedAt"],"expiresAt":z(datetime.fromisoformat(ctx["observedAt"].replace("Z","+00:00"))+timedelta(days=30)),
      "requestedBy":"platform-owner","approvedBy":"risk-reviewer","approvalRef":"approval:test-p37-d001"
    })
    riskf=d/"risk.json"; write(riskf,activeRisk)
    ctx["highDeficiencyStates"]["P34-D001"]="accepted_temporarily"
    ctx["explicitLaunchAuthorization"]=True
    ctx["requestedBy"]="platform-owner"; ctx["authorizedBy"]="launch-reviewer"
    write(ctxf,ctx)
    run([sys.executable,str(LAUNCH),str(cert),str(stack),str(ctxf),"--risk",str(riskf),"--out",str(launch),"--require-launchable"])
    launched=load(launch)
    assert launched["decision"]=="launchable"
    assert launched["oeState"]=="ready_to_start"
    assert launched["periodStart"]==ctx["observedAt"]
    assert launched["activationIsRetroactive"] is False
    assert len(launched["launchAuthorizationId"])==64

    # Self-authorization fails.
    selfctx=dict(ctx); selfctx["authorizedBy"]=selfctx["requestedBy"]; write(ctxf,selfctx)
    run([sys.executable,str(LAUNCH),str(cert),str(stack),str(ctxf),"--risk",str(riskf),"--out",str(d/"self.json"),"--require-launchable"],1)

    # Fake baseline hash fails.
    badctx=dict(ctx); badctx["controlCatalogSha256"]="0"*64; write(ctxf,badctx)
    run([sys.executable,str(LAUNCH),str(cert),str(stack),str(ctxf),"--risk",str(riskf),"--out",str(d/"hash.json"),"--require-launchable"],1)

print("P37 refreeze, current-generation burn-in, merged-stack and OE launch contracts passed.")
