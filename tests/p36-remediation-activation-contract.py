#!/usr/bin/env python3
import json,re,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVAL=ROOT/"scripts/p36-evaluate-activation.py"
ACT=ROOT/"scripts/p36-activate-oe.py"

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

rem=json.loads((ROOT/"platform-p36-remediation-execution.json").read_text())
freeze=json.loads((ROOT/"platform-p36-stable-epoch-freeze.json").read_text())
oe=json.loads((ROOT/"platform-p36-operating-effectiveness-state.json").read_text())
p25=json.loads((ROOT/"platform-p25-burn-in-plan.json").read_text())

assert rem["state"]=="partial_remediation_executed"
closed={x["deficiencyId"]:x["result"] for x in rem["executedDispositions"]}
assert closed["P34-D002"]=="closed_by_documented_design"
assert closed["P34-D003"]=="closed_by_documented_design"
assert closed["P34-D005"]=="closed_owner_resolved"
assert rem["executedDispositions"][1]["retest"]["tables"]==58
assert rem["executedDispositions"][1]["retest"]["anonAnyDmlGrant"]==0
assert rem["executedDispositions"][1]["retest"]["authenticatedAnyDmlGrant"]==0
assert rem["executedDispositions"][0]["retest"]["functions"]==39
assert rem["executedDispositions"][0]["retest"]["anonExecutable"]==0
assert rem["executedDispositions"][0]["retest"]["referencesAuthUid"]==39
assert rem["executedDispositions"][0]["retest"]["controlledEmptySearchPath"]==39
assert len(rem["remainingDeficiencies"])==4

assert freeze["state"]=="active"
assert freeze["p25Generation"]==2
assert freeze["mainCommit"]=="f722d576b483991adaa865e188cc04bea583e6a6"
assert freeze["frozenEpoch"]["migrationName"]=="gomoku_p16_certification_null_fix"
assert freeze["frozenEpoch"]["gomokuRoomVersion"]==42
assert freeze["operationalEvidence"]["cronFailures24h"]==0

assert oe["state"]=="armed_waiting_p25_generation2"
assert oe["active"] is False
assert oe["activationIsRetroactive"] is False
assert p25["generation"]==2

sql=(ROOT/"scripts/p36-remediation-retest.sql").read_text()
sql_no_comments=re.sub(r'--[^\n]*','',sql)
statements=[x.strip().lower() for x in sql_no_comments.split(';') if x.strip()]
assert statements
assert all(x.startswith("select") or x.startswith("with") for x in statements),statements

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs_file=d/"obs.json"; samples_file=d/"samples.json"; act_file=d/"act.json"; decision=d/"decision.json"

    base_obs={
      "observedAt":"2026-10-02T14:46:08.606027Z",
      "projectStatus":"ACTIVE_HEALTHY",
      "migrationVersion":"20261002095255",
      "migrationName":"gomoku_p16_certification_null_fix",
      "semanticSchemaSha256":"af9cc4acbed9e61bc81f48642f75b1c2e2841ebdf52a5139f14e784e509aecad",
      "gomokuRoomVersion":42,
      "gomokuRoomSha256":"fc63d31db8a51b860fc45aa7148fc864f8b2622fc469e495123e9a950273687d",
      "cronJobs":11,"cronFailures24h":0,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass"
    }
    current_act={
      "p32Mode":"shadow","p33CanonicalEvidenceActive":False,"controlCatalogFrozen":False,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficienciesDispositionedOrRemediating":True
    }
    obs_file.write_text(json.dumps(base_obs))
    samples_file.write_text(json.dumps({"samples":[]}))
    act_file.write_text(json.dumps(current_act))

    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--out",str(decision)],1)
    cur=json.loads(decision.read_text())
    assert cur["decision"]=="blocked"
    assert "p25_minimum_time_not_reached" in cur["errors"]
    assert "p32_not_warn_or_enforce" in cur["errors"]
    assert "p33_evidence_not_active" in cur["errors"]

    ready_obs=dict(base_obs)
    ready_obs["observedAt"]="2026-10-03T15:00:00Z"
    ready_act={
      "p32Mode":"enforce","p33CanonicalEvidenceActive":True,"controlCatalogFrozen":True,
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "highDeficienciesDispositionedOrRemediating":True
    }
    start=datetime.fromisoformat("2026-10-02T14:40:00+00:00")
    rows=[]
    for i in range(12):
        t=start+timedelta(minutes=135*i)
        rows.append({"timestamp":t.isoformat().replace("+00:00","Z"),"status":"success","healthy":True})
    rows[-1]["timestamp"]="2026-10-03T14:50:00Z"
    samples_file.write_text(json.dumps({"samples":rows}))
    act_file.write_text(json.dumps(ready_act))

    stale=dict(ready_obs);stale["migrationName"]="new_shared_change"
    obs_file.write_text(json.dumps(stale))
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--out",str(decision)],1)
    assert any(x.startswith("frozen_epoch_changed:") for x in json.loads(decision.read_text())["errors"])

    obs_file.write_text(json.dumps(ready_obs))
    samples_file.write_text(json.dumps({"samples":rows[:11]}))
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--out",str(decision)],1)
    assert "insufficient_public_samples" in json.loads(decision.read_text())["errors"]

    clustered=[{"timestamp":(start+timedelta(minutes=30*i)).isoformat().replace("+00:00","Z"),"status":"success","healthy":True} for i in range(12)]
    samples_file.write_text(json.dumps({"samples":clustered}))
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--out",str(decision)],1)
    assert "samples_do_not_span_minimum_window" in json.loads(decision.read_text())["errors"]

    samples_file.write_text(json.dumps({"samples":rows}))
    run([sys.executable,str(EVAL),str(obs_file),str(samples_file),str(act_file),"--out",str(decision)])
    ready=json.loads(decision.read_text())
    assert ready["decision"]=="ready_to_activate"
    assert ready["successfulSamples"]==12
    assert ready["activationIsRetroactive"] is False

    activation=d/"activation.json"
    run([sys.executable,str(ACT),str(decision),"--out",str(activation)])
    activated=json.loads(activation.read_text())
    assert activated["state"]=="active"
    assert activated["periodStart"]=="2026-10-03T15:00:00Z"
    assert activated["periodStart"]!=freeze["frozenAt"]
    assert activated["activationIsRetroactive"] is False
    assert activated["externalAttestation"] is False

    blocked=dict(ready);blocked["decision"]="blocked";blocked["errors"]=["test"]
    blocked_file=d/"blocked.json";blocked_file.write_text(json.dumps(blocked))
    run([sys.executable,str(ACT),str(blocked_file),"--out",str(d/"must-not-exist.json")],1)

print("P36 remediation, freeze and non-retroactive OE activation contracts passed.")
