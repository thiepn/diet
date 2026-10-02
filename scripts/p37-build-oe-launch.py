#!/usr/bin/env python3
import argparse,json
from datetime import datetime,timedelta
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def dt(value):
    return datetime.fromisoformat(value.replace("Z","+00:00"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("certification")
    ap.add_argument("promotion")
    ap.add_argument("governance")
    ap.add_argument("--manifest",default="contracts/p37-governance-promotion-manifest.json")
    ap.add_argument("--risk",default="platform-p37-d001-risk-treatment.json")
    ap.add_argument("--out",default="p37-oe-launch.json")
    args=ap.parse_args()

    cert=load(args.certification)
    promo=load(args.promotion)
    gov=load(args.governance)
    manifest=load(args.manifest)
    risk=load(args.risk)
    errors=[]

    if cert.get("decision")!="certified":
        errors.append("burnin_not_certified")

    expected=[x["phase"] for x in manifest["phases"]]
    receipts=promo.get("receipts") or []
    phases=[x.get("phase") for x in receipts]
    if phases!=expected:
        errors.append("promotion_receipt_order_or_coverage_invalid")
    previous_post=None
    for i,r in enumerate(receipts):
        if r.get("merged") is not True or not r.get("preMergeMainSha") or not r.get("mergeCommitSha") or not r.get("postMergeMainSha"):
            errors.append("invalid_promotion_receipt:"+str(r.get("phase")))
            continue
        if i>0 and r.get("preMergeMainSha")!=previous_post:
            errors.append("promotion_receipt_chain_break:"+str(r.get("phase")))
        previous_post=r.get("postMergeMainSha")

    if gov.get("p32Mode") not in ("warn","enforce","production"):
        errors.append("p32_not_warn_or_enforce")
    if gov.get("p33CanonicalEvidenceActive") is not True:
        errors.append("p33_canonical_evidence_not_active")
    if gov.get("controlCatalogFrozen") is not True:
        errors.append("control_catalog_not_frozen")
    if gov.get("controlCatalogVersion")!="2026-10-02.1":
        errors.append("control_catalog_version_mismatch")
    if gov.get("evidenceCollectionDryRunPass") is not True:
        errors.append("evidence_collection_dry_run_not_pass")
    if int(gov.get("criticalOpenDeficiencies",-1))!=0:
        errors.append("critical_deficiency_open")
    if gov.get("p34D006Closed") is not True:
        errors.append("p34_d006_not_closed")
    if gov.get("highDeficienciesDispositionedOrRemediating") is not True:
        errors.append("high_deficiencies_not_dispositioned")

    if gov.get("d001RiskTreatmentActive") is not True:
        errors.append("d001_risk_treatment_not_active")
    if int(gov.get("usersWithPasswordHash",-1))!=0:
        errors.append("password_auth_exposure_present")
    providers=gov.get("identityProviderCounts") or {}
    if set(providers)!={"google"}:
        errors.append("unexpected_identity_provider_for_d001_treatment")
    if risk.get("state") not in ("prepared_pending_p37_activation","active"):
        errors.append("d001_risk_treatment_invalid")

    observed=dt(gov["observedAt"])
    expiry=dt(risk["expiresAt"])
    if observed>=expiry:
        errors.append("d001_risk_treatment_expired")

    if errors:
        out={
          "schemaVersion":1,"phase":"P37","decision":"blocked",
          "oeState":"not_started","errors":errors
        }
    else:
        out={
          "schemaVersion":1,"phase":"P37","decision":"launched",
          "oeState":"active","periodId":"p37-oe-001",
          "periodStart":gov["observedAt"],
          "internalDryRunMinimumEnd":(observed+timedelta(days=30)).isoformat().replace("+00:00","Z"),
          "externalReadinessPlanningTargetEnd":(observed+timedelta(days=90)).isoformat().replace("+00:00","Z"),
          "activationIsRetroactive":False,
          "externalAttestation":False,
          "p32Mode":gov["p32Mode"],
          "p33CanonicalEvidenceActive":True,
          "controlCatalogVersion":gov["controlCatalogVersion"],
          "d001RiskTreatmentExpiresAt":risk["expiresAt"],
          "promotionFinalMainSha":receipts[-1]["postMergeMainSha"],
          "errors":[]
        }

    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
