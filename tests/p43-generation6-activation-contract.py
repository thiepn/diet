#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REVALIDATE=ROOT/"scripts/p43-final-revalidate.py"
ACTIVATE=ROOT/"scripts/p43-activate-generation6.py"

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

plan=load(ROOT/"platform-p43-final-revalidation.json")
obs=load(ROOT/"platform-p43-live-observation.json")
backup=load(ROOT/"platform-p43-backup-evidence.json")
p42=load(ROOT/"platform-p42-generation6-refreeze-plan.json")

assert plan["state"]=="blocked_quiet_window"
assert plan["generation"]==6
assert plan["candidateRevision"]==4
assert plan["exactCandidateMatch"] is True
assert plan["quietWindow"]["satisfied"] is False
assert plan["backup"]["freshForCandidate"] is True
assert plan["activation"]["generation6Activated"] is False

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    current=d/"current.json"
    run([sys.executable,str(REVALIDATE),str(ROOT/"platform-p43-live-observation.json"),
         str(ROOT/"platform-p43-backup-evidence.json"),"--out",str(current),"--require-ready"],1)
    c=load(current)
    assert c["decision"]=="blocked"
    assert c["candidateEpochStable"] is True
    assert c["backupFresh"] is True
    assert c["quietMinutesObserved"] < 60
    assert len(c["errors"])==1
    assert c["errors"][0].startswith("quiet_window_open:")

    # Activation transform must refuse the current blocked decision.
    blocked_dir=d/"blocked-activation"
    run([sys.executable,str(ACTIVATE),str(current),"--out-dir",str(blocked_dir),"--require-ready"],1)
    ar=load(blocked_dir/"p43-generation6-activation-receipt.json")
    assert ar["decision"]=="blocked"
    assert "final_revalidation_not_ready" in ar["errors"]

    # Synthetic boundary completion on the exact same epoch becomes ready.
    latest=datetime.fromisoformat(p42["candidateEpoch"]["latestSharedChangeAt"].replace("Z","+00:00"))
    readyobs=dict(obs)
    readyobs["observedAt"]=z(latest+timedelta(minutes=61))
    readyobsf=d/"readyobs.json"; decisionf=d/"ready.json"
    write(readyobsf,readyobs)
    run([sys.executable,str(REVALIDATE),str(readyobsf),
         str(ROOT/"platform-p43-backup-evidence.json"),"--out",str(decisionf),"--require-ready"])
    decision=load(decisionf)
    assert decision["decision"]=="ready_to_activate_generation6"
    assert decision["eligibleToActivate"] is True
    assert decision["quietMinutesObserved"]==61.0
    assert decision["backupFresh"] is True
    assert decision["minimumCompleteAfter"] is not None
    assert decision["frozenEpoch"]["migrationHead"]==p42["candidateEpoch"]["migrationHead"]

    # Ready decision deterministically produces repository-only activation outputs.
    actdir=d/"activation"
    run([sys.executable,str(ACTIVATE),str(decisionf),"--out-dir",str(actdir),"--require-ready"])
    receipt=load(actdir/"p43-generation6-activation-receipt.json")
    newp=load(actdir/"platform-p25-burn-in-plan.json")
    newb=load(actdir/"supabase-backend.json")
    newa=load(actdir/"thiepn-app.json")
    assert receipt["decision"]=="ready_to_commit_generation6_activation"
    assert receipt["productionMutationPerformed"] is False
    assert receipt["activationReceiptId"]
    assert newp["generation"]==6
    assert newp["state"]=="burn_in_active"
    assert newp["currentGenerationEligible"] is True
    assert newp["pendingGeneration6"]["state"]=="activated"
    assert newp["generation6Sampling"]["preActivationSamplesQualify"] is False
    assert newb["post_upgrade_burn_in_policy"]["current_generation"]==6
    assert newa["health"]["p25BurnInGeneration"]==6

    # A later epoch change still fails closed after the time boundary.
    moved=dict(readyobs)
    moved["migrationVersion"]="20261005160000"
    moved["migrationName"]="later_shared_change"
    moved["migrationHead"]="20261005160000_later_shared_change"
    movedf=d/"moved.json"; movedout=d/"movedout.json"
    write(movedf,moved)
    run([sys.executable,str(REVALIDATE),str(movedf),
         str(ROOT/"platform-p43-backup-evidence.json"),"--out",str(movedout),"--require-ready"],1)
    mr=load(movedout)
    assert mr["eligibleToActivate"] is False
    assert mr["candidateEpochStable"] is False
    assert "candidate_epoch_changed:migrationHead" in mr["errors"]

print("P43 final revalidation and generation-6 activation contracts passed.")
