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
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

plan=load(ROOT/"platform-p40-generation5-activation-plan.json")
obs=load(ROOT/"platform-p40-live-refreeze-observation.json")
decision=load(ROOT/"platform-p40-refreeze-decision.json")
receipt=load(ROOT/"platform-p40-generation5-activation-receipt.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")
backend=load(ROOT/"supabase/backend.json")
app=load(ROOT/".well-known/thiepn-app.json")

assert plan["state"]=="generation5_burn_in_active"
assert p25["state"]=="burn_in_active"
assert p25["generation"]==5
assert p25["currentGenerationEligible"] is True
assert p25["nextGeneration"] is None
assert p25["activatedAt"]==plan["activatedAt"]
assert p25["minimumCompleteAfter"]==plan["minimumCompleteAfter"]
assert p25["currentEpochFreezeEvidence"]==decision["frozenEpoch"]
assert p25["latestSuccessfulEncryptedOffsiteBackup"]["runId"]==37222829955
assert backend["post_upgrade_burn_in_policy"]["current_generation"]==5
assert app["health"]["p25BurnInGeneration"]==5

# P37 receipt identity is canonical and untampered.
d=dict(decision); did=d.pop("decisionId")
assert hid(d)==did
assert did=="4153ec4f7fc90a3afcacc59e61e7fcd78e571b2b2aa5012caa175920f0547e78"

# P38 activation receipt binds the exact current output objects.
output_hashes={
  "platform-p25-burn-in-plan.json":hid(p25),
  "supabase-backend.json":hid(backend),
  "thiepn-app.json":hid(app),
}
assert receipt["outputHashes"]==output_hashes
activation_material={
  "generation":5,
  "activatedAt":receipt["activatedAt"],
  "minimumCompleteAfter":receipt["minimumCompleteAfter"],
  "sourceRefreezeDecisionId":receipt["sourceRefreezeDecisionId"],
  "frozenEpoch":decision["frozenEpoch"],
  "outputHashes":output_hashes,
}
assert hid(activation_material)==receipt["activationReceiptId"]
assert receipt["activationReceiptId"]=="0867969dce6fd97d914c260b2040bdd2243142ff184bb45f9ed4fb46f179ee0f"

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    # Replay protection: an already active generation cannot be refrozen/activated again.
    obsp=d/"obs.json"; write(obsp,obs)
    replay=d/"replay.json"
    run([sys.executable,str(REFREEZE),str(obsp),"--out",str(replay),"--require-ready"],1)
    rr=load(replay)
    assert rr["decision"]=="blocked"
    assert "p25_not_refreeze_pending" in rr["errors"]
    assert "old_generation_still_eligible" in rr["errors"]

    actdir=d/"activation-replay"
    run([sys.executable,str(ACTIVATE),str(ROOT/"platform-p40-refreeze-decision.json"),"--out-dir",str(actdir),"--require-ready"],1)
    ar=load(actdir/"p38-generation5-activation-receipt.json")
    assert ar["decision"]=="blocked"
    assert "p25_not_refreeze_pending" in ar["errors"]
    assert "expected_generation4_predecessor" in ar["errors"]

    # Evidence accumulation starts at activation; older successful samples never count.
    start=datetime.fromisoformat(p25["activatedAt"].replace("Z","+00:00"))
    rows=[
      {"timestamp":z(start-timedelta(minutes=1)),"status":"success","healthy":True,
       "generation":5,"qualifiesForBurnIn":True,"runId":9001},
      {"timestamp":z(start+timedelta(minutes=10)),"status":"success","healthy":True,
       "generation":5,"qualifiesForBurnIn":True,"runId":9002},
      {"timestamp":z(start+timedelta(minutes=20)),"status":"success","healthy":True,
       "generation":4,"qualifiesForBurnIn":True,"runId":9003},
    ]
    samples=d/"samples.json"; progress=d/"progress.json"; write(samples,{"samples":rows})
    run([sys.executable,str(PROGRESS),str(samples),"--at",z(start+timedelta(hours=1)),"--out",str(progress)])
    pr=load(progress)
    assert pr["state"]=="evidence_accumulating"
    assert pr["successfulQualifyingSamples"]==1
    assert pr["readyForP37Certification"] is False
    reasons={x["reason"] for x in pr["rejectedSamples"]}
    assert "pre_activation" in reasons
    assert "wrong_generation" in reasons

print("P40 activation receipt, replay protection and burn-in start contracts passed.")
