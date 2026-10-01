#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"platform-p33-audit-ledger.jsonl"
LEDGER_CLI=ROOT/"scripts/p33-ledger.py"
PACK=ROOT/"scripts/p33-build-provenance.py"

def run(cmd,expect=0,cwd=ROOT):
    p=subprocess.run(cmd,cwd=cwd,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    # Canonical ledger verifies.
    out=d/"verify.json"
    run([sys.executable,str(LEDGER_CLI),"verify",str(LEDGER),"--out",str(out)])
    result=json.loads(out.read_text())
    assert result["status"]=="pass"
    assert result["entries"]==2
    assert len(result["headHash"])==64

    original=LEDGER.read_text(encoding="utf-8").splitlines()

    # Tampering with historical evidence is detected.
    tampered=[json.loads(x) for x in original]
    tampered[0]["evidence"]["cronJobs"]=999
    bad=d/"tampered.jsonl"
    bad.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in tampered)+"\n",encoding="utf-8")
    run([sys.executable,str(LEDGER_CLI),"verify",str(bad)],1)

    # Deletion/reordering are detected.
    deleted=d/"deleted.jsonl"
    deleted.write_text(original[1]+"\n",encoding="utf-8")
    run([sys.executable,str(LEDGER_CLI),"verify",str(deleted)],1)

    reordered=d/"reordered.jsonl"
    reordered.write_text(original[1]+"\n"+original[0]+"\n",encoding="utf-8")
    run([sys.executable,str(LEDGER_CLI),"verify",str(reordered)],1)

    # Corrections append; old bytes remain present and chain stays valid.
    event=d/"correction.json"
    event.write_text(json.dumps({
      "eventId":"correction-1",
      "timestamp":"2026-10-01T20:20:00Z",
      "eventType":"correction",
      "subject":"test",
      "actor":{"type":"human","id":"reviewer"},
      "evidence":{"supersedesEventId":"p33-audit-capability-snapshot","note":"append-only correction"}
    }),encoding="utf-8")
    appended=d/"appended.jsonl"
    run([sys.executable,str(LEDGER_CLI),"append",str(LEDGER),str(event),"--out",str(appended)])
    run([sys.executable,str(LEDGER_CLI),"verify",str(appended)])
    lines=appended.read_text(encoding="utf-8").splitlines()
    assert lines[0]==original[0] and lines[1]==original[1]
    assert len(lines)==3

    # Deterministic provenance packs.
    a=d/"a.json";b=d/"b.txt"
    a.write_text('{"ok":true}\n',encoding="utf-8")
    b.write_text("evidence\n",encoding="utf-8")
    manifest=d/"manifest.json"
    base={
      "changeId":"change-1","subject":"test release","repository":"thiepn/diet",
      "commitSha":"abcdef1234567890","pullRequest":23,
      "workflow":{"runId":"36906914655","name":"CI"},
      "liveAttestation":{"migrationHead":"20261001183709"},
      "approvals":[],
      "privacy":{"containsRawSecrets":False,"containsRawPersonalAuditData":False},
      "requiredArtifacts":[
        {"name":"b","path":str(b),"kind":"text"},
        {"name":"a","path":str(a),"kind":"json"}
      ]
    }
    manifest.write_text(json.dumps(base),encoding="utf-8")
    p1=d/"pack1.json";p2=d/"pack2.json"
    run([sys.executable,str(PACK),str(manifest),"--out",str(p1)])
    run([sys.executable,str(PACK),str(manifest),"--out",str(p2)])
    j1=json.loads(p1.read_text());j2=json.loads(p2.read_text())
    assert j1["status"]=="pass"
    assert j1["rootHash"]==j2["rootHash"]
    assert [x["name"] for x in j1["artifacts"]]==["a","b"]

    # Missing required evidence fails.
    missing=json.loads(json.dumps(base))
    missing["requiredArtifacts"].append({"name":"missing","path":str(d/"none")})
    manifest.write_text(json.dumps(missing),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"missing-pack.json")],1)

    # Raw secret/personal audit evidence is explicitly rejected.
    unsafe=json.loads(json.dumps(base))
    unsafe["privacy"]["containsRawSecrets"]=True
    manifest.write_text(json.dumps(unsafe),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"unsafe-pack.json")],1)

    unsafe=json.loads(json.dumps(base))
    unsafe["privacy"]["containsRawPersonalAuditData"]=True
    manifest.write_text(json.dumps(unsafe),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"unsafe-personal.json")],1)

    # Exact Git/workflow identity is mandatory.
    noid=json.loads(json.dumps(base));noid["commitSha"]=""
    manifest.write_text(json.dumps(noid),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"noid.json")],1)

print("P33 ledger tamper-evidence, provenance and privacy contracts passed.")
