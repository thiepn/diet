#!/usr/bin/env python3
import argparse,hashlib,json,re
from pathlib import Path

FIELDS=(
 "trainId","trainType","gitSha",
 "dependencyGraphVersion","dependencyGraphSha256","p29CertificateId",
 "changeManifestSha256","impactAnalysisSha256",
 "semanticSchemaSha256","migrationHead","edgeInventorySha256","cronInventorySha256",
 "environmentTopologyVersion"
)
TRAIN_TYPES={"app_fast","shared_standard","coordinated_breaking","platform_maintenance"}
HEX64=re.compile(r"^[0-9a-f]{64}$")

def canonical(obj):
    return json.dumps(obj,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--out",default="p30-release-candidate.json")
    args=ap.parse_args()
    data=json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    missing=[k for k in FIELDS if data.get(k) in (None,"")]
    if missing: raise SystemExit("missing immutable fields: "+",".join(missing))
    if data["trainType"] not in TRAIN_TYPES: raise SystemExit("unknown train type")
    for k in ("dependencyGraphSha256","p29CertificateId","changeManifestSha256","impactAnalysisSha256","semanticSchemaSha256","edgeInventorySha256","cronInventorySha256"):
        if not HEX64.match(str(data[k])): raise SystemExit("invalid sha256 field: "+k)
    immutable={k:data[k] for k in FIELDS}
    candidate_id=hashlib.sha256(canonical(immutable)).hexdigest()
    out={
      "schemaVersion":2,"phase":"P30","candidateId":candidate_id,
      "immutable":immutable,"status":"candidate",
      "metadata":data.get("metadata",{}),
      "productionPromotionAllowed":False,
      "productionMutationPerformed":False
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__": main()
