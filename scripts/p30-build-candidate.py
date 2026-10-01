#!/usr/bin/env python3
import argparse, hashlib, json
from pathlib import Path

IMMUTABLE = (
    "trainId","trainType","gitSha","dependencyGraphVersion","changeManifestSha256",
    "impactAnalysisSha256","semanticSchemaSha256","migrationHead","edgeInventorySha256",
    "cronInventorySha256","environmentTopologyVersion"
)

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--out",default="p30-release-candidate.json")
    args=ap.parse_args()
    data=json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    missing=[k for k in IMMUTABLE if not data.get(k)]
    if missing:
        raise SystemExit("missing immutable fields: "+",".join(missing))
    immutable={k:data[k] for k in IMMUTABLE}
    candidate_id=hashlib.sha256(canonical(immutable)).hexdigest()
    out={
      "schemaVersion":1,
      "phase":"P30",
      "candidateId":candidate_id,
      "immutable":immutable,
      "createdFrom":str(args.manifest),
      "status":"candidate",
      "metadata":data.get("metadata",{})
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__":
    main()
