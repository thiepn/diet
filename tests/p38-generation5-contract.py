#!/usr/bin/env python3
import hashlib,json,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REFREEZE=ROOT/"scripts/p37-evaluate-refreeze.py"
ACTIVATE=ROOT/"scripts/p38-activate-generation5.py"
PROGRESS=ROOT/"scripts/p38-burnin-progress.py"

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

plan=load(ROOT/"platform-p38-generation5-refreeze-plan.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")

assert plan["phase"]=="P38"
assert plan["state"]=="implementation_active_refreeze_blocked"
assert plan["currentRefreezeStatus"]["decision"]=="blocked"
assert plan["currentRefreezeStatus"]["quietMinutesObserved"]==41.79
assert plan["currentRefreezeStatus"]["postFinalChangeEncryptedBackupVerified"] is False
assert p25["state"]=="refreeze_pending"
assert p25["generation"]==4
assert p25["nextGeneration"]==5
assert p25["currentGenerationEligible"] is False
assert p25["pendingGeneration5"]["edgeQuietMinutesObserved"]==4.14
assert p25["pendingGeneration5"]["candidateRevision"]==2
assert p25["pendingGeneration5"]["lastDecision"]=="blocked"

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs=d/"obs.json"; blocked=d/"blocked.json"; readyf=d/"ready.json"
    candidate=p25["pendingGeneration5"]["candidateEpoch"]
    current={
      "projectStatus":"ACTIVE_HEALTHY",**candidate,
      "crossAppSmokePassed":True,"authHealthy":True,"realtimeHealthy":True,
      "postgrestHealthy":True,"storageHealthy":True,
      "securityAdvisorsReviewed":True,"performanceAdvisorsReviewed":True,
      "postFinalSharedChangeBackupVerified":False,"backupEvidenceRef":None
    }
    write(obs,current)
    run([sys.executable,str(REFREEZE),str(obs),"--out",str(blocked)])
    bd=load(blocked)
    assert bd["decision"]=="blocked"
    assert any(x.startswith("quiet_window_open:") for x in bd["errors"])
    assert "post_final_change_backup_not_verified" in bd["errors"]

    source_hashes={
      "p25":sha(ROOT/"platform-p25-burn-in-plan.json"),
      "backend":sha(ROOT/"supabase/backend.json"),
      "app":sha(ROOT/".well-known/thiepn-app.json")
    }

    # A blocked P37 receipt cannot create an activation preview.
    outdir=d/"blocked-preview"
    run([sys.executable,str(ACTIVATE),str(blocked),"--out-dir",str(outdir),"--require-ready"],1)
    receipt=load(outdir/"p38-generation5-activation-receipt.json")
    assert receipt["decision"]=="blocked"
    assert receipt["activationReceiptId"] is None
    assert not (outdir/"platform-p25-burn-in-plan.json").exists()

    # Simulate the first legitimate future refreeze after quiet + backup.
    latest_change=datetime.fromisoformat(candidate["latestSharedChangeAt"].replace("Z","+00:00"))
    future=dict(current)
    future.update({
      "observedAt":z(latest_change+timedelta(minutes=65)),
      "postFinalSharedChangeBackupVerified":True,
      "backupEvidenceRef":"github-actions:P15:post-final-shared-change-backup"
    })
    write(obs,future)
    run([sys.executable,str(REFREEZE),str(obs),"--out",str(readyf),"--require-ready"])
    ready=load(readyf)
    assert ready["decision"]=="ready_to_activate_generation5"
    assert ready["generation"]==5
    assert ready["quietMinutesObserved"]>=60
    assert ready["frozenEpoch"]["postFinalChangeEncryptedBackupVerified"] is True

    outdir=d/"ready-preview"
    run([sys.executable,str(ACTIVATE),str(readyf),"--out-dir",str(outdir),"--require-ready"])
    ar=load(outdir/"p38-generation5-activation-receipt.json")
    preview=load(outdir/"platform-p25-burn-in-plan.json")
    backend=load(outdir/"supabase-backend.json")
    app=load(outdir/"thiepn-app.json")
    assert ar["decision"]=="ready_to_commit_generation5_activation"
    assert len(ar["activationReceiptId"])==64
    assert ar["sourceFilesMutated"] is False
    assert preview["state"]=="burn_in_active"
    assert preview["generation"]==5
    assert preview["currentGenerationEligible"] is True
    assert preview["nextGeneration"] is None
    assert preview["activatedAt"]==future["observedAt"]
    assert preview["minimumCompleteAfter"]==z(datetime.fromisoformat(future["observedAt"].replace("Z","+00:00"))+timedelta(hours=24))
    assert preview["currentEpochFreezeEvidence"]["backupEvidenceRef"]=="github-actions:P15:post-final-shared-change-backup"
    assert backend["post_upgrade_burn_in_policy"]["current_generation"]==5
    assert backend["post_upgrade_burn_in_policy"]["current_generation_eligible"] is True
    assert app["health"]["p25BurnInGeneration"]==5
    assert app["health"]["p25BurnInActive"] is True

    # Preview creation must not mutate source files.
    assert sha(ROOT/"platform-p25-burn-in-plan.json")==source_hashes["p25"]
    assert sha(ROOT/"supabase/backend.json")==source_hashes["backend"]
    assert sha(ROOT/".well-known/thiepn-app.json")==source_hashes["app"]

    # Deterministic activation receipt.
    outdir2=d/"ready-preview-2"
    run([sys.executable,str(ACTIVATE),str(readyf),"--out-dir",str(outdir2),"--require-ready"])
    assert load(outdir2/"p38-generation5-activation-receipt.json")["activationReceiptId"]==ar["activationReceiptId"]

    active=d/"active.json"; write(active,preview)
    start=datetime.fromisoformat(preview["activatedAt"].replace("Z","+00:00"))
    minimum=datetime.fromisoformat(preview["minimumCompleteAfter"].replace("Z","+00:00"))

    # Early evidence: wrong gen, pre-activation, duplicate and non-qualifying rows do not count.
    rows=[
      {"timestamp":z(start-timedelta(minutes=1)),"status":"success","healthy":True,"generation":5,"qualifiesForBurnIn":True,"runId":1},
      {"timestamp":z(start+timedelta(hours=1)),"status":"success","healthy":True,"generation":4,"qualifiesForBurnIn":True,"runId":2},
      {"timestamp":z(start+timedelta(hours=1)),"status":"success","healthy":True,"generation":5,"qualifiesForBurnIn":False,"runId":3},
      {"timestamp":z(start+timedelta(hours=1)),"status":"success","healthy":True,"generation":5,"qualifiesForBurnIn":True,"runId":4},
      {"timestamp":z(start+timedelta(hours=1)),"status":"success","healthy":True,"generation":5,"qualifiesForBurnIn":True,"runId":4}
    ]
    samples=d/"samples.json"; progress=d/"progress.json"; write(samples,{"samples":rows})
    run([sys.executable,str(PROGRESS),str(samples),"--p25",str(active),"--at",z(start+timedelta(hours=2)),"--out",str(progress)])
    pr=load(progress)
    assert pr["state"]=="evidence_accumulating"
    assert pr["successfulQualifyingSamples"]==1
    assert pr["coverageBuckets"]==[0]
    assert pr["readyForP37Certification"] is False
    reasons={x["reason"] for x in pr["rejectedSamples"]}
    assert {"pre_activation","wrong_generation","not_qualifying","duplicate_sample"} <= reasons

    # Complete evidence spans six buckets and includes terminal sample.
    rows=[]
    for i,h in enumerate((1,3,5,7,9,11,13,15,17,19,21,23)):
      rows.append({"timestamp":z(start+timedelta(hours=h)),"status":"success","healthy":True,
                   "generation":5,"qualifiesForBurnIn":True,"runId":100+i})
    rows.append({"timestamp":z(minimum+timedelta(minutes=1)),"status":"success","healthy":True,
                 "generation":5,"qualifiesForBurnIn":True,"runId":999})
    write(samples,{"samples":rows})
    run([sys.executable,str(PROGRESS),str(samples),"--p25",str(active),
         "--at",z(minimum+timedelta(minutes=5)),"--out",str(progress),"--require-certifiable"])
    pr=load(progress)
    assert pr["state"]=="certifiable"
    assert pr["successfulQualifyingSamples"]==13
    assert pr["coverageBuckets"]==[0,1,2,3,4,5]
    assert pr["missingCoverageBuckets"]==[]
    assert pr["terminalSamplePresent"] is True
    assert pr["readyForP37Certification"] is True
    assert len(pr["progressId"])==64

    # Missing one bucket stays fail-closed even with enough total samples.
    no_bucket=[r for r in rows if not (8 <= (datetime.fromisoformat(r["timestamp"].replace("Z","+00:00"))-start).total_seconds()/3600 < 12)]
    no_bucket += [
      {"timestamp":z(start+timedelta(hours=1,minutes=i)),"status":"success","healthy":True,
       "generation":5,"qualifiesForBurnIn":True,"runId":2000+i}
      for i in range(5)
    ]
    write(samples,{"samples":no_bucket})
    run([sys.executable,str(PROGRESS),str(samples),"--p25",str(active),
         "--at",z(minimum+timedelta(minutes=5)),"--out",str(progress),"--require-certifiable"],1)
    pr=load(progress)
    assert 2 in pr["missingCoverageBuckets"]
    assert pr["readyForP37Certification"] is False

print("P38 generation-5 activation preview and evidence continuity contracts passed.")
