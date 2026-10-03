#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path

TRANSITIONS=[
 ("candidate","integration"),
 ("integration","production_ready"),
 ("production_ready","production"),
 ("production","observation"),
 ("observation","certified")
]
EPOCH=("semanticSchemaSha256","migrationHead","edgeInventorySha256","cronInventorySha256")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def canon(o): return json.dumps(o,sort_keys=True,separators=(",",":")).encode()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("candidate"); ap.add_argument("evidence")
    ap.add_argument("--out",default="p30-rollout-certificate.json")
    args=ap.parse_args()
    c=load(args.candidate); ev=load(args.evidence); imm=c.get("immutable") or {}; errors=[]
    receipts=ev.get("promotionReceipts") or []
    actual=[(r.get("fromStage"),r.get("toStage")) for r in receipts if r.get("status")=="pass"]
    if actual!=TRANSITIONS: errors.append("promotion_receipt_sequence_invalid")
    if any(r.get("candidateId")!=c.get("candidateId") for r in receipts): errors.append("promotion_receipt_candidate_mismatch")
    if any(not r.get("promotionReceiptId") for r in receipts): errors.append("promotion_receipt_id_missing")

    if ev.get("p29CertificateId")!=imm.get("p29CertificateId"): errors.append("p29_certificate_id_mismatch")
    if ev.get("p29CertificateStatus")!="pass": errors.append("p29_certificate_not_pass")

    prod=ev.get("productionObserved") or {}
    stale=[k for k in EPOCH if prod.get(k)!=imm.get(k)]
    if stale: errors.append("production_epoch_mismatch:"+",".join(stale))

    train=imm.get("trainType")
    minimum={"app_fast":30,"shared_standard":60,"coordinated_breaking":120,"platform_maintenance":120}.get(train,10**9)
    if int(ev.get("observationMinutes",0))<minimum: errors.append("observation_window_incomplete")
    if ev.get("postReleaseHealth")!="pass": errors.append("post_release_health_not_pass")
    active=[k for k,v in (ev.get("stopConditions") or {}).items() if v]
    if active: errors.append("active_stop_conditions:"+",".join(sorted(active)))

    approval=ev.get("productionApproval") or {}
    if approval.get("approved") is not True or not approval.get("approvalRef"):
        errors.append("production_approval_evidence_missing")

    rollout_mode=ev.get("rolloutMode","all_at_once")
    if rollout_mode=="canary" and not ev.get("trafficRoutingEvidence"):
        errors.append("false_canary_claim")
    if rollout_mode not in ("all_at_once","canary"):
        errors.append("unknown_rollout_mode")

    material={
      "candidateId":c.get("candidateId"),"trainId":imm.get("trainId"),"trainType":train,
      "p29CertificateId":imm.get("p29CertificateId"),
      "promotionReceiptIds":[r.get("promotionReceiptId") for r in receipts],
      "productionObserved":prod,"observationMinutes":ev.get("observationMinutes"),
      "postReleaseHealth":ev.get("postReleaseHealth"),"productionApprovalRef":approval.get("approvalRef"),
      "rolloutMode":rollout_mode
    }
    out={
      "schemaVersion":1,"phase":"P30","status":"fail" if errors else "pass",
      "rolloutCertificateId":hashlib.sha256(canon(material)).hexdigest() if not errors else None,
      "candidateId":c.get("candidateId"),"trainId":imm.get("trainId"),"trainType":train,
      "errors":errors,"staleFields":stale,"activeStopConditions":active,
      "productionPromotionPerformedByCertifier":False
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
