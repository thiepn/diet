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
assert rem["executedDispositions"][1]["retest"]["tables"]==64
assert len(rem["remainingDeficiencies"])==4
assert rem["p25Generation3"]["active"] is True

assert freeze["state"]=="invalidated_by_shared_epoch_change"
assert freeze["p25Generation"]==2
assert freeze["frozenEpoch"]["migrationName"]=="gomoku_p16_certification_null_fix"
assert freeze["currentP25Generation"]["generation"]==3
assert freeze["currentP25Generation"]["state"]=="burn_in_active"
assert freeze["currentP25Generation"]["frozenEpoch"]["migrationVersion"]=="20261002172133"
assert freeze["currentP25Generation"]["frozenEpoch"]["gomokuRoomVersion"]==45

assert oe["state"]=="armed_waiting_p25_generation3_certification"
assert oe["active"] is False
assert oe["activationIsRetroactive"] is False
assert oe["activationGates"]["p25ActiveGenerationCertified"] is False

assert p25["state"]=="burn_in_active"
assert p25["generation"]==3
assert p25["generationState"]=="burn_in_active"
assert p25["currentGenerationEligible"] is True

sql=(ROOT/"scripts/p36-remediation-retest.sql").read_text()
sql_no_comments=re.sub(r'--[^\n]*','',sql)
statements=[x.strip().lower() for x in sql_no_comments.split(';') if x.strip()]
assert statements
assert all(x.startswith("select") or x.startswith("with") for x in statements),statements

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs_file=d/"obs.json";samples_file=d/"samples.json";act_file=d/"act.json";decision=d/"decision.json";p25_file=d/"p25.json"

    frozen=p25["currentEpochFreezeEvidence"]
    base_obs={
      "observedAt":"2026-10-02T20:30:00Z",
      "projectStatus":"ACTIVE_HEALTHY",
      "migrationVersion":frozen["migrationVersion"],
      "migrationName":frozen["migrationName"],
      "semanticSchemaSha256":frozen["semanticSchemaSha256"],
      "gomokuRoomVersion":frozen["gomokuRoomVersion"],
      "gomokuRoomSha256":frozen["gomokuRoomSha256"],
      "cronJobs":frozen["cronJobs"],"cronFailures24h":0,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass"
    }
    current_act={
      "p32Mode":"shadow","p33CanonicalEvidenceActive":False,"controlCatalogFrozen":False,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficienciesDispositionedOrRemediating":True
    }
    write(obs_file,base_obs);write(samples_file,{"samples":[]});write(act_file,current_act);write(p25_file,p25)

    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--p25",str(p25_file),"--out",str(decision)],1)
    cur=load(decision)
    assert cur["decision"]=="blocked"
    assert "p25_minimum_time_not_reached" in cur["errors"]
    assert "insufficient_public_samples" in cur["errors"]
    assert "p32_not_warn_or_enforce" in cur["errors"]
    assert "p33_evidence_not_active" in cur["errors"]
    assert "p25_no_eligible_active_generation" not in cur["errors"]

    ready_obs=dict(base_obs)
    ready_obs["observedAt"]="2026-10-03T20:30:00Z"
    ready_act={
      "p32Mode":"enforce","p33CanonicalEvidenceActive":True,"controlCatalogFrozen":True,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficienciesDispositionedOrRemediating":True
    }
    start=datetime.fromisoformat(p25["activatedAt"].replace("Z","+00:00"))
    rows=[]
    for i in range(12):
        t=start+timedelta(minutes=135*i)
        rows.append({"timestamp":t.isoformat().replace("+00:00","Z"),"status":"success","healthy":True})
    rows[-1]["timestamp"]="2026-10-03T20:20:00Z"
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
    assert activated["periodStart"]=="2026-10-03T20:30:00Z"
    assert activated["activationIsRetroactive"] is False
    assert activated["externalAttestation"] is False

print("P36 remediation and generation-3 OE activation contracts passed.")
