#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path

ORDER={"shadow":0,"warn":1,"enforce":2,"production":3}
ALLOWED_HIGH={"closed","remediating","ready_for_retest","accepted_temporarily"}

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def hash_obj(v):
    return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("gate")
    ap.add_argument("--plan",default="platform-p35-operating-effectiveness-plan.json")
    ap.add_argument("--out",default="p35-period-start-decision.json")
    ap.add_argument("--require-allow",action="store_true")
    a=ap.parse_args()
    plan=load(a.plan); gate=load(a.gate)
    blockers=[]
    sg=plan["startGate"]

    if gate.get("mode")!="operating": blockers.append("gate_mode_must_be_operating")
    stable=gate.get("scopedEpochStableMinutes")
    if not isinstance(stable,(int,float)) or stable<sg["minimumScopedEpochStableMinutes"]:
        blockers.append("scoped_epoch_not_stable_long_enough")
    if gate.get("criticalOpen")!=0: blockers.append("critical_deficiency_open")
    states=gate.get("highDeficiencyStates") or {}
    for did in sg["highDeficienciesChecked"]:
        if states.get(did) not in ALLOWED_HIGH:
            blockers.append("high_deficiency_not_dispositioned:"+did)
    if ORDER.get(gate.get("p32Mode"),-1)<ORDER[sg["p32MinimumMode"]]:
        blockers.append("p32_mode_below_minimum")
    if gate.get("p33LedgerVerified") is not True: blockers.append("p33_ledger_not_verified")
    if gate.get("controlCatalogFrozen") is not True: blockers.append("control_catalog_not_frozen")
    if gate.get("evidenceCollectorContractPass") is not True: blockers.append("collector_contract_not_passed")
    if gate.get("explicitAuthorization") is not True: blockers.append("explicit_start_authorization_missing")
    if gate.get("p34CatalogVersion")!=plan["baselineBinding"]["p34CatalogVersion"]:
        blockers.append("p34_catalog_version_mismatch")
    if gate.get("p34SnapshotVersion")!=plan["baselineBinding"]["p34SnapshotVersion"]:
        blockers.append("p34_snapshot_version_mismatch")
    for key in ("p33HeadHash","p33AnchorSha256","controlCatalogSha256","p34SnapshotSha256"):
        v=gate.get(key)
        if not isinstance(v,str) or len(v)!=64: blockers.append("invalid_hash:"+key)
    if not gate.get("authorizedBy") or gate.get("authorizedBy")==gate.get("requestedBy"):
        blockers.append("independent_authorizer_required")

    decision={
      "schemaVersion":2,"phase":"P35","decision":"allow" if not blockers else "block",
      "canStart":not blockers,"periodClockStarted":False,
      "requestedPeriodId":gate.get("periodId"),
      "observedAt":gate.get("observedAt"),
      "blockers":sorted(set(blockers)),
      "productionMutationPerformed":False,
      "externalCertificationClaim":False
    }
    decision["decisionId"]=hash_obj(decision)
    if not blockers:
        material={
          "periodId":gate["periodId"],"observedAt":gate["observedAt"],
          "p33HeadHash":gate["p33HeadHash"],"controlCatalogSha256":gate["controlCatalogSha256"],
          "p34SnapshotSha256":gate["p34SnapshotSha256"],"authorizedBy":gate["authorizedBy"]
        }
        decision["startAuthorizationId"]=hash_obj(material)
    Path(a.out).write_text(json.dumps(decision,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(decision,separators=(",",":")))
    if a.require_allow and blockers: raise SystemExit(1)

if __name__=="__main__": main()
