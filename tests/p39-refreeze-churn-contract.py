#!/usr/bin/env python3
import hashlib,json,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RECONCILE=ROOT/"scripts/p39-reconcile-refreeze-candidate.py"

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

p25=load(ROOT/"platform-p25-burn-in-plan.json")
plan=load(ROOT/"platform-p39-refreeze-churn-plan.json")

assert plan["phase"]=="P39"
assert plan["state"]=="implementation_active_candidate_rebased"
assert p25["state"]=="refreeze_pending"
assert p25["nextGeneration"]==5
assert p25["pendingGeneration5"]["candidateRevision"]==2
assert p25["pendingGeneration5"]["state"]=="waiting_quiet_window_and_fresh_backup"
assert p25["pendingGeneration5"]["candidateEpoch"]["migrationHead"]=="20261004173117_gomoku_p23_security_admission_gate"
assert p25["pendingGeneration5"]["candidateEpoch"]["gomokuRoomVersion"]==50
assert p25["pendingGeneration5"]["edgeQuietMinutesObserved"]==4.14
assert p25["pendingGeneration5"]["latestSuccessfulBackup"]["runId"]==37218356705
assert p25["pendingGeneration5"]["latestSuccessfulBackup"]["freshForCandidate"] is False

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs=d/"obs.json"; backup=d/"backup.json"; out=d/"out"
    candidate=p25["pendingGeneration5"]["candidateEpoch"]
    current={
      "projectStatus":"ACTIVE_HEALTHY",**candidate,
      "migrationChangedAt":"2026-10-04T17:31:17Z"
    }
    stale={
      "runId":37218356705,
      "conclusion":"success",
      "createdAt":"2026-10-04T16:52:34Z",
      "verificationPassed":True,
      "encrypted":True,
      "artifactAvailable":True,
      "artifactId":11309815027,
      "artifactDigest":"sha256:3c5acd5fca64f6dbed7df766eab0bd0c86fe61ee267d97d706e7e0ad25fae874",
      "evidenceRef":"github-actions:P15:37218356705:11309815027"
    }
    write(obs,current); write(backup,stale)

    sources={
      "p25":sha(ROOT/"platform-p25-burn-in-plan.json"),
      "backend":sha(ROOT/"supabase/backend.json"),
      "app":sha(ROOT/".well-known/thiepn-app.json")
    }

    run([sys.executable,str(RECONCILE),str(obs),str(backup),"--out-dir",str(out)])
    r=load(out/"p39-refreeze-reconcile-receipt.json")
    preview=load(out/"platform-p25-burn-in-plan.json")
    assert r["decision"]=="blocked"
    assert r["candidateRebased"] is False
    assert r["candidateRevision"]==2
    assert r["backupValid"] is True
    assert r["backupFresh"] is False
    assert "backup_predates_latest_shared_change" in r["blockers"]
    assert any(x.startswith("quiet_window_open:") for x in r["blockers"])
    assert preview["nextGeneration"]==5
    assert preview["pendingGeneration5"]["candidateRevision"]==2
    assert preview["pendingGeneration5"]["eligibleToActivate"] is False

    # Reconciliation is preview-only.
    assert sha(ROOT/"platform-p25-burn-in-plan.json")==sources["p25"]
    assert sha(ROOT/"supabase/backend.json")==sources["backend"]
    assert sha(ROOT/".well-known/thiepn-app.json")==sources["app"]

    # Same candidate becomes ready only with >=60 quiet minutes and a fresh verified encrypted backup.
    latest=datetime.fromisoformat(candidate["latestSharedChangeAt"].replace("Z","+00:00"))
    future=json.loads(json.dumps(current))
    future["observedAt"]=z(latest+timedelta(minutes=65))
    fresh=dict(stale)
    fresh.update({
      "runId":40000000000,
      "createdAt":z(latest+timedelta(minutes=20)),
      "artifactId":12000000000,
      "artifactDigest":"sha256:"+"a"*64,
      "evidenceRef":"github-actions:P15:40000000000:12000000000"
    })
    write(obs,future); write(backup,fresh)
    ready_dir=d/"ready"
    run([sys.executable,str(RECONCILE),str(obs),str(backup),"--out-dir",str(ready_dir),"--require-ready"])
    rr=load(ready_dir/"p39-refreeze-reconcile-receipt.json")
    rp=load(ready_dir/"platform-p25-burn-in-plan.json")
    assert rr["decision"]=="ready_for_p37_refreeze"
    assert rr["candidateRebased"] is False
    assert rr["backupFresh"] is True
    assert rr["quietMinutesObserved"]>=60
    assert rp["pendingGeneration5"]["eligibleToActivate"] is True
    assert rp["pendingGeneration5"]["postFinalChangeEncryptedBackupVerified"] is True
    assert rp["pendingGeneration5"]["backupEvidenceRef"]==fresh["evidenceRef"]

    # A new pre-activation epoch keeps generation 5 but rebases the candidate and invalidates backup freshness.
    moved=json.loads(json.dumps(future))
    moved["observedAt"]=z(latest+timedelta(minutes=70))
    moved["gomokuRoomVersion"]=51
    moved["gomokuRoomSha256"]="b"*64
    moved["edgeInventorySha256"]="c"*64
    moved["latestSharedChangeAt"]=z(latest+timedelta(minutes=69))
    moved["latestSharedChangeComponent"]="gomoku-room"
    moved["latestSharedChangeVersion"]=51
    moved["latestSharedChangeSha256"]="b"*64
    write(obs,moved)
    rebased_dir=d/"rebased"
    run([sys.executable,str(RECONCILE),str(obs),str(backup),"--out-dir",str(rebased_dir)])
    rb=load(rebased_dir/"p39-refreeze-reconcile-receipt.json")
    rbp=load(rebased_dir/"platform-p25-burn-in-plan.json")
    assert rb["decision"]=="blocked"
    assert rb["candidateRebased"] is True
    assert rb["candidateRevision"]==3
    assert rb["backupFresh"] is False
    assert rbp["nextGeneration"]==5
    assert rbp["pendingGeneration5"]["generation"]==5
    assert rbp["pendingGeneration5"]["candidateRevision"]==3
    assert rbp["pendingGeneration5"]["candidateRebaseReason"]=="pre_activation_shared_epoch_changed"

    # Invalid backup evidence can never satisfy the gate.
    bad=dict(fresh); bad["verificationPassed"]=False
    write(obs,future); write(backup,bad)
    run([sys.executable,str(RECONCILE),str(obs),str(backup),"--out-dir",str(d/"bad"),"--require-ready"],1)
    assert "backup_evidence_invalid" in load(d/"bad"/"p39-refreeze-reconcile-receipt.json")["blockers"]

print("P39 candidate reconciliation, backup freshness and generation-retention contracts passed.")
