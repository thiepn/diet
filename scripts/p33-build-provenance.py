#!/usr/bin/env python3
import argparse, hashlib, json
from pathlib import Path

def sha(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""): h.update(block)
    return h.hexdigest()

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--out",default="p33-provenance-pack.json")
    args=ap.parse_args()
    m=json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    errors=[]
    if not m.get("repository") or not m.get("commitSha"):
        errors.append("exact_git_identity_required")
    workflow=m.get("workflow") or {}
    if not workflow.get("runId"):
        errors.append("workflow_run_identity_required")
    privacy=m.get("privacy") or {}
    if privacy.get("containsRawSecrets") is not False:
        errors.append("raw_secret_evidence_forbidden")
    if privacy.get("containsRawPersonalAuditData") is not False:
        errors.append("raw_personal_audit_data_forbidden")
    if errors:
        result={"schemaVersion":1,"phase":"P33","status":"fail","errors":errors}
        Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
        print(json.dumps(result,separators=(",",":")))
        raise SystemExit(1)
    required=m.get("requiredArtifacts") or []
    artifacts=[]
    missing=[]
    for item in sorted(required,key=lambda x:x["name"]):
        path=Path(item["path"])
        if not path.is_file():
            missing.append(item["name"]);continue
        artifacts.append({
          "name":item["name"],"path":item["path"],"kind":item.get("kind","file"),
          "sha256":sha(path),"bytes":path.stat().st_size
        })
    if missing:
        result={"schemaVersion":1,"phase":"P33","status":"fail","missingArtifacts":missing}
        Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
        print(json.dumps(result,separators=(",",":")))
        raise SystemExit(1)
    pack={
      "schemaVersion":1,"phase":"P33","status":"pass",
      "changeId":m.get("changeId"),
      "subject":m.get("subject"),
      "git":{"repository":m.get("repository"),"commitSha":m.get("commitSha"),"pullRequest":m.get("pullRequest")},
      "workflow":m.get("workflow"),
      "liveAttestation":m.get("liveAttestation"),
      "approvals":m.get("approvals",[]),
      "artifacts":artifacts,
      "privacy":m.get("privacy",{"containsRawSecrets":False,"containsRawPersonalAuditData":False})
    }
    pack["rootHash"]=hashlib.sha256(canonical(pack)).hexdigest()
    Path(args.out).write_text(json.dumps(pack,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(pack,separators=(",",":")))

if __name__=="__main__": main()
