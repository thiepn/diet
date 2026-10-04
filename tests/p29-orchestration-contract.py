#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GRAPH=ROOT/"platform-p29-dependency-graph.json"
IMPACT=ROOT/"scripts/p29-impact-analysis.py"
CERT=ROOT/"scripts/p29-certify-release.py"

def impact(payload):
    with tempfile.TemporaryDirectory() as d:
        inp=Path(d)/"change.json"; out=Path(d)/"impact.json"
        inp.write_text(json.dumps(payload),encoding="utf-8")
        p=subprocess.run([sys.executable,str(IMPACT),str(inp),"--graph",str(GRAPH),"--out",str(out)],capture_output=True,text=True)
        assert p.returncode==0,(p.stdout,p.stderr)
        return json.loads(out.read_text(encoding="utf-8"))

def certify(imp,ev):
    with tempfile.TemporaryDirectory() as d:
        ip=Path(d)/"impact.json"; ep=Path(d)/"evidence.json"; op=Path(d)/"cert.json"
        ip.write_text(json.dumps(imp),encoding="utf-8"); ep.write_text(json.dumps(ev),encoding="utf-8")
        p=subprocess.run([sys.executable,str(CERT),str(ip),str(ep),"--out",str(op)],capture_output=True,text=True)
        return p.returncode,json.loads(op.read_text(encoding="utf-8"))

leaderboard=impact({
 "changeId":"leaderboard-vNext","graphVersion":"2026-10-04.1",
 "changes":[{"component":"leaderboard","class":"provider_breaking","changesEdgeContract":True}]
})
assert leaderboard["breaking"] is True
assert leaderboard["requiresQuietWindow"] is True
assert leaderboard["requiredQuietWindowMinutes"]==60
assert {"leaderboard","wordstrike","gomoku","platform_control"}.issubset(set(leaderboard["affectedComponents"]))
assert leaderboard["releaseWaves"]["W1"]==["leaderboard"]
assert leaderboard["releaseWaves"]["W5"]
assert len(leaderboard["graphSha256"])==64
assert len(leaderboard["changeManifestSha256"])==64

additive=impact({
 "changeId":"leaderboard-additive","graphVersion":"2026-10-04.1",
 "changes":[{"component":"leaderboard","class":"provider_additive"}]
})
assert set(additive["affectedComponents"])=={"leaderboard","wordstrike","gomoku"}
assert additive["breaking"] is False
assert additive["requiresQuietWindow"] is False

diet=impact({
 "changeId":"diet-ui","graphVersion":"2026-10-04.1",
 "changes":[{"component":"diet","class":"consumer_only"}]
})
assert diet["affectedComponents"]==["diet"]
assert diet["requiredQuietWindowMinutes"]==0

common_epoch={
 "semanticSchemaSha256":"5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375",
 "migrationHead":"20261004173117",
 "edgeInventorySha256":"2e66d1eec1dac615b0f0cc81a823100dd609947d7ecb51098fe2e37c504d6a0e",
 "cronInventorySha256":"652724f6d80db7f2382637925f3eba6205d114b02204ed68fdf115e5bfc20692"
}
good={
 "graphVersion":leaderboard["graphVersion"],
 "graphSha256":leaderboard["graphSha256"],
 "changeManifestSha256":leaderboard["changeManifestSha256"],
 "componentResults":[{"component":c,"status":"pass"} for c in leaderboard["affectedComponents"]],
 "scopeResults":{s:"pass" for s in leaderboard["requiredScopes"]},
 "baseline":dict(common_epoch),"observed":dict(common_epoch),
 "quietWindowObservedMinutes":60,
 "deprecatedContractRemovalRequested":False,
 "deprecatedContractCleanupAuthorized":False
}
code,cert=certify(leaderboard,good)
assert code==0
assert cert["status"]=="pass"
assert len(cert["certificateId"])==64
assert cert["productionPromotionAllowed"] is False

missing=json.loads(json.dumps(good)); missing["componentResults"]=missing["componentResults"][:-1]
code,cert=certify(leaderboard,missing)
assert code!=0 and any(e.startswith("missing_components:") for e in cert["errors"])

stale=json.loads(json.dumps(good)); stale["observed"]["migrationHead"]="20261003099999"
code,cert=certify(leaderboard,stale)
assert code!=0 and cert["baselineStale"] is True and "migrationHead" in cert["staleFields"]

quiet=json.loads(json.dumps(good)); quiet["quietWindowObservedMinutes"]=59
code,cert=certify(leaderboard,quiet)
assert code!=0 and any(e.startswith("quiet_window_insufficient:") for e in cert["errors"])

tampered=json.loads(json.dumps(good)); tampered["changeManifestSha256"]="0"*64
code,cert=certify(leaderboard,tampered)
assert code!=0 and "changeManifestSha256_mismatch" in cert["errors"]

cleanup=json.loads(json.dumps(good))
cleanup["deprecatedContractRemovalRequested"]=True
cleanup["deprecatedContractCleanupAuthorized"]=False
code,cert=certify(leaderboard,cleanup)
assert code!=0 and "breaking_cleanup_not_authorized" in cert["errors"]

cleanup["deprecatedContractCleanupAuthorized"]=True
code,cert=certify(leaderboard,cleanup)
assert code==0

bad=subprocess.run([
 sys.executable,str(IMPACT),"/dev/null","--graph",str(GRAPH)
],capture_output=True,text=True)
# malformed input must never produce a certificate/impact silently
assert bad.returncode!=0

print("P29 impact/orchestration/certification contracts passed.")
