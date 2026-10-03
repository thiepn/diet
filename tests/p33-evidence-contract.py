#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEDGER=ROOT/"platform-p33-audit-ledger.jsonl"
ANCHOR=ROOT/"platform-p33-ledger-anchor.json"
CLI=ROOT/"scripts/p33-ledger.py"
PACK=ROOT/"scripts/p33-build-provenance.py"

def run(cmd,expect=0,cwd=ROOT):
    p=subprocess.run(cmd,cwd=cwd,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    out=d/"verify.json"
    run([sys.executable,str(CLI),"verify",str(LEDGER),"--anchor",str(ANCHOR),"--out",str(out)])
    result=json.loads(out.read_text())
    assert result["status"]=="pass"
    assert result["anchored"] is True
    assert result["entries"]==4
    assert len(result["headHash"])==64

    raw=LEDGER.read_bytes()
    lines=LEDGER.read_text(encoding="utf-8").splitlines()

    tampered=[json.loads(x) for x in lines]
    tampered[2]["evidence"]["cronJobs"]=999
    bad=d/"tampered.jsonl"
    bad.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in tampered)+"\n",encoding="utf-8")
    run([sys.executable,str(CLI),"verify",str(bad),"--anchor",str(ANCHOR)],1)

    deleted=d/"deleted-middle.jsonl"
    deleted.write_text(lines[0]+"\n"+lines[2]+"\n"+lines[3]+"\n",encoding="utf-8")
    run([sys.executable,str(CLI),"verify",str(deleted)],1)

    reordered=d/"reordered.jsonl"
    reordered.write_text(lines[1]+"\n"+lines[0]+"\n"+lines[2]+"\n"+lines[3]+"\n",encoding="utf-8")
    run([sys.executable,str(CLI),"verify",str(reordered)],1)

    tail=d/"tail-truncated.jsonl"
    tail.write_text("\n".join(lines[:3])+"\n",encoding="utf-8")
    chain_only=d/"tail-chain.json"
    run([sys.executable,str(CLI),"verify",str(tail),"--out",str(chain_only)])
    assert json.loads(chain_only.read_text())["status"]=="pass"
    run([sys.executable,str(CLI),"verify",str(tail),"--anchor",str(ANCHOR)],1)

    anchor_data=json.loads(ANCHOR.read_text())
    anchor_data["headHash"]="0"*64
    bad_anchor=d/"bad-anchor.json"
    bad_anchor.write_text(json.dumps(anchor_data),encoding="utf-8")
    run([sys.executable,str(CLI),"verify",str(LEDGER),"--anchor",str(bad_anchor)],1)

    correction=d/"correction.json"
    correction.write_text(json.dumps({
      "eventId":"correction-test-1","recordedAt":"2026-10-03T22:00:00Z",
      "eventType":"correction","subject":"test correction",
      "actor":{"type":"human","id":"reviewer"},"sourceClass":"human_approval",
      "evidence":{"supersedesEventId":"audit-capability-20261003T215218Z","note":"append-only correction test"}
    }),encoding="utf-8")
    appended=d/"appended.jsonl"; new_anchor=d/"new-anchor.json"
    run([sys.executable,str(CLI),"append",str(LEDGER),str(correction),"--anchor",str(ANCHOR),
         "--out",str(appended),"--anchor-out",str(new_anchor)])
    assert appended.read_bytes().startswith(raw)
    run([sys.executable,str(CLI),"verify",str(appended),"--anchor",str(new_anchor)])
    assert json.loads(new_anchor.read_text())["entryCount"]==5

    invalid_correction=d/"invalid-correction.json"
    invalid_correction.write_text(json.dumps({
      "eventId":"correction-bad","recordedAt":"2026-10-03T22:00:00Z",
      "eventType":"correction","subject":"bad correction",
      "actor":{"type":"human","id":"reviewer"},"sourceClass":"human_approval",
      "evidence":{"supersedesEventId":"does-not-exist"}
    }),encoding="utf-8")
    run([sys.executable,str(CLI),"append",str(LEDGER),str(invalid_correction),"--anchor",str(ANCHOR),
         "--out",str(d/"bad-append.jsonl"),"--anchor-out",str(d/"bad-append-anchor.json")],1)

    unsafe_event=d/"unsafe-event.json"
    unsafe_event.write_text(json.dumps({
      "eventId":"unsafe-1","recordedAt":"2026-10-03T22:00:00Z","eventType":"test",
      "subject":"unsafe","actor":{"type":"system","id":"test"},"sourceClass":"supabase_native_audit",
      "evidence":{"email":"person@example.com"}
    }),encoding="utf-8")
    run([sys.executable,str(CLI),"append",str(LEDGER),str(unsafe_event),"--anchor",str(ANCHOR),
         "--out",str(d/"unsafe.jsonl"),"--anchor-out",str(d/"unsafe-anchor.json")],1)

    manifest=d/"manifest.json"
    base={
      "changeId":"p32-policy-as-code-admission",
      "subject":"Merged P32 policy-as-code governance phase",
      "git":{"repository":"thiepn/diet","commitSha":"0e7e48c57cc505ec0d42dcc706e364763b8e8c63","pullRequest":23},
      "workflows":[
        {"name":"CI","runId":37123067111,"runNumber":784,"conclusion":"success"},
        {"name":"P32 Change Admission Warn","runId":37123067138,"runNumber":1,"conclusion":"success"},
        {"name":"A7 / P25 Operations Contract","runId":37123067132,"runNumber":456,"conclusion":"success"}
      ],
      "chainRefs":{
        "p29MergeSha":"2c1bd74dfab8c45425054e552ba92bc65713c6b5",
        "p30MergeSha":"dd35a66826471b4cd94c1b9e8ead90be18dc1dc5",
        "p31MergeSha":"fd0f541fef82539c75ce3c4b429a222b4a20663f",
        "p32MergeSha":"0e7e48c57cc505ec0d42dcc706e364763b8e8c63"
      },
      "liveAttestation":{
        "observedAt":"2026-10-03T21:52:18.112063Z","projectStatus":"ACTIVE_HEALTHY",
        "migrationHead":"20261003202015",
        "semanticSchemaSha256":"5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375",
        "gomokuRoomVersion":48,"cronJobs":14
      },
      "approvals":[{"type":"operator_override","scope":"engineering_phase_progression","productionApproval":False}],
      "privacy":{"containsRawSecrets":False,"containsRawPersonalAuditData":False,"containsRawNetworkIdentifiers":False},
      "ledgerPath":str(LEDGER),"ledgerAnchorPath":str(ANCHOR),
      "requiredArtifacts":[
        {"name":"p29-dependency-graph","path":str(ROOT/"platform-p29-dependency-graph.json"),"kind":"dependency-graph","sourceClass":"derived_policy"},
        {"name":"p30-release-plan","path":str(ROOT/"platform-p30-release-train-plan.json"),"kind":"release-plan","sourceClass":"derived_policy"},
        {"name":"p31-fleet-registry","path":str(ROOT/"platform-p31-fleet-registry.json"),"kind":"fleet-registry","sourceClass":"derived_policy"},
        {"name":"p31-release-registry","path":str(ROOT/"platform-p31-release-registry.json"),"kind":"release-registry","sourceClass":"derived_policy"},
        {"name":"p32-admission-plan","path":str(ROOT/"platform-p32-change-admission-plan.json"),"kind":"policy-plan","sourceClass":"derived_policy"},
        {"name":"p32-policy-bundle","path":str(ROOT/"platform-p32-policy-bundle.json"),"kind":"policy-bundle","sourceClass":"derived_policy"}
      ]
    }
    manifest.write_text(json.dumps(base),encoding="utf-8")
    p1=d/"pack1.json"; p2=d/"pack2.json"
    run([sys.executable,str(PACK),str(manifest),"--out",str(p1)])
    run([sys.executable,str(PACK),str(manifest),"--out",str(p2)])
    j1=json.loads(p1.read_text()); j2=json.loads(p2.read_text())
    assert j1["status"]=="pass"
    assert j1["rootHash"]==j2["rootHash"]
    assert len(j1["rootHash"])==64
    assert [x["name"] for x in j1["artifacts"]]==sorted(x["name"] for x in j1["artifacts"])
    assert j1["ledger"]["headHash"]==json.loads(ANCHOR.read_text())["headHash"]

    temp_art=d/"mutable.json"; temp_art.write_text('{"v":1}\n',encoding="utf-8")
    changed=json.loads(json.dumps(base))
    changed["requiredArtifacts"].append({"name":"mutable","path":str(temp_art)})
    manifest.write_text(json.dumps(changed),encoding="utf-8")
    pa=d/"pa.json"; pb=d/"pb.json"
    run([sys.executable,str(PACK),str(manifest),"--out",str(pa)])
    temp_art.write_text('{"v":2}\n',encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(pb)])
    assert json.loads(pa.read_text())["rootHash"]!=json.loads(pb.read_text())["rootHash"]

    missing=json.loads(json.dumps(base))
    missing["requiredArtifacts"].append({"name":"missing","path":str(d/"none")})
    manifest.write_text(json.dumps(missing),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"missing-pack.json")],1)

    nochain=json.loads(json.dumps(base)); del nochain["chainRefs"]["p31MergeSha"]
    manifest.write_text(json.dumps(nochain),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"nochain.json")],1)

    dup=json.loads(json.dumps(base)); dup["requiredArtifacts"].append(dict(dup["requiredArtifacts"][0]))
    manifest.write_text(json.dumps(dup),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"dup.json")],1)

    badgit=json.loads(json.dumps(base)); badgit["git"]["commitSha"]="abc"
    manifest.write_text(json.dumps(badgit),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"badgit.json")],1)

    nowork=json.loads(json.dumps(base)); nowork["workflows"]=[]
    manifest.write_text(json.dumps(nowork),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"nowork.json")],1)

    for key in ("containsRawSecrets","containsRawPersonalAuditData","containsRawNetworkIdentifiers"):
        unsafe=json.loads(json.dumps(base)); unsafe["privacy"][key]=True
        manifest.write_text(json.dumps(unsafe),encoding="utf-8")
        run([sys.executable,str(PACK),str(manifest),"--out",str(d/(key+".json"))],1)

    badledger=json.loads(json.dumps(base)); badledger["ledgerPath"]=str(tail)
    manifest.write_text(json.dumps(badledger),encoding="utf-8")
    run([sys.executable,str(PACK),str(manifest),"--out",str(d/"bad-ledger-pack.json")],1)

print("P33 anchored-ledger, provenance, privacy and tamper-evidence contracts passed.")
