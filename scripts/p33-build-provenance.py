#!/usr/bin/env python3
import argparse,hashlib,json,re
from pathlib import Path

HEX40=re.compile(r"^[0-9a-f]{40}$")
HEX64=re.compile(r"^[0-9a-f]{64}$")

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")

def sha_file(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""): h.update(block)
    return h.hexdigest()

def fail(out,errors):
    result={"schemaVersion":2,"phase":"P33","status":"fail","errors":errors}
    Path(out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    raise SystemExit(1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--out",default="p33-provenance-pack.json")
    args=ap.parse_args()

    m=json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    errors=[]
    git=m.get("git") or {}
    workflows=m.get("workflows") or []
    privacy=m.get("privacy") or {}
    chain=m.get("chainRefs") or {}
    artifacts=m.get("requiredArtifacts") or []
    anchor_path=m.get("ledgerAnchorPath")

    if not m.get("changeId") or not m.get("subject"): errors.append("change_identity_required")
    if not git.get("repository") or not HEX40.match(str(git.get("commitSha",""))):
        errors.append("exact_git_commit_required")
    if not workflows: errors.append("workflow_identity_required")
    for i,w in enumerate(workflows):
        if not w.get("name") or w.get("runId") in (None,"") or not w.get("conclusion"):
            errors.append(f"workflow_identity_incomplete:{i}")
    if privacy.get("containsRawSecrets") is not False:
        errors.append("raw_secret_evidence_forbidden")
    if privacy.get("containsRawPersonalAuditData") is not False:
        errors.append("raw_personal_audit_data_forbidden")
    if privacy.get("containsRawNetworkIdentifiers") is not False:
        errors.append("raw_network_identifier_evidence_forbidden")

    required_chain={"p29MergeSha","p30MergeSha","p31MergeSha","p32MergeSha"}
    missing_chain=sorted(k for k in required_chain if not HEX40.match(str(chain.get(k,""))))
    if missing_chain: errors.append("missing_chain_refs:"+",".join(missing_chain))

    names=[x.get("name") for x in artifacts]
    if any(not x for x in names): errors.append("artifact_logical_name_required")
    if len(names)!=len(set(names)): errors.append("duplicate_artifact_logical_name")

    if not anchor_path or not Path(anchor_path).is_file():
        errors.append("ledger_anchor_required")
        anchor=None
    else:
        try: anchor=json.loads(Path(anchor_path).read_text(encoding="utf-8"))
        except Exception:
            errors.append("ledger_anchor_invalid"); anchor=None
        if anchor and not HEX64.match(str(anchor.get("headHash",""))):
            errors.append("ledger_anchor_head_invalid")

    if errors: fail(args.out,errors)

    resolved=[]; missing=[]
    for item in sorted(artifacts,key=lambda x:x["name"]):
        path=Path(item["path"])
        if not path.is_file():
            missing.append(item["name"]); continue
        resolved.append({
          "name":item["name"],
          "path":item["path"],
          "kind":item.get("kind","file"),
          "sourceClass":item.get("sourceClass","github_source"),
          "sha256":sha_file(path),
          "bytes":path.stat().st_size
        })
    if missing: fail(args.out,["missing_artifacts:"+",".join(missing)])

    pack={
      "schemaVersion":2,"phase":"P33","status":"pass",
      "changeId":m["changeId"],"subject":m["subject"],
      "git":git,
      "workflows":sorted(workflows,key=lambda x:(str(x.get("name")),str(x.get("runId")))),
      "chainRefs":chain,
      "liveAttestation":m.get("liveAttestation"),
      "approvals":m.get("approvals",[]),
      "artifacts":resolved,
      "ledgerAnchor":{
        "path":anchor_path,
        "sha256":sha_file(anchor_path),
        "headHash":anchor["headHash"],
        "entryCount":anchor["entryCount"],
        "ledgerSha256":anchor["ledgerSha256"]
      },
      "privacy":privacy
    }
    pack["rootHash"]=hashlib.sha256(canonical(pack)).hexdigest()
    Path(args.out).write_text(json.dumps(pack,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(pack,separators=(",",":")))

if __name__=="__main__": main()
