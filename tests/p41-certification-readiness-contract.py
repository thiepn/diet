#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/p41-certification-readiness.py"

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def run(args,expect=0):
    p=subprocess.run(args,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

plan=load(ROOT/"platform-p41-generation5-epoch-watch.json")
obs=load(ROOT/"platform-p41-live-epoch-observation.json")
p25=load(ROOT/"platform-p25-burn-in-plan.json")

assert plan["phase"]=="P41"
assert plan["state"]=="generation5_invalidated_epoch_changed"
assert plan["certificationReadiness"]["generation5Certifiable"] is False
assert plan["nextGeneration"]["generation"]==6
assert obs["migrationHead"]=="20261005133228_hub_h18_notes_capture"
assert p25["currentEpochFreezeEvidence"]["migrationHead"]=="20261004173117_gomoku_p23_security_admission_gate"

with tempfile.TemporaryDirectory() as td:
    out=Path(td)/"readiness.json"
    run([sys.executable,str(SCRIPT),str(ROOT/"platform-p41-live-epoch-observation.json"),"--out",str(out),"--require-certifiable"],1)
    r=load(out)
    assert r["decision"]=="blocked_epoch_changed"
    assert r["certifiable"] is False
    assert r["frozenEpochMatch"] is False
    assert r["requiresNewGeneration"] is True
    assert r["nextGeneration"]==6
    fields={m["field"] for m in r["epochMismatches"]}
    assert "migrationHead" in fields
    assert "semanticSchemaSha256" in fields

    exact=dict(obs)
    freeze=p25["currentEpochFreezeEvidence"]
    for k in ("migrationHead","semanticSchemaSha256","edgeFunctionCount","gomokuRoomVersion","gomokuRoomSha256","cronJobs"):
        exact[k]=freeze[k]
    exact["observedAt"]="2026-10-05T19:00:00Z"
    exactf=Path(td)/"exact.json"; exactf.write_text(json.dumps(exact),encoding="utf-8")
    samplef=Path(td)/"samples.json"
    samplef.write_text(json.dumps({"samples":[]}),encoding="utf-8")
    out2=Path(td)/"exact-readiness.json"
    run([sys.executable,str(SCRIPT),str(exactf),"--samples",str(samplef),"--out",str(out2),"--require-certifiable"],1)
    rr=load(out2)
    assert rr["frozenEpochMatch"] is True
    assert rr["requiresNewGeneration"] is False
    assert "insufficient_successful_samples" in rr["blockers"]
    assert "coverage_incomplete" in rr["blockers"]
    assert "terminal_sample_missing" in rr["blockers"]

print("P41 certification-readiness and epoch-watch contracts passed.")
