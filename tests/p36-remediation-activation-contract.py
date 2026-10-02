#!/usr/bin/env python3
import json,re,subprocess,sys,tempfile
from datetime import datetime,timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVAL=ROOT/"scripts/p36-evaluate-activation.py"
ACT=ROOT/"scripts/p36-activate-oe.py"

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def write(path,obj):
    Path(path).write_text(json.dumps(obj),encoding="utf-8")

rem=load(ROOT/"platform-p36-remediation-execution.json")
freeze=load(ROOT/"platform-p36-stable-epoch-freeze.json")
oe=load(ROOT/"platform-p36-operating-effectiveness-state.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")

assert rem["state"]=="partial_remediation_executed"
closed={x["deficiencyId"]:x["result"] for x in rem["executedDispositions"]}
assert closed["P34-D002"]=="closed_by_documented_design"
assert closed["P34-D003"]=="closed_by_documented_design"
assert closed["P34-D005"]=="closed_owner_resolved"
assert len(rem["remainingDeficiencies"])==4

assert freeze["state"]=="invalidated_by_shared_epoch_change"
assert freeze["p25Generation"]==2
assert freeze["frozenEpoch"]["migrationName"]=="gomoku_p16_certification_null_fix"
assert freeze["latestObservedEpoch"]["migrationName"]=="gomoku_p17_certification_health_isolation"
assert freeze["latestObservedEpoch"]["gomokuRoomVersion"]==45
assert freeze["nextFreezeGeneration"]==3

assert oe["state"]=="armed_waiting_new_stable_epoch"
assert oe["active"] is False
assert oe["activationIsRetroactive"] is False
assert oe["activationGates"]["p25ActiveGenerationCertified"] is False

assert p25["state"]=="refreeze_pending"
assert p25["generationState"]=="generation3_refreeze_pending"
assert p25["currentGenerationEligible"] is False
assert p25["nextGeneration"]==3

sql=(ROOT/"scripts/p36-remediation-retest.sql").read_text()
sql_no_comments=re.sub(r'--[^\n]*','',sql)
statements=[x.strip().lower() for x in sql_no_comments.split(';') if x.strip()]
assert statements
assert all(x.startswith("select") or x.startswith("with") for x in statements),statements

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs_file=d/"obs.json"; samples_file=d/"samples.json"; act_file=d/"act.json"
    decision=d/"decision.json"; p25_file=d/"p25.json"

    base_obs={
      "observedAt":"2026-10-02T17:30:00Z",
      "projectStatus":"ACTIVE_HEALTHY",
      "migrationVersion":"20261002152739",
      "migrationName":"gomoku_p17_certification_health_isolation",
      "semanticSchemaSha256":"d5c977fc0d74ea6745ac588fc90656dadc18ee0568c3ac248cfd7540ceb6de00",
      "gomokuRoomVersion":45,
      "gomokuRoomSha256":"70e86288e735659c4f0a3c9a2608acf48305ae73afe915fefb22add8f293a2de",
      "cronJobs":11,"cronFailures24h":0,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass"
    }
    current_act={
      "p32Mode":"shadow","p33CanonicalEvidenceActive":False,"controlCatalogFrozen":False,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficienciesDispositionedOrRemediating":True
    }
    write(obs_file,base_obs);write(samples_file,{"samples":[]});write(act_file,current_act);write(p25_file,p25)

    # The real current state is blocked because no eligible burn-in generation exists.
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--p25",str(p25_file),"--out",str(decision)],1)
    cur=load(decision)
    assert cur["decision"]=="blocked"
    assert "p25_no_eligible_active_generation" in cur["errors"]
    assert "p32_not_warn_or_enforce" in cur["errors"]
    assert "p33_evidence_not_active" in cur["errors"]

    # Model a future eligible generation 3 without changing repository state.
    active=json.loads(json.dumps(p25))
    active["state"]="burn_in_active"
    active["generation"]=3
    active["generationState"]="burn_in_active"
    active["currentGenerationEligible"]=True
    active["activatedAt"]="2026-10-02T18:30:00Z"
    active["minimumCompleteAfter"]="2026-10-03T18:30:00Z"
    active["currentEpochFreezeEvidence"]={
      "frozenAt":"2026-10-02T18:30:00Z",
      "migrationVersion":"20261002152739",
      "migrationName":"gomoku_p17_certification_health_isolation",
      "migrationHead":"20261002152739_gomoku_p17_certification_health_isolation",
      "semanticSchemaSha256":"d5c977fc0d74ea6745ac588fc90656dadc18ee0568c3ac248cfd7540ceb6de00",
      "gomokuRoomVersion":45,
      "gomokuRoomSha256":"70e86288e735659c4f0a3c9a2608acf48305ae73afe915fefb22add8f293a2de",
      "cronJobs":11
    }
    write(p25_file,active)

    ready_obs=dict(base_obs)
    ready_obs["observedAt"]="2026-10-03T19:00:00Z"
    ready_act={
      "p32Mode":"enforce","p33CanonicalEvidenceActive":True,"controlCatalogFrozen":True,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficienciesDispositionedOrRemediating":True
    }
    start=datetime.fromisoformat("2026-10-02T18:30:00+00:00")
    rows=[]
    for i in range(12):
        t=start+timedelta(minutes=135*i)
        rows.append({"timestamp":t.isoformat().replace("+00:00","Z"),"status":"success","healthy":True})
    rows[-1]["timestamp"]="2026-10-03T18:50:00Z"
    write(obs_file,ready_obs);write(samples_file,{"samples":rows});write(act_file,ready_act)

    stale=dict(ready_obs);stale["gomokuRoomVersion"]=46
    write(obs_file,stale)
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--p25",str(p25_file),"--out",str(decision)],1)
    assert any(x.startswith("frozen_epoch_changed:") for x in load(decision)["errors"])

    write(obs_file,ready_obs);write(samples_file,{"samples":rows[:11]})
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--p25",str(p25_file),"--out",str(decision)],1)
    assert "insufficient_public_samples" in load(decision)["errors"]

    write(samples_file,{"samples":rows})
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--p25",str(p25_file),"--out",str(decision)])
    ready=load(decision)
    assert ready["decision"]=="ready_to_activate"
    assert ready["p25Generation"]==3
    assert ready["successfulSamples"]==12
    assert ready["activationIsRetroactive"] is False

    activation=d/"activation.json"
    run([sys.executable,str(ACT),str(decision),"--out",str(activation)])
    activated=load(activation)
    assert activated["state"]=="active"
    assert activated["periodStart"]=="2026-10-03T19:00:00Z"
    assert activated["activationIsRetroactive"] is False
    assert activated["externalAttestation"] is False

print("P36 remediation, invalidated-freeze and generation-agnostic OE activation contracts passed.")
