#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ASSESS=ROOT/"scripts/p34-assess-controls.py"
PACK=ROOT/"scripts/p34-build-audit-package.py"
CAT=ROOT/"platform-p34-control-catalog.json"
SNAP=ROOT/"platform-p34-assurance-snapshot.json"
DEFS=ROOT/"platform-p34-deficiency-register.json"
LEDGER=ROOT/"platform-p33-audit-ledger.jsonl"
ANCHOR=ROOT/"platform-p33-ledger-anchor.json"

def run(cmd,expect=0):
 p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
 assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
 return p

with tempfile.TemporaryDirectory() as td:
 d=Path(td)
 result=d/"assessment.json"

 # Canonical point-in-time assessment is structurally valid but not audit-ready.
 run([sys.executable,str(ASSESS),"--out",str(result)])
 a=json.loads(result.read_text())
 assert a["status"]=="pass"
 assert a["auditReady"] is False
 assert a["readinessLevel"]==2
 assert a["controlCount"]==18
 assert a["freshControls"]==18
 assert a["openDeficiencyCount"]==8
 assert a["openSeverityCounts"]["high"]==4
 assert a["openSeverityCounts"]["medium"]==4
 assert len(a["openHighOrCritical"])==4
 assert len(a["assessmentDigest"])==64

 catalog=json.loads(CAT.read_text())
 snapshot=json.loads(SNAP.read_text())
 defs=json.loads(DEFS.read_text())

 # Evidence staleness is surfaced and prevents readiness.
 cat=d/"catalog.json"; snap=d/"snapshot.json"; deff=d/"defs.json"
 cat.write_text(json.dumps(catalog)); deff.write_text(json.dumps(defs))
 stale=json.loads(json.dumps(snapshot))
 stale["controlAssessments"][0]["evidenceAgeHours"]=9999
 stale["controlAssessments"][0]["freshness"]="stale"
 snap.write_text(json.dumps(stale))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)])
 x=json.loads(result.read_text())
 assert x["auditReady"] is False
 assert "TH-GV-01" in x["staleControls"]

 # A false external-attestation claim is invalid.
 bad=json.loads(json.dumps(snapshot)); bad["externalAttestationClaim"]=True
 snap.write_text(json.dumps(bad))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Design/point-in-time evidence cannot magically claim operating effectiveness.
 bad=json.loads(json.dumps(snapshot))
 bad["currentReadinessLevel"]=2
 bad["controlAssessments"][0]["operatingEffectiveness"]="effective"
 snap.write_text(json.dumps(bad))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Snapshot cannot claim audit-ready while open high deficiencies remain.
 bad=json.loads(json.dumps(snapshot)); bad["overallState"]="audit_ready"; bad["currentReadinessLevel"]=4
 snap.write_text(json.dumps(bad))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Closed deficiency requires retest and evidence hashes.
 snap.write_text(json.dumps(snapshot))
 baddefs=json.loads(json.dumps(defs)); baddefs["items"][0]["state"]="closed"
 deff.write_text(json.dumps(baddefs))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Temporary risk acceptance needs independent decision data + bounded expiry.
 baddefs=json.loads(json.dumps(defs)); baddefs["items"][0]["state"]="accepted_temporarily"
 deff.write_text(json.dumps(baddefs))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 baddefs=json.loads(json.dumps(defs)); item=baddefs["items"][0]
 item["state"]="accepted_temporarily"; item["acceptedBy"]="risk-owner"; item["decisionRef"]="risk-1"
 item["expiresAt"]="2027-02-01T00:00:00Z"
 deff.write_text(json.dumps(baddefs))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Automatic remediation is forbidden.
 baddefs=json.loads(json.dumps(defs)); baddefs["items"][0]["automaticRemediation"]=True
 deff.write_text(json.dumps(baddefs))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Unknown control refs and hand-entered count drift fail.
 baddefs=json.loads(json.dumps(defs)); baddefs["items"][0]["controlIds"].append("TH-ZZ-99")
 deff.write_text(json.dumps(baddefs))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 deff.write_text(json.dumps(defs))
 bad=json.loads(json.dumps(snapshot)); bad["deficiencies"]["high"]=3
 snap.write_text(json.dumps(bad))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)],1)

 # Restore canonical assessment for packaging.
 snap.write_text(json.dumps(snapshot)); deff.write_text(json.dumps(defs))
 run([sys.executable,str(ASSESS),"--catalog",str(cat),"--snapshot",str(snap),"--deficiencies",str(deff),"--out",str(result)])

 open_ids=[x["id"] for x in defs["items"] if x["state"]!="closed"]
 manifest=d/"manifest.json"
 base={
  "scope":"THIEPN shared platform internal security-control readiness",
  "periodStart":"2026-10-03T21:52:18Z",
  "periodEnd":"2026-10-03T22:06:34Z",
  "readinessStatement":"Internal readiness package with point-in-time evidence and open deficiencies; no external attestation is claimed.",
  "readinessLevel":2,
  "externalAttestation":False,
  "frameworkMappings":["NIST CSF 2.0 function-level internal crosswalk","AICPA Trust Services Criteria high-level domain crosswalk"],
  "openDeficiencyIds":open_ids,
  "assessmentResultPath":str(result),
  "deficiencyRegisterPath":str(DEFS),
  "p33LedgerPath":str(LEDGER),
  "p33AnchorPath":str(ANCHOR),
  "requiredArtifacts":[
   {"name":"control-catalog","path":str(CAT),"kind":"control-catalog"},
   {"name":"assurance-snapshot","path":str(SNAP),"kind":"assurance-snapshot"},
   {"name":"deficiency-register","path":str(DEFS),"kind":"deficiency-register"},
   {"name":"audit-readiness-plan","path":str(ROOT/"platform-p34-audit-readiness-plan.json"),"kind":"plan"},
   {"name":"p33-evidence-policy","path":str(ROOT/"platform-p33-evidence-policy.json"),"kind":"provenance-policy"},
   {"name":"p33-ledger-anchor","path":str(ANCHOR),"kind":"ledger-anchor"}
  ]
 }
 manifest.write_text(json.dumps(base))
 p1=d/"pack1.json"; p2=d/"pack2.json"
 run([sys.executable,str(PACK),str(manifest),"--out",str(p1)])
 run([sys.executable,str(PACK),str(manifest),"--out",str(p2)])
 j1=json.loads(p1.read_text()); j2=json.loads(p2.read_text())
 assert j1["status"]=="pass"
 assert j1["externalAttestation"] is False
 assert j1["readinessLevel"]==2
 assert j1["assessment"]["auditReady"] is False
 assert j1["rootHash"]==j2["rootHash"]
 assert len(j1["rootHash"])==64
 assert j1["openDeficiencyIds"]==sorted(open_ids)

 # Unsupported certification/compliance claims are rejected.
 for statement in ("THIEPN is SOC 2 certified.","THIEPN is SOC 2 compliant.","THIEPN is ISO 27001 certified."):
  bad=json.loads(json.dumps(base)); bad["readinessStatement"]=statement
  manifest.write_text(json.dumps(bad))
  run([sys.executable,str(PACK),str(manifest),"--out",str(d/"badclaim.json")],1)

 # External attestation flag cannot be asserted.
 bad=json.loads(json.dumps(base)); bad["externalAttestation"]=True
 manifest.write_text(json.dumps(bad))
 run([sys.executable,str(PACK),str(manifest),"--out",str(d/"attestation.json")],1)

 # Open-deficiency set must exactly match the register.
 bad=json.loads(json.dumps(base)); bad["openDeficiencyIds"]=bad["openDeficiencyIds"][:-1]
 manifest.write_text(json.dumps(bad))
 run([sys.executable,str(PACK),str(manifest),"--out",str(d/"defs-mismatch.json")],1)

 # Missing and duplicate evidence fail.
 bad=json.loads(json.dumps(base)); bad["requiredArtifacts"].append({"name":"missing","path":str(d/"none")})
 manifest.write_text(json.dumps(bad))
 run([sys.executable,str(PACK),str(manifest),"--out",str(d/"missing.json")],1)

 bad=json.loads(json.dumps(base)); bad["requiredArtifacts"].append(dict(bad["requiredArtifacts"][0]))
 manifest.write_text(json.dumps(bad))
 run([sys.executable,str(PACK),str(manifest),"--out",str(d/"duplicate.json")],1)

 # Invalid period fails.
 bad=json.loads(json.dumps(base)); bad["periodStart"]=bad["periodEnd"]
 manifest.write_text(json.dumps(bad))
 run([sys.executable,str(PACK),str(manifest),"--out",str(d/"period.json")],1)

 # P33 ledger/anchor mismatch fails.
 truncated=d/"truncated-ledger.jsonl"
 lines=LEDGER.read_text().splitlines()
 truncated.write_text("\n".join(lines[:-1])+"\n")
 bad=json.loads(json.dumps(base)); bad["p33LedgerPath"]=str(truncated)
 manifest.write_text(json.dumps(bad))
 run([sys.executable,str(PACK),str(manifest),"--out",str(d/"badledger.json")],1)

print("P34 continuous-assurance, deficiency and audit-readiness package contracts passed.")
