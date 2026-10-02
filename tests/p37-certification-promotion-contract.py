#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from datetime import datetime,timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CERT=ROOT/"scripts/p37-certify-burnin.py"
PROMO=ROOT/"scripts/p37-evaluate-promotion.py"
LAUNCH=ROOT/"scripts/p37-build-oe-launch.py"
MANIFEST=json.loads((ROOT/"contracts/p37-governance-promotion-manifest.json").read_text())
PLAN=json.loads((ROOT/"platform-p37-certification-promotion-launch-plan.json").read_text())
RISK=json.loads((ROOT/"platform-p37-d001-risk-treatment.json").read_text())
P25=json.loads((ROOT/"platform-p25-burn-in-plan.json").read_text())

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

def write(path,obj):
    Path(path).write_text(json.dumps(obj),encoding="utf-8")

def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

assert PLAN["state"]=="staged_waiting_p25_generation3_refreeze"
assert PLAN["p25Current"]["minimumSuccessfulSamples"]==12
assert PLAN["p25Current"]["minimumCoverageBuckets"]==6
assert PLAN["p25Current"]["currentGenerationEligible"] is False
assert PLAN["governancePromotion"]["onePhaseAtATime"] is True
assert PLAN["governancePromotion"]["allowBatchMerge"] is False
assert P25["state"]=="refreeze_pending"
assert P25["generationState"]=="generation3_refreeze_pending"
assert RISK["liveEvidence"]["usersWithPasswordHash"]==0
assert RISK["liveEvidence"]["identityProviderCounts"]=={"google":11}
assert RISK["permanentClosure"] is False

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs=d/"obs.json"; samples=d/"samples.json"; cert=d/"cert.json"; p25f=d/"p25.json"

    base_obs={
      "observedAt":"2026-10-02T17:30:00Z",
      "projectStatus":"ACTIVE_HEALTHY",
      "migrationVersion":"20261002152739",
      "migrationName":"gomoku_p17_certification_health_isolation",
      "semanticSchemaSha256":"d5c977fc0d74ea6745ac588fc90656dadc18ee0568c3ac248cfd7540ceb6de00",
      "gomokuRoomVersion":45,
      "gomokuRoomSha256":"70e86288e735659c4f0a3c9a2608acf48305ae73afe915fefb22add8f293a2de",
      "cronJobs":11,"activeCronJobs":11,"cronFailures24h":0,"blockingReplicationSlots":0,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass",
      "encryptedBackupConclusion":"success","encryptedBackupAfterFinalSharedChange":True,
      "crossAppSmokePassed":True,"edgeInventoryAllActive":True,
      "authHealthy":True,"realtimeHealthy":True,"postgrestHealthy":True,"storageHealthy":True,
      "securityAdvisorsReviewed":True,"performanceAdvisorsReviewed":True,
      "postgres1711HazardCount":0
    }

    # Real repository state must fail: no eligible active generation exists.
    write(obs,base_obs);write(samples,{"samples":[]});write(p25f,P25)
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(p25f),"--out",str(cert)],1)
    blocked=read(cert)
    assert blocked["decision"]=="blocked"
    assert "p25_no_eligible_active_generation" in blocked["errors"]

    # Model a future valid generation 3 without changing repository state.
    active=json.loads(json.dumps(P25))
    active["state"]="burn_in_active"
    active["generation"]=3
    active["generationState"]="burn_in_active"
    active["currentGenerationEligible"]=True
    active["activatedAt"]="2026-10-02T18:30:00Z"
    active["minimumCompleteAfter"]="2026-10-03T18:30:00Z"
    active["currentEpochFreezeEvidence"]={
      "frozenAt":"2026-10-02T18:30:00Z",
      "migrationVersion":"20261002152739",
      "migrationName":"gomoku_p17_certification_health_isolation",
      "migrationHead":"20261002152739_gomoku_p17_certification_health_isolation",
      "semanticSchemaSha256":"d5c977fc0d74ea6745ac588fc90656dadc18ee0568c3ac248cfd7540ceb6de00",
      "gomokuRoomVersion":45,
      "gomokuRoomSha256":"70e86288e735659c4f0a3c9a2608acf48305ae73afe915fefb22add8f293a2de",
      "cronJobs":11
    }
    write(p25f,active)

    start=datetime.fromisoformat("2026-10-02T18:30:00+00:00")
    offsets=[0.5,2.5,4.5,6.5,8.5,10.5,12.5,14.5,16.5,18.5,20.5,24.3]
    rows=[]
    for i,h in enumerate(offsets):
        t=start+timedelta(hours=h)
        rows.append({"timestamp":t.isoformat().replace("+00:00","Z"),"status":"success","healthy":True,"runId":1000+i})

    good_obs=dict(base_obs);good_obs["observedAt"]="2026-10-03T19:00:00Z"
    write(obs,good_obs);write(samples,{"samples":rows})
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(p25f),"--out",str(cert)])
    good_cert=read(cert)
    assert good_cert["decision"]=="certified"
    assert good_cert["generation"]==3
    assert good_cert["certificateType"]=="p25_active_generation_burnin"
    assert good_cert["successfulSamples"]==12
    assert good_cert["coveredBuckets"]==[0,1,2,3,4,5]
    assert good_cert["terminalSampleAt"] is not None

    clustered=[]
    for i in range(12):
        t=start+timedelta(hours=20,minutes=10*i)
        clustered.append({"timestamp":t.isoformat().replace("+00:00","Z"),"status":"success","healthy":True})
    clustered[-1]["timestamp"]="2026-10-03T18:50:00Z"
    write(samples,{"samples":clustered})
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(p25f),"--out",str(cert)],1)
    assert any(x.startswith("missing_4h_coverage_buckets:") for x in read(cert)["errors"])

    write(samples,{"samples":rows})
    stale=dict(good_obs);stale["gomokuRoomVersion"]=46
    write(obs,stale)
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(p25f),"--out",str(cert)],1)
    assert any(x.startswith("frozen_epoch_changed:") for x in read(cert)["errors"])

    write(obs,good_obs)
    run([sys.executable,str(CERT),str(obs),str(samples),"--p25",str(p25f),"--out",str(cert)])

    state={"promotionStartMainSha":"main-0","currentMainSha":"main-0","phases":[]}
    for item in MANIFEST["phases"]:
        state["phases"].append({
          "phase":item["phase"],"prNumber":item["prNumber"],"branch":item["branch"],
          "headSha":item["expectedHeadSha"],"state":"open","draft":True,
          "readyForMerge":False,"mergeable":True,"syncedToMainSha":"main-0",
          "checks":[{"name":"CI","conclusion":"success"}],
          "merged":False,"preMergeMainSha":None,"mergeCommitSha":None,"postMergeMainSha":None
        })
    st=d/"promotion-state.json";dec=d/"promotion-decision.json"
    write(st,state)
    run([sys.executable,str(PROMO),str(cert),str(st),"--out",str(dec)])
    p=read(dec)
    assert p["decision"]=="ready_to_promote_one"
    assert p["nextPhase"]=="P26"

    bad=json.loads(json.dumps(state))
    bad["phases"][1].update({"merged":True,"preMergeMainSha":"main-0","mergeCommitSha":"m27","postMergeMainSha":"main-x"})
    write(st,bad)
    run([sys.executable,str(PROMO),str(cert),str(st),"--out",str(dec)],1)
    assert any(x.startswith("out_of_order_merged:") for x in read(dec)["errors"])

    complete={"promotionStartMainSha":"main-0","currentMainSha":"main-11","phases":[]}
    receipts=[]
    for i,item in enumerate(MANIFEST["phases"]):
        pre=f"main-{i}";post=f"main-{i+1}"
        complete["phases"].append({
          "phase":item["phase"],"prNumber":item["prNumber"],"branch":item["branch"],
          "headSha":item["expectedHeadSha"],"state":"closed","draft":False,
          "readyForMerge":True,"mergeable":True,"syncedToMainSha":pre,
          "checks":[{"name":"CI","conclusion":"success"}],
          "merged":True,"preMergeMainSha":pre,"mergeCommitSha":f"merge-{item['phase']}","postMergeMainSha":post
        })
        receipts.append({"phase":item["phase"],"prNumber":item["prNumber"],"merged":True,
          "preMergeMainSha":pre,"mergeCommitSha":f"merge-{item['phase']}","postMergeMainSha":post})
    write(st,complete)
    run([sys.executable,str(PROMO),str(cert),str(st),"--out",str(dec)])
    assert read(dec)["decision"]=="stack_complete"

    promotion=d/"promotion-receipts.json";write(promotion,{"receipts":receipts})
    gov=d/"governance.json"
    governance={
      "observedAt":"2026-10-03T20:00:00Z",
      "p32Mode":"warn","p33CanonicalEvidenceActive":True,
      "controlCatalogFrozen":True,"controlCatalogVersion":"2026-10-02.1",
      "evidenceCollectionDryRunPass":True,"criticalOpenDeficiencies":0,
      "p34D006Closed":True,"highDeficienciesDispositionedOrRemediating":True,
      "d001RiskTreatmentActive":True,"usersWithPasswordHash":0,
      "identityProviderCounts":{"google":11}
    }
    write(gov,governance)
    launch=d/"launch.json"
    run([sys.executable,str(LAUNCH),str(cert),str(promotion),str(gov),"--out",str(launch)])
    l=read(launch)
    assert l["decision"]=="launched"
    assert l["oeState"]=="active"
    assert l["periodStart"]=="2026-10-03T20:00:00Z"
    assert l["activationIsRetroactive"] is False

    badgov=dict(governance);badgov["usersWithPasswordHash"]=1
    write(gov,badgov)
    run([sys.executable,str(LAUNCH),str(cert),str(promotion),str(gov),"--out",str(launch)],1)
    assert "password_auth_exposure_present" in read(launch)["errors"]

print("P37 current-generation certification, sequential promotion and OE launch contracts passed.")
