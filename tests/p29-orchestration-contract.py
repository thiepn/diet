#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GRAPH=ROOT/"platform-p29-dependency-graph.json"

def run_impact(payload):
    with tempfile.TemporaryDirectory() as d:
        inp=Path(d)/"change.json"; out=Path(d)/"impact.json"
        inp.write_text(json.dumps(payload),encoding="utf-8")
        p=subprocess.run(
          [sys.executable,str(ROOT/"scripts/p29-impact-analysis.py"),str(inp),"--graph",str(GRAPH),"--out",str(out)],
          capture_output=True,text=True
        )
        assert p.returncode==0,(p.stdout,p.stderr)
        return json.loads(out.read_text(encoding="utf-8"))

leaderboard=run_impact({
  "changeId":"leaderboard-vNext",
  "graphVersion":"2026-10-01.1",
  "changes":[{"component":"leaderboard","class":"provider_breaking","changesEdgeContract":True}]
})
assert leaderboard["breaking"] is True
assert set(["leaderboard","wordstrike","gomoku","platform_control"]).issubset(set(leaderboard["affectedComponents"]))
assert leaderboard["releaseEpochInvalidated"] is True
assert "all_affected_consumers" in leaderboard["requiredScopes"]

incident=run_impact({
  "changeId":"gomoku-p9",
  "changes":[{"component":"gomoku","class":"operational_job","changesSharedSchema":True,"changesCronInventory":True}]
})
assert set(incident["affectedComponents"])=={"gomoku","platform_control"}
assert incident["releaseEpochInvalidated"] is True
assert "platform_control" in incident["requiredScopes"]

with tempfile.TemporaryDirectory() as d:
    impact=Path(d)/"impact.json"; evidence=Path(d)/"evidence.json"; cert=Path(d)/"cert.json"
    impact.write_text(json.dumps(leaderboard),encoding="utf-8")
    affected=leaderboard["affectedComponents"]
    common={
      "graphVersion":"2026-10-01.1",
      "baselineSemanticSchemaSha256":"a"*64,
      "migrationHead":"20261001142949",
      "edgeInventorySha256":"b"*64,
      "scopeResults":{s:"pass" for s in leaderboard["requiredScopes"]},
      "baseline":{
        "semanticSchemaSha256":"a"*64,
        "migrationHead":"20261001142949",
        "edgeInventorySha256":"b"*64,
        "cronInventorySha256":"c"*64
      },
      "observed":{
        "semanticSchemaSha256":"a"*64,
        "migrationHead":"20261001142949",
        "edgeInventorySha256":"b"*64,
        "cronInventorySha256":"c"*64
      }
    }

    bad=dict(common)
    bad["componentResults"]=[{"component":c,"status":"pass"} for c in affected[:-1]]
    evidence.write_text(json.dumps(bad),encoding="utf-8")
    p=subprocess.run([sys.executable,str(ROOT/"scripts/p29-certify-release.py"),str(impact),str(evidence),"--out",str(cert)],capture_output=True,text=True)
    assert p.returncode!=0
    failed=json.loads(cert.read_text(encoding="utf-8"))
    assert failed["status"]=="fail"
    assert any(x.startswith("missing_components:") for x in failed["errors"])

    good=dict(common)
    good["componentResults"]=[{"component":c,"status":"pass"} for c in affected]
    evidence.write_text(json.dumps(good),encoding="utf-8")
    p=subprocess.run([sys.executable,str(ROOT/"scripts/p29-certify-release.py"),str(impact),str(evidence),"--out",str(cert)],capture_output=True,text=True)
    assert p.returncode==0,(p.stdout,p.stderr)
    passed=json.loads(cert.read_text(encoding="utf-8"))
    assert passed["status"]=="pass"
    assert passed["baselineStale"] is False

    stale=json.loads(json.dumps(good))
    stale["observed"]["cronInventorySha256"]="d"*64
    evidence.write_text(json.dumps(stale),encoding="utf-8")
    p=subprocess.run([sys.executable,str(ROOT/"scripts/p29-certify-release.py"),str(impact),str(evidence),"--out",str(cert)],capture_output=True,text=True)
    assert p.returncode!=0
    stale_cert=json.loads(cert.read_text(encoding="utf-8"))
    assert stale_cert["baselineStale"] is True
    assert "cronInventorySha256" in stale_cert["staleFields"]

print("P29 impact-analysis and compatibility-certificate contracts passed.")
