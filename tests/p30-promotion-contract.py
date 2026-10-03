#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def run(cmd,expect=0):
    p=subprocess.run(cmd,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

base_manifest={
  "trainId":"train-app-fast-001",
  "trainType":"app_fast",
  "gitSha":"1234567890abcdef",
  "dependencyGraphVersion":"2026-10-01.1",
  "changeManifestSha256":"a"*64,
  "impactAnalysisSha256":"b"*64,
  "semanticSchemaSha256":"c"*64,
  "migrationHead":"20261001151625",
  "edgeInventorySha256":"d"*64,
  "cronInventorySha256":"e"*64,
  "environmentTopologyVersion":"2026-10-01.1"
}

with tempfile.TemporaryDirectory() as d:
    d=Path(d)
    manifest=d/"manifest.json"; candidate=d/"candidate.json"; evidence=d/"evidence.json"; out=d/"decision.json"
    manifest.write_text(json.dumps(base_manifest),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-build-candidate.py"),str(manifest),"--out",str(candidate)])
    c1=json.loads(candidate.read_text())
    assert len(c1["candidateId"])==64

    changed=dict(base_manifest);changed["migrationHead"]="20261001160000"
    manifest.write_text(json.dumps(changed),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-build-candidate.py"),str(manifest),"--out",str(d/"candidate2.json")])
    c2=json.loads((d/"candidate2.json").read_text())
    assert c1["candidateId"]!=c2["candidateId"]

    observed={
      "semanticSchemaSha256":"c"*64,
      "migrationHead":"20261001151625",
      "edgeInventorySha256":"d"*64,
      "cronInventorySha256":"e"*64,
      "environmentTopologyVersion":"2026-10-01.1"
    }
    good={
      "candidateId":c1["candidateId"],
      "p29CertificateStatus":"pass",
      "observed":observed,
      "integrationEnvironment":{"kind":"logical","status":"healthy"},
      "gates":{}
    }
    evidence.write_text(json.dumps(good),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","candidate","--to-stage","integration","--out",str(out)])
    assert json.loads(out.read_text())["status"]=="pass"

    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","candidate","--to-stage","production","--out",str(out)],1)
    assert "stage_skip_or_reverse_not_allowed" in json.loads(out.read_text())["errors"]

    shared=dict(base_manifest);shared["trainId"]="train-shared-001";shared["trainType"]="shared_standard"
    manifest.write_text(json.dumps(shared),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-build-candidate.py"),str(manifest),"--out",str(candidate)])
    sc=json.loads(candidate.read_text())
    bad={
      "candidateId":sc["candidateId"],"p29CertificateStatus":"pass","observed":observed,
      "integrationEnvironment":{"kind":"logical","status":"healthy"},"gates":{}
    }
    evidence.write_text(json.dumps(bad),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","candidate","--to-stage","integration","--out",str(out)],1)
    assert "stateful_release_requires_isolated_supabase_environment" in json.loads(out.read_text())["errors"]

    bad["integrationEnvironment"]={"kind":"supabase_branch","status":"healthy","branchActionStatus":"MIGRATIONS_FAILED"}
    evidence.write_text(json.dumps(bad),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","candidate","--to-stage","integration","--out",str(out)],1)
    assert "branch_action_state_failed" in json.loads(out.read_text())["errors"]

    ok=dict(bad);ok["integrationEnvironment"]={"kind":"supabase_branch","status":"healthy","branchActionStatus":"READY"}
    evidence.write_text(json.dumps(ok),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","candidate","--to-stage","integration","--out",str(out)])

    stale=json.loads(json.dumps(ok));stale["observed"]["migrationHead"]="20261001170000"
    evidence.write_text(json.dumps(stale),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","candidate","--to-stage","integration","--out",str(out)],1)
    assert any(x.startswith("stale_candidate:") for x in json.loads(out.read_text())["errors"])

    prod={
      "candidateId":sc["candidateId"],"p29CertificateStatus":"pass","observed":observed,
      "integrationEnvironment":{"kind":"supabase_branch","status":"healthy","branchActionStatus":"READY"},
      "frozenCandidate":True,"gates":{}
    }
    evidence.write_text(json.dumps(prod),encoding="utf-8")
    run([sys.executable,str(ROOT/"scripts/p30-validate-promotion.py"),str(candidate),str(evidence),
         "--from-stage","production_ready","--to-stage","production","--out",str(out)],1)
    assert "manual_production_approval_required" in json.loads(out.read_text())["errors"]

print("P30 candidate immutability and promotion-gate contracts passed.")
