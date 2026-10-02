#!/usr/bin/env python3
import argparse, json
from datetime import datetime
from pathlib import Path

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def dt(v):
    return datetime.fromisoformat(v.replace("Z","+00:00"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("observation")
    ap.add_argument("samples")
    ap.add_argument("activation")
    ap.add_argument("--freeze",default="platform-p36-stable-epoch-freeze.json")
    ap.add_argument("--p25",default="platform-p25-burn-in-plan.json")
    ap.add_argument("--out",default="p36-activation-decision.json")
    args=ap.parse_args()

    freeze=load(args.freeze)
    p25=load(args.p25)
    obs=load(args.observation)
    samples=load(args.samples)
    act=load(args.activation)
    errors=[]

    frozen=freeze["frozenEpoch"]
    compare={
      "migrationVersion":frozen["migrationVersion"],
      "migrationName":frozen["migrationName"],
      "semanticSchemaSha256":frozen["semanticSchemaSha256"],
      "gomokuRoomVersion":frozen["gomokuRoomVersion"],
      "gomokuRoomSha256":frozen["gomokuRoomSha256"],
      "cronJobs":frozen["cronJobs"]
    }
    stale=[]
    for k,v in compare.items():
        if obs.get(k)!=v:
            stale.append(k)
    if stale:
        errors.append("frozen_epoch_changed:"+",".join(stale))

    if obs.get("projectStatus")!="ACTIVE_HEALTHY":
        errors.append("project_not_active_healthy")
    if obs.get("p18Integrity")!="clean":
        errors.append("p18_not_clean")
    if obs.get("p20SchemaDrift") is not False:
        errors.append("p20_drift")
    if obs.get("p21Readiness")!="pass":
        errors.append("p21_not_pass")
    if obs.get("p22Maintenance")!="pass":
        errors.append("p22_not_pass")
    if int(obs.get("cronFailures24h",0))!=0:
        errors.append("cron_failures_present")

    if p25.get("generation")!=2 or p25.get("state")!="burn_in_active":
        errors.append("p25_generation2_not_active")

    observed_at=dt(obs["observedAt"])
    minimum=dt(p25["minimumCompleteAfter"])
    start=dt(p25["activatedAt"])
    if observed_at < minimum:
        errors.append("p25_minimum_time_not_reached")

    rows=samples.get("samples") or []
    good=sorted(
      [r for r in rows if r.get("status")=="success" and r.get("healthy") is True],
      key=lambda r:r["timestamp"]
    )
    if len(good)<int(p25["burnInRequirements"]["minimumHourlyPublicSamples"]):
        errors.append("insufficient_public_samples")
    if good:
        first=dt(good[0]["timestamp"]); last=dt(good[-1]["timestamp"])
        if first < start:
            # Old samples are ignored semantically; require at least one sample at/after start.
            good=[r for r in good if dt(r["timestamp"])>=start]
            if len(good)<int(p25["burnInRequirements"]["minimumHourlyPublicSamples"]):
                errors.append("insufficient_generation2_samples")
            if good:
                first=dt(good[0]["timestamp"]); last=dt(good[-1]["timestamp"])
        if first < start:
            errors.append("sample_window_starts_before_generation2")
        if last < minimum:
            errors.append("samples_do_not_span_minimum_window")
    else:
        errors.append("no_public_samples")

    mode=act.get("p32Mode")
    if mode not in ("warn","enforce","production"):
        errors.append("p32_not_warn_or_enforce")
    if act.get("p33CanonicalEvidenceActive") is not True:
        errors.append("p33_evidence_not_active")
    if act.get("controlCatalogFrozen") is not True:
        errors.append("control_catalog_not_frozen")
    if act.get("evidenceCollectionDryRunPass") is not True:
        errors.append("evidence_collection_dry_run_not_pass")
    if int(act.get("criticalOpenDeficiencies",0))!=0:
        errors.append("critical_deficiency_open")
    if act.get("highDeficienciesDispositionedOrRemediating") is not True:
        errors.append("high_deficiencies_not_dispositioned")

    result={
      "schemaVersion":1,
      "phase":"P36",
      "decision":"ready_to_activate" if not errors else "blocked",
      "observedAt":obs["observedAt"],
      "p25Generation":p25.get("generation"),
      "successfulSamples":len(good),
      "frozenEpochMatches":not stale,
      "activationIsRetroactive":False,
      "errors":errors
    }
    Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,separators=(",",":")))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
