#!/usr/bin/env python3
import hashlib,json,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVAL=ROOT/"scripts/p41-evaluate-burnin-epoch.py"

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,o): Path(p).write_text(json.dumps(o),encoding="utf-8")
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p
def z(d): return d.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

obs=load(ROOT/"platform-p41-live-epoch-observation.json")
samples=load(ROOT/"platform-p41-generation5-samples.json")
receipt=load(ROOT/"platform-p41-generation5-invalidation-receipt.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")

material=dict(receipt); rid=material.pop("receiptId")
assert hid(material)==rid
assert rid=="a82f168c21ff694cfd386395cfeb3aa936c1b3acfdcb496c2885fa708ee2c886"

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    # Reconstruct the active generation-5 state from P40 for the evaluator.
    active=json.loads(json.dumps(p25))
    active.update({
      "state":"burn_in_active","generation":5,"generationState":"burn_in_active",
      "currentGenerationEligible":True,"nextGeneration":None,
      "activatedAt":"2026-10-04T18:52:01.712991Z",
      "minimumCompleteAfter":"2026-10-05T18:52:01.712991Z"
    })
    active["currentEpochFreezeEvidence"]=obs["frozenEpoch"]
    activef=d/"active.json"; write(activef,active)
    out=d/"evaluation.json"
    run([sys.executable,str(EVAL),str(ROOT/"platform-p41-live-epoch-observation.json"),
         str(ROOT/"platform-p41-generation5-samples.json"),"--p25",str(activef),
         "--out",str(out),"--require-invalidated"])
    result=load(out)
    assert result["decision"]=="generation_invalidated_refreeze_pending"
    assert result["state"]=="invalidated_epoch_changed"
    assert result["nextGeneration"]==6
    assert result["certificationReady"] is False
    assert result["backupFreshForCandidate"] is False
    assert "migrationHead" in result["changedEpochFields"]
    assert "semanticSchemaSha256" in result["changedEpochFields"]
    assert "generation_5_invalidated_epoch_changed" in result["blockers"]
    assert "backup_predates_latest_shared_change" in result["blockers"]

    # Stable-epoch positive path: after 24h, 12 healthy samples spanning all six buckets
    # plus a terminal sample become certifiable.
    stable=json.loads(json.dumps(obs))
    stable["currentEpoch"]=json.loads(json.dumps(obs["frozenEpoch"]))
    stable["currentEpoch"].update({
      "edgeFunctionsAllActive":True,"cronFailures24h":0,"blockingReplicationSlots":0,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass"
    })
    start=datetime.fromisoformat("2026-10-04T18:52:01.712991+00:00")
    stable["observedAt"]=z(start+timedelta(hours=25))
    stablef=d/"stable.json"; write(stablef,stable)
    rows=[]
    for bucket in range(6):
        for offset in (0.5,2.5):
            rows.append({"timestamp":z(start+timedelta(hours=bucket*4+offset)),
                         "status":"success","healthy":True,"generation":5,
                         "qualifiesForBurnIn":True,"runId":1000+len(rows)})
    rows.append({"timestamp":z(start+timedelta(hours=24,minutes=5)),
                 "status":"success","healthy":True,"generation":5,
                 "qualifiesForBurnIn":True,"runId":2000})
    sf=d/"samples.json"; write(sf,{"samples":rows})
    cert=d/"cert.json"
    run([sys.executable,str(EVAL),str(stablef),str(sf),"--p25",str(activef),
         "--out",str(cert),"--require-certifiable"])
    ready=load(cert)
    assert ready["decision"]=="ready_for_certification"
    assert ready["certificationReady"] is True
    assert len(ready["coverageBuckets"])==6
    assert ready["terminalSamplePresent"] is True
    assert ready["successfulQualifyingSamples"]>=12

print("P41 epoch invalidation and certification-readiness contracts passed.")
