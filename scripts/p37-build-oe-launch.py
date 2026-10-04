#!/usr/bin/env python3
import argparse,hashlib,json
from datetime import datetime,timezone,timedelta
from pathlib import Path

ALLOWED_HIGH={"closed","remediating","ready_for_retest","accepted_temporarily"}

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def dt(v):
    d=datetime.fromisoformat(v.replace("Z","+00:00"))
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def z(d): return d.isoformat().replace("+00:00","Z")
def fsha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def hid(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("burnin_certificate")
    ap.add_argument("governance_certificate")
    ap.add_argument("context")
    ap.add_argument("--risk",default="platform-p37-d001-risk-treatment.json")
    ap.add_argument("--anchor",default="platform-p33-ledger-anchor.json")
    ap.add_argument("--catalog",default="platform-p34-control-catalog.json")
    ap.add_argument("--snapshot",default="platform-p34-assurance-snapshot.json")
    ap.add_argument("--out",default="p37-oe-launch-decision.json")
    ap.add_argument("--require-launchable",action="store_true")
    a=ap.parse_args()
    burn=load(a.burnin_certificate); govcert=load(a.governance_certificate); ctx=load(a.context); risk=load(a.risk)
    errors=[]

    if burn.get("decision")!="certified" or not burn.get("certificateId"):
        errors.append("burnin_not_certified")
    if govcert.get("decision")!="certified" or not govcert.get("certificateId"):
        errors.append("governance_stack_not_certified")

    if ctx.get("p32Mode") not in ("warn","enforce","production"): errors.append("p32_below_warn")
    if ctx.get("p33CanonicalEvidenceActive") is not True: errors.append("p33_evidence_not_active")
    if ctx.get("controlCatalogFrozen") is not True: errors.append("control_catalog_not_frozen")
    if ctx.get("controlCatalogVersion")!="2026-10-03.1": errors.append("control_catalog_version_mismatch")
    if ctx.get("evidenceCollectionDryRunPass") is not True: errors.append("evidence_collection_dry_run_not_pass")
    if int(ctx.get("criticalOpenDeficiencies",-1))!=0: errors.append("critical_deficiency_open")

    states=ctx.get("highDeficiencyStates") or {}
    for did in ("P34-D001","P34-D002"):
        if states.get(did) not in ALLOWED_HIGH: errors.append("high_deficiency_not_dispositioned:"+did)
    if states.get("P34-D005")!="closed": errors.append("p34_d005_not_closed")
    if states.get("P34-D006")!="closed": errors.append("p34_d006_not_closed")

    d001=states.get("P34-D001")
    if d001=="accepted_temporarily":
        if risk.get("state")!="active": errors.append("d001_risk_treatment_not_active")
        if risk.get("riskAcceptanceAuthorized") is not True: errors.append("d001_risk_acceptance_not_authorized")
        if not risk.get("requestedBy") or not risk.get("approvedBy") or risk.get("requestedBy")==risk.get("approvedBy"):
            errors.append("d001_independent_approver_required")
        if not risk.get("approvalRef"): errors.append("d001_approval_reference_missing")
        if int(ctx.get("passwordAuthUsers",-1))!=0: errors.append("password_auth_exposure_present")
        if risk.get("expiresAt") is None: errors.append("d001_expiry_missing")
        else:
            observed=dt(ctx["observedAt"]); expiry=dt(risk["expiresAt"])
            if observed>=expiry: errors.append("d001_risk_treatment_expired")
            if (expiry-observed).total_seconds()>int(risk.get("proposedMaximumDays",90))*86400:
                errors.append("d001_risk_treatment_exceeds_maximum")

    if ctx.get("explicitLaunchAuthorization") is not True: errors.append("explicit_launch_authorization_missing")
    if not ctx.get("requestedBy") or not ctx.get("authorizedBy") or ctx.get("requestedBy")==ctx.get("authorizedBy"):
        errors.append("independent_launch_authorizer_required")

    actual={
      "p33AnchorSha256":fsha(a.anchor),
      "controlCatalogSha256":fsha(a.catalog),
      "p34SnapshotSha256":fsha(a.snapshot)
    }
    for k,v in actual.items():
        if ctx.get(k)!=v: errors.append("baseline_hash_mismatch:"+k)
    if ctx.get("p33HeadHash")!=load(a.anchor).get("headHash"): errors.append("p33_head_hash_mismatch")

    if burn.get("generation")!=ctx.get("certifiedGeneration"): errors.append("certified_generation_mismatch")
    if ctx.get("burninCertificateId")!=burn.get("certificateId"): errors.append("burnin_certificate_id_mismatch")
    if ctx.get("governanceCertificateId")!=govcert.get("certificateId"): errors.append("governance_certificate_id_mismatch")

    out={
      "schemaVersion":2,"phase":"P37",
      "decision":"launchable" if not errors else "blocked",
      "oeState":"ready_to_start" if not errors else "not_started",
      "observedAt":ctx.get("observedAt"),
      "activationIsRetroactive":False,"externalAttestation":False,
      "certifiedGeneration":ctx.get("certifiedGeneration"),
      "burninCertificateId":burn.get("certificateId"),
      "governanceCertificateId":govcert.get("certificateId"),
      "errors":sorted(set(errors))
    }
    if not errors:
        start=dt(ctx["observedAt"])
        out.update({
          "periodId":"p37-oe-001","periodStart":z(start),
          "internalDryRunMinimumEnd":z(start+timedelta(days=30)),
          "externalReadinessPlanningTargetEnd":z(start+timedelta(days=90)),
          "launchAuthorizationId":hid({
             "observedAt":ctx["observedAt"],"requestedBy":ctx["requestedBy"],"authorizedBy":ctx["authorizedBy"],
             "burninCertificateId":burn["certificateId"],"governanceCertificateId":govcert["certificateId"],
             **actual
          })
        })
    out["decisionId"]=hid(out)
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if a.require_launchable and errors: raise SystemExit(1)

if __name__=="__main__": main()
