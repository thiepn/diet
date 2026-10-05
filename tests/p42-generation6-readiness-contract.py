#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/p42-evaluate-generation6-readiness.py"

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def run(args,expect=0):
    p=subprocess.run(args,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

plan=load(ROOT/"platform-p42-generation6-refreeze-plan.json")
obs=load(ROOT/"platform-p42-live-candidate-observation.json")
backup=load(ROOT/"platform-p42-latest-backup-evidence.json")

assert plan["phase"]=="P42"
assert plan["state"]=="refreeze_pending"
assert plan["generation"]==6
assert plan["predecessor"]["generation"]==5
assert plan["predecessor"]["state"]=="invalidated_epoch_changed"
assert plan["candidateEpoch"]["migrationHead"]=="20261005134753_library_account_deletion_authority"\nassert plan["candidateRevision"]==2\nassert plan["candidateEpoch"]["semanticSchemaSha256"]=="c91f0cf78cc6db7399081fd3fd0595ef84f0c0b4517d11a4767c3f2464bac174"
assert plan["quietWindow"]["satisfied"] is False
assert plan["backupGate"]["latestSuccessfulRunId"]==37324434181\nassert plan["backupGate"]["latestSuccessfulBackupFreshForCandidate"] is False
assert plan["activationReadiness"]["eligibleToActivate"] is False

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    out=d/"current.json"
    run([sys.executable,str(SCRIPT),
         str(ROOT/"platform-p42-live-candidate-observation.json"),
         str(ROOT/"platform-p42-latest-backup-evidence.json"),
         "--out",str(out),"--require-ready"],1)
    r=load(out)
    assert r["decision"]=="blocked"
    assert r["eligibleToActivate"] is False
    assert r["backupValid"] is True
    assert r["backupFresh"] is False
    assert any(x.startswith("quiet_window_open:") for x in r["blockers"])
    assert "backup_predates_latest_shared_change" in r["blockers"]

    # Same epoch becomes ready only after 60 minutes and with a fresh valid backup.
    latest=datetime.fromisoformat(obs["latestSharedChangeAt"].replace("Z","+00:00"))
    future=dict(obs)
    future["observedAt"]=z(latest+timedelta(minutes=65))
    fresh=dict(backup)
    fresh.update({
      "runId":99999999999,
      "runNumber":999,
      "createdAt":z(latest+timedelta(minutes=10)),
      "verificationPassed":True,
      "encrypted":True,
      "artifactAvailable":True,
      "artifactExpired":False,
      "artifactId":99999999999,
      "artifactDigest":"sha256:"+"a"*64,
      "freshForCandidate":True
    })
    futuref=d/"future.json"; freshf=d/"fresh.json"; ready=d/"ready.json"
    write(futuref,future); write(freshf,fresh)
    run([sys.executable,str(SCRIPT),str(futuref),str(freshf),"--out",str(ready),"--require-ready"])
    rr=load(ready)
    assert rr["decision"]=="ready_to_activate_generation6"
    assert rr["eligibleToActivate"] is True
    assert rr["backupFresh"] is True
    assert rr["quietMinutesObserved"]==65.0
    assert rr["blockers"]==[]

    # A changed epoch must fail closed even with a fresh backup and enough elapsed time.
    moved=dict(future)
    moved["migrationVersion"]="20261005150000"
    moved["migrationName"]="some_later_shared_change"
    moved["migrationHead"]="20261005150000_some_later_shared_change"
    movedf=d/"moved.json"; blocked=d/"moved-result.json"
    write(movedf,moved)
    run([sys.executable,str(SCRIPT),str(movedf),str(freshf),"--out",str(blocked),"--require-ready"],1)
    br=load(blocked)
    assert br["eligibleToActivate"] is False
    assert br["candidateEpochStable"] is False
    assert "candidate_epoch_changed:migrationHead" in br["blockers"]

print("P42 generation-6 readiness contracts passed.")
