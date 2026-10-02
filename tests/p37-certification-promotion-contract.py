#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CERT=ROOT/"scripts/p37-certify-burnin.py"
PROMO=ROOT/"scripts/p37-evaluate-promotion.py"
LAUNCH=ROOT/"scripts/p37-build-oe-launch.py"
MANIFEST=json.loads((ROOT/"contracts/p37-governance-promotion-manifest.json").read_text())
PLAN=json.loads((ROOT/"platform-p37-certification-promotion-launch-plan.json").read_text())
RISK=json.loads((ROOT/"platform-p37-d001-risk-treatment.json").read_text())

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

def write(path,obj):
    Path(path).write_text(json.dumps(obj),encoding="utf-8")

assert PLAN["state"]=="staged_waiting_p25_generation2"
assert PLAN["p25Generation2"]["minimumSuccessfulSamples"]==12
assert PLAN["p25Generation2"]["minimumCoverageBuckets"]==6
assert PLAN["governancePromotion"]["onePhaseAtATime"] is True
assert PLAN["governancePromotion"]["allowBatchMerge"] is False
assert RISK["liveEvidence"]["usersWithPasswordHash"]==0
assert RISK["liveEvidence"]["identityProviderCounts"]=={"google":11}
assert RISK["permanentClosure"] is False

with tempfile.TemporaryDirectory() as td:
    d=Path(td)
    obs=d/"obs.json"; samples=d/"samples.json"; cert=d/"cert.json"

    base_obs={
      "observedAt":"2026-10-02T15:13:34.929055Z",
      "projectStatus":"ACTIVE_HEALTHY",
      "migrationVersion":"20261002095255",
      "migrationName":"gomoku_p16_certification_null_fix",
      "semanticSchemaSha256":"af9cc4acbed9e61bc81f48642f75b1c2e2841ebdf52a5139f14e784e509aecad",
      "gomokuRoomVersion":42,
      "gomokuRoomSha256":"fc63d31db8a51b860fc45aa7148fc864f8b2622fc469e495123e9a950273687d",
      "cronJobs":11,"activeCronJobs":11,"cronFailures24h":0,"blockingReplicationSlots":0,
      "p18Integrity":"clean","p20SchemaDrift":False,"p21Readiness":"pass","p22Maintenance":"pass",
      "encryptedBackupConclusion":"success","encryptedBackupAfterFinalSharedChange":True,
      "crossAppSmokePassed":True,"edgeInventoryAllActive":True,
      "authHealthy":True,"realtimeHealthy":True,"postgrestHealthy":True,"storageHealthy":True,
      "securityAdvisorsReviewed":True,"performanceAdvisorsReviewed":True,
      "postgres1711HazardCount":0
    }
    write(obs,base_obs); write(samples,{"samples":[]})
    run([sys.executable,str(CERT),str(obs),str(samples),"--out",str(cert)],1)
    blocked=json.loads(cert.read_text())
    assert blocked["decision"]=="blocked"
    assert "minimum_24h_not_reached" in blocked["errors"]
    assert "insufficient_successful_samples" in blocked["errors"]

    # Build 12 successful samples that cover all six 4h buckets plus the terminal point.
    start=datetime.fromisoformat("2026-10-02T14:32:00.744993+00:00")
    offsets=[0.5,2.5,4.5,6.5,8.5,10.5,12.5,14.5,16.5,18.5,20.5,24.3]
    rows=[]
    for i,h in enumerate(offsets):
        t=start+timedelta(hours=h)
        rows.append({
          "timestamp":t.isoformat().replace("+00:00","Z"),
          "status":"success","healthy":True,"runId":1000+i
        })
    good_obs=dict(base_obs);good_obs["observedAt"]="2026-10-03T15:00:00Z"
    write(obs,good_obs);write(samples,{"samples":rows})
    run([sys.executable,str(CERT),str(obs),str(samples),"--out",str(cert)])
    good_cert=json.loads(cert.read_text())
    assert good_cert["decision"]=="certified"
    assert good_cert["successfulSamples"]==12
    assert good_cert["coveredBuckets"]==[0,1,2,3,4,5]
    assert good_cert["terminalSampleAt"] is not None

    # Clustering samples near the end cannot satisfy spanning evidence.
    clustered=[]
    for i in range(12):
        t=start+timedelta(hours=20,minutes=10*i)
        clustered.append({"timestamp":t.isoformat().replace("+00:00","Z"),"status":"success","healthy":True})
    clustered[-1]["timestamp"]="2026-10-03T14:50:00Z"
    write(samples,{"samples":clustered})
    run([sys.executable,str(CERT),str(obs),str(samples),"--out",str(cert)],1)
    assert any(x.startswith("missing_4h_coverage_buckets:") for x in json.loads(cert.read_text())["errors"])

    # Any frozen-epoch change blocks certification.
    write(samples,{"samples":rows})
    stale=dict(good_obs);stale["gomokuRoomVersion"]=43
    write(obs,stale)
    run([sys.executable,str(CERT),str(obs),str(samples),"--out",str(cert)],1)
    assert any(x.startswith("frozen_epoch_changed:") for x in json.loads(cert.read_text())["errors"])

    # Restore good certificate.
    write(obs,good_obs)
    run([sys.executable,str(CERT),str(obs),str(samples),"--out",str(cert)])

    # Promotion starts at P26 and only one candidate may advance.
    state={
      "promotionStartMainSha":"main-0",
      "currentMainSha":"main-0",
      "phases":[]
    }
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
    p=json.loads(dec.read_text())
    assert p["decision"]=="ready_to_promote_one"
    assert p["nextPhase"]=="P26"
    assert p["requiredAction"]=="mark_ready_then_squash_merge"

    # A later merged phase before P26 is rejected.
    bad=json.loads(json.dumps(state))
    bad["phases"][1]["merged"]=True
    bad["phases"][1]["preMergeMainSha"]="main-0"
    bad["phases"][1]["mergeCommitSha"]="m27"
    bad["phases"][1]["postMergeMainSha"]="main-x"
    write(st,bad)
    run([sys.executable,str(PROMO),str(cert),str(st),"--out",str(dec)],1)
    assert any(x.startswith("out_of_order_merged:") for x in json.loads(dec.read_text())["errors"])

    # Walk P26 as merged and verify P27 becomes the only candidate after sync.
    step=json.loads(json.dumps(state))
    step["phases"][0].update({"merged":True,"preMergeMainSha":"main-0","mergeCommitSha":"m26","postMergeMainSha":"main-1"})
    step["currentMainSha"]="main-1"
    step["phases"][1]["syncedToMainSha"]="main-1"
    write(st,step)
    run([sys.executable,str(PROMO),str(cert),str(st),"--out",str(dec)])
    assert json.loads(dec.read_text())["nextPhase"]=="P27"

    # Complete promotion state.
    complete={"promotionStartMainSha":"main-0","currentMainSha":"main-11","phases":[]}
    receipts=[]
    for i,item in enumerate(MANIFEST["phases"]):
        pre=f"main-{i}"
        post=f"main-{i+1}"
        complete["phases"].append({
          "phase":item["phase"],"prNumber":item["prNumber"],"branch":item["branch"],
          "headSha":item["expectedHeadSha"],"state":"closed","draft":False,
          "readyForMerge":True,"mergeable":True,"syncedToMainSha":pre,
          "checks":[{"name":"CI","conclusion":"success"}],
          "merged":True,"preMergeMainSha":pre,"mergeCommitSha":f"merge-{item['phase']}","postMergeMainSha":post
        })
        receipts.append({
          "phase":item["phase"],"prNumber":item["prNumber"],"merged":True,
          "preMergeMainSha":pre,"mergeCommitSha":f"merge-{item['phase']}","postMergeMainSha":post
        })
    write(st,complete)
    run([sys.executable,str(PROMO),str(cert),str(st),"--out",str(dec)])
    assert json.loads(dec.read_text())["decision"]=="stack_complete"

    promotion=d/"promotion-receipts.json";write(promotion,{"receipts":receipts})
    gov=d/"governance.json"
    governance={
      "observedAt":"2026-10-03T18:00:00Z",
      "p32Mode":"warn",
      "p33CanonicalEvidenceActive":True,
      "controlCatalogFrozen":True,
      "controlCatalogVersion":"2026-10-02.1",
      "evidenceCollectionDryRunPass":True,
      "criticalOpenDeficiencies":0,
      "p34D006Closed":True,
      "highDeficienciesDispositionedOrRemediating":True,
      "d001RiskTreatmentActive":True,
      "usersWithPasswordHash":0,
      "identityProviderCounts":{"google":11}
    }
    write(gov,governance)
    launch=d/"launch.json"
    run([sys.executable,str(LAUNCH),str(cert),str(promotion),str(gov),"--out",str(launch)])
    l=json.loads(launch.read_text())
    assert l["decision"]=="launched"
    assert l["oeState"]=="active"
    assert l["periodStart"]=="2026-10-03T18:00:00Z"
    assert l["activationIsRetroactive"] is False
    assert l["externalAttestation"] is False

    # Password-auth exposure immediately invalidates the temporary D001 treatment.
    badgov=dict(governance);badgov["usersWithPasswordHash"]=1
    write(gov,badgov)
    run([sys.executable,str(LAUNCH),str(cert),str(promotion),str(gov),"--out",str(launch)],1)
    assert "password_auth_exposure_present" in json.loads(launch.read_text())["errors"]

print("P37 burn-in certification, sequential promotion and OE launch contracts passed.")
