#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path

EPOCH=("semanticSchemaSha256","migrationHead","edgeInventorySha256","cronInventorySha256")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def canonical_sha(obj):
    return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("impact")
    ap.add_argument("evidence")
    ap.add_argument("--out",default="p29-release-certificate.json")
    args=ap.parse_args()
    impact=load(args.impact); ev=load(args.evidence); errors=[]

    for key in ("graphVersion","graphSha256","changeManifestSha256"):
        if ev.get(key)!=impact.get(key): errors.append(key+"_mismatch")

    for key in EPOCH:
        if not ev.get("baseline",{}).get(key): errors.append("missing_baseline:"+key)
        if not ev.get("observed",{}).get(key): errors.append("missing_observed:"+key)

    required=set(impact.get("affectedComponents",[]))
    results={x.get("component"):x for x in ev.get("componentResults",[]) if x.get("component")}
    missing=sorted(required-set(results))
    failed=sorted(c for c in required if c in results and results[c].get("status")!="pass")
    if missing: errors.append("missing_components:"+",".join(missing))
    if failed: errors.append("failed_components:"+",".join(failed))

    for scope in impact.get("requiredScopes",[]):
        if ev.get("scopeResults",{}).get(scope)!="pass": errors.append("scope_not_pass:"+scope)

    stale=[]
    base=ev.get("baseline",{}); obs=ev.get("observed",{})
    for key in EPOCH:
        if base.get(key) and obs.get(key) and base[key]!=obs[key]: stale.append(key)
    if stale: errors.append("baseline_changed:"+",".join(stale))

    required_quiet=int(impact.get("requiredQuietWindowMinutes",0))
    observed_quiet=int(ev.get("quietWindowObservedMinutes",0))
    if required_quiet and observed_quiet<required_quiet:
        errors.append(f"quiet_window_insufficient:{observed_quiet}<{required_quiet}")

    if impact.get("breaking") and ev.get("deprecatedContractRemovalRequested") is True:
        if ev.get("deprecatedContractCleanupAuthorized") is not True:
            errors.append("breaking_cleanup_not_authorized")
        if ev.get("scopeResults",{}).get("all_affected_consumers")!="pass":
            errors.append("breaking_cleanup_consumers_not_certified")

    status="pass" if not errors else "fail"
    receipt_material={
      "phase":"P29","changeId":impact.get("changeId"),"graphVersion":impact.get("graphVersion"),
      "graphSha256":impact.get("graphSha256"),"changeManifestSha256":impact.get("changeManifestSha256"),
      "affectedComponents":impact.get("affectedComponents",[]),"requiredScopes":impact.get("requiredScopes",[]),
      "baseline":base,"observed":obs,"componentResults":ev.get("componentResults",[]),
      "scopeResults":ev.get("scopeResults",{}),"quietWindowObservedMinutes":observed_quiet
    }
    cert={
      "schemaVersion":2,"phase":"P29","status":status,
      "certificateId":canonical_sha(receipt_material) if status=="pass" else None,
      "changeId":impact.get("changeId"),"graphVersion":impact.get("graphVersion"),
      "graphSha256":impact.get("graphSha256"),"changeManifestSha256":impact.get("changeManifestSha256"),
      "affectedComponents":impact.get("affectedComponents",[]),
      "baselineStale":bool(stale),"staleFields":stale,
      "quietWindowRequiredMinutes":required_quiet,"quietWindowObservedMinutes":observed_quiet,
      "errors":errors,"productionPromotionAllowed":False,"productionMutationPerformed":False
    }
    Path(args.out).write_text(json.dumps(cert,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(cert,separators=(",",":")))
    if status!="pass": raise SystemExit(1)

if __name__=="__main__": main()
