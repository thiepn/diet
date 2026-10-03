#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ASSESS=ROOT/"scripts/p34-assess-controls.py"
PACK=ROOT/"scripts/p34-build-audit-package.py"

def run(cmd,expect=0,cwd=ROOT):
    p=subprocess.run(cmd,cwd=cwd,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    # Current staged control assessment is structurally valid, but not audit-ready.
    result=d/"result.json"
    run([sys.executable,str(ASSESS),"--out",str(result)])
    r=json.loads(result.read_text())
    assert r["status"]=="pass"
    assert r["controlCount"]==18
    assert r["calculatedReadinessLevel"]==2
    assert r["externalAuditReady"] is False
    assert r["openDeficiencies"]==7
    assert r["externalAttestationClaim"] is False

    catalog=json.loads((ROOT/"platform-p34-control-catalog.json").read_text())
    snapshot=json.loads((ROOT/"platform-p34-assurance-snapshot.json").read_text())
    defs=json.loads((ROOT/"platform-p34-deficiency-register.json").read_text())

    # Missing owner fails control catalog validation.
    badcat=json.loads(json.dumps(catalog));badcat["controls"][0]["owner"]=""
    cat=d/"cat.json";snap=d/"snap.json";deff=d/"defs.json"
    cat.write_text(json.dumps(badcat));snap.write_text(json.dumps(snapshot));deff.write_text(json.dumps(defs))
    run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

    # Design-only evidence cannot be mislabeled pass.
    badsnap=json.loads(json.dumps(snapshot))
    badsnap["controlAssessments"][0]["state"]="pass"
    badsnap["controlAssessments"][0]["operation"]="not_yet_effective_over_period"
    cat.write_text(json.dumps(catalog));snap.write_text(json.dumps(badsnap))
    run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

    # A closed deficiency requires retest evidence.
    baddefs=json.loads(json.dumps(defs));baddefs["items"][0]["state"]="closed"
    snap.write_text(json.dumps(snapshot));deff.write_text(json.dumps(baddefs))
    run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

    # Temporary acceptance requires expiry.
    baddefs=json.loads(json.dumps(defs));baddefs["items"][0]["state"]="accepted_temporarily"
    deff.write_text(json.dumps(baddefs))
    run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

    # Deterministic audit-readiness package.
    manifest=d/"manifest.json"
    base={
      "scope":"THIEPN shared platform internal control readiness",
      "periodStart":"2026-10-01T00:00:00Z",
      "periodEnd":"2026-10-02T06:10:53Z",
      "readinessStatement":"Internal readiness package; unresolved deficiencies remain and no external attestation is claimed.",
      "externalAttestation":False,
      "frameworkMappings":["NIST CSF 2.0","SOC 2 readiness domains"],
      "openDeficiencyIds":[x["id"] for x in defs["items"]],
      "requiredArtifacts":[
        {"name":"catalog","path":str(ROOT/"platform-p34-control-catalog.json")},
        {"name":"snapshot","path":str(ROOT/"platform-p34-assurance-snapshot.json")},
        {"name":"deficiencies","path":str(ROOT/"platform-p34-deficiency-register.json")},
        {"name":"p33-evidence-policy","path":str(ROOT/"platform-p33-evidence-policy.json")}
      ]
    }
    manifest.write_text(json.dumps(base))
    p1=d/"pack1.json";p2=d/"pack2.json"
    run([sys.executable,str(PACK),str(manifest),"--out",str(p1)])
    run([sys.executable,str(PACK),str(manifest),"--out",str(p2)])
    j1=json.loads(p1.read_text());j2=json.loads(p2.read_text())
    assert j1["status"]=="pass"
    assert j1["rootHash"]==j2["rootHash"]
    assert j1["externalAttestation"] is False

    # Unsupported compliance claim is rejected.
    bad=json.loads(json.dumps(base))
    bad["readinessStatement"]="THIEPN is SOC 2 compliant and certified."
    manifest.write_text(json.dumps(bad))
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"badclaim.json")],1)

    # Missing evidence is rejected.
    bad=json.loads(json.dumps(base))
    bad["requiredArtifacts"].append({"name":"missing","path":str(d/"missing.json")})
    manifest.write_text(json.dumps(bad))
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"missingpack.json")],1)

print("P34 control assurance, deficiency and audit-readiness package contracts passed.")
