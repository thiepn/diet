#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("impact")
    ap.add_argument("evidence")
    ap.add_argument("--out",default="p29-release-certificate.json")
    args=ap.parse_args()
    impact=load(args.impact); ev=load(args.evidence)

    errors=[]
    for key in ("graphVersion","baselineSemanticSchemaSha256","migrationHead","edgeInventorySha256"):
        if not ev.get(key): errors.append("missing:"+key)
    if ev.get("graphVersion")!=impact.get("graphVersion"): errors.append("graph_version_mismatch")
    required=set(impact.get("affectedComponents",[]))
    results={x.get("component"):x for x in ev.get("componentResults",[]) if x.get("component")}
    missing=sorted(required-set(results))
    failed=sorted(c for c in required if c in results and results[c].get("status")!="pass")
    if missing: errors.append("missing_components:"+",".join(missing))
    if failed: errors.append("failed_components:"+",".join(failed))
    for scope in impact.get("requiredScopes",[]):
        if ev.get("scopeResults",{}).get(scope)!="pass":
            errors.append("scope_not_pass:"+scope)
    stale=[]
    baseline=ev.get("baseline",{})
    observed=ev.get("observed",{})
    for key in ("semanticSchemaSha256","migrationHead","edgeInventorySha256","cronInventorySha256"):
        if baseline.get(key) and observed.get(key) and baseline[key]!=observed[key]:
            stale.append(key)
    if stale: errors.append("baseline_changed:"+",".join(stale))

    status="pass" if not errors else "fail"
    cert={
      "schemaVersion":1,"phase":"P29","status":status,
      "changeId":impact.get("changeId"),"graphVersion":impact.get("graphVersion"),
      "affectedComponents":impact.get("affectedComponents",[]),
      "errors":errors,"baselineStale":bool(stale),"staleFields":stale
    }
    Path(args.out).write_text(json.dumps(cert,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(cert,separators=(",",":")))
    if status!="pass": raise SystemExit(1)

if __name__=="__main__": main()
