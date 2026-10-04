#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def fsha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--manifest",default="contracts/p37-governance-stack-manifest.json")
    ap.add_argument("--registry",default="platform-p31-release-registry.json")
    ap.add_argument("--fleet",default="platform-p31-fleet-registry.json")
    ap.add_argument("--policy",default="platform-p32-policy-bundle.json")
    ap.add_argument("--anchor",default="platform-p33-ledger-anchor.json")
    ap.add_argument("--catalog",default="platform-p34-control-catalog.json")
    ap.add_argument("--p35",default="platform-p35-operating-effectiveness-plan.json")
    ap.add_argument("--p36",default="platform-p36-operating-effectiveness-state.json")
    ap.add_argument("--out",default="p37-governance-stack-certificate.json")
    ap.add_argument("--require-certified",action="store_true")
    a=ap.parse_args()
    m=load(a.manifest); r=load(a.registry); fleet=load(a.fleet); policy=load(a.policy)
    anchor=load(a.anchor); catalog=load(a.catalog); p35=load(a.p35); p36=load(a.p36)
    errors=[]

    expected=m["phases"]; actual=r.get("phases") or []
    if [x.get("id") for x in actual] != [x["phase"] for x in expected]:
        errors.append("governance_phase_sequence_mismatch")
    amap={x.get("id"):x for x in actual}
    for item in expected:
        row=amap.get(item["phase"])
        if not row: continue
        if row.get("pr")!=item["prNumber"]: errors.append("pr_mismatch:"+item["phase"])
        if row.get("mergeSha")!=item["mergeSha"]: errors.append("merge_sha_mismatch:"+item["phase"])
        if not str(row.get("state","")).startswith("merged_"): errors.append("phase_not_merged:"+item["phase"])
    if r.get("latestMergedGovernancePhase")!=m["expectedLatestMergedGovernancePhase"]:
        errors.append("latest_merged_phase_mismatch")
    if r.get("latestMergedMainSha")!=m["expectedLatestMergedMainSha"]:
        errors.append("latest_merged_main_sha_mismatch")

    cov=fleet.get("coverage") or {}
    if cov.get("dependencyGraphCoveragePct")!=100: errors.append("dependency_graph_coverage_not_100")
    if cov.get("registeredAppGovernanceCoveragePct")!=100: errors.append("registered_app_governance_not_100")
    if any(x.get("governance")!="governed" for x in fleet.get("components") or []):
        errors.append("ungoverned_fleet_component")

    if policy.get("mode") not in ("warn","enforce","production"): errors.append("p32_below_warn")
    if policy.get("fleetRegistryVersion")!=fleet.get("registryVersion"): errors.append("p32_fleet_registry_binding_mismatch")
    if policy.get("releaseRegistryVersion")!=r.get("registryVersion"): errors.append("p32_release_registry_binding_mismatch")
    if not anchor.get("headHash") or len(anchor.get("headHash",""))!=64: errors.append("p33_anchor_invalid")
    if catalog.get("catalogVersion")!="2026-10-03.1": errors.append("p34_catalog_version_mismatch")
    if p35.get("evidencePeriod",{}).get("periodStart") is not None: errors.append("p35_period_already_started")
    if p36.get("active") is not False: errors.append("p36_oe_already_active")

    out={
      "schemaVersion":2,"phase":"P37",
      "decision":"certified" if not errors else "blocked",
      "mergedPhases":[x["phase"] for x in expected],
      "latestMergedMainSha":r.get("latestMergedMainSha"),
      "p32Mode":policy.get("mode"),"fleetRegistryVersion":fleet.get("registryVersion"),
      "releaseRegistryVersion":r.get("registryVersion"),
      "p33HeadHash":anchor.get("headHash"),"p34CatalogVersion":catalog.get("catalogVersion"),
      "artifactHashes":{"manifest":fsha(a.manifest),"registry":fsha(a.registry),"fleet":fsha(a.fleet),
                        "policy":fsha(a.policy),"anchor":fsha(a.anchor),"catalog":fsha(a.catalog)},
      "errors":sorted(set(errors))
    }
    out["certificateId"]=hid(out) if not errors else None
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_certified and errors: raise SystemExit(1)

if __name__=="__main__": main()
