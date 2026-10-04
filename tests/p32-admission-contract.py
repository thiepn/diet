#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"scripts/p32-admit-change.py"

VERSIONS={
  "policyBundleVersion":"2026-10-04.6",
  "fleetRegistryVersion":"2026-10-04.6",
  "releaseRegistryVersion":"2026-10-04.2"
}

def run(manifest,fail=False):
    with tempfile.TemporaryDirectory() as td:
        d=Path(td); mp=d/"manifest.json"; op=d/"decision.json"
        mp.write_text(json.dumps(manifest),encoding="utf-8")
        cmd=[sys.executable,str(ENGINE),str(mp),"--out",str(op)]
        if fail: cmd.append("--fail-on-non-admit")
        p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
        if fail:
            assert p.returncode==1,(p.returncode,p.stdout,p.stderr)
        else:
            assert p.returncode==0,(p.returncode,p.stdout,p.stderr)
        return json.loads(op.read_text(encoding="utf-8"))

def base(**overrides):
    m={
      "changeId":"notes-ui-001",
      "requester":"developer-a",
      "owner":"thiepn",
      "components":["notes"],
      "changeClass":"consumer_only",
      "scopes":["app:notes"],
      "resources":[],
      "mutationTypes":["static_frontend"],
      "targetEnvironment":"ci",
      "riskSignals":{},
      "requestedPaidResources":[],
      "productionMutationRequested":False,
      "p29ImpactComplete":True,
      "requiredTrainType":"app_fast",
      "affectedConsumers":[],
      "files":["notes/ui.js"],
      "humanApprovals":{},
      "integrationEnvironment":{"kind":"logical","status":"healthy"},
      "intent":"feature",
      "now":"2026-10-03T12:30:00Z",
      "exceptions":[],
      **VERSIONS
    }
    m.update(overrides)
    return m

r=run(base())
assert r["decision"]=="admit"
assert r["mode"]=="warn"
assert r["mergeBlockedByP32"] is False
assert r["productionApproved"] is False
assert len(r["admissionReceiptId"])==64

r=run(base(changeId="semester-ui-001",components=["semester-os"],scopes=["app:semester-os"],files=["semester/ui.js"]))
assert r["decision"]=="admit"
assert "P32-OWN-001" not in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(changeId="gomoku-ui-001",components=["gomoku"],scopes=["app:gomoku","edge:gomoku-room"],files=["gomoku/ui.js"]))
assert r["decision"]=="admit"
assert "P32-SCOPE-001" not in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(
  changeId="notes-schema-001",
  changeClass="data_migration_no_contract",
  scopes=["app:notes","database_schema"],
  mutationTypes=["database_schema"],
  requiredTrainType="shared_standard",
  integrationEnvironment={"kind":"local_supabase_ephemeral","status":"available_on_demand"}
))
ids={x["policyId"] for x in r["effectiveFindings"]}
assert r["decision"]=="block"
assert "P32-FLEET-001" not in ids
assert "P32-EPOCH-001" in ids
assert "P32-ENV-001" not in ids

r=run(base(
  changeId="notes-hosted-001",
  changeClass="data_migration_no_contract",
  scopes=["app:notes","database_schema","environment:hosted_preview"],
  mutationTypes=["database_schema"],
  requiredTrainType="shared_standard",
  integrationEnvironment={"kind":"supabase_branch","status":"healthy"}
))
assert "P32-ENV-002" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(fleetRegistryVersion="old"))
assert r["decision"]=="block"
assert "P32-REG-001" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(requestedPaidResources=["isolated_supabase_project"]))
assert r["decision"]=="escalate"
assert "P32-COST-001" in {x["policyId"] for x in r["effectiveFindings"]}
r=run(base(requestedPaidResources=["isolated_supabase_project"],humanApprovals={"cost":True}))
assert r["decision"]=="admit"

r=run(base(targetEnvironment="production",productionMutationRequested=True,humanApprovals={"production":True}))
assert r["decision"]=="escalate"
assert "P32-PROD-001" in {x["policyId"] for x in r["effectiveFindings"]}
assert r["productionApproved"] is False

r=run(base(mutationTypes=["delete_user_data"]))
assert r["decision"]=="escalate"
assert "P32-DATA-001" in {x["policyId"] for x in r["effectiveFindings"]}

security_cases=[
  ({"serviceRoleInClient":True},"P32-SEC-001"),
  ({"userEditableMetadataAuthorization":True},"P32-SEC-002"),
  ({"newDataApiTableOrView":True,"rlsEnabled":False},"P32-SEC-003"),
  ({"newPublicFunction":True,"executePrivilegeDecision":False},"P32-SEC-004"),
  ({"securityDefinerFunction":True,"callableRolesRestricted":False,"authorizationDesignDeclared":True},"P32-SEC-004"),
  ({"newPublicDataApiObject":True,"explicitExposureDecision":False},"P32-SEC-005")
]
for signal,pid in security_cases:
    r=run(base(riskSignals=signal))
    assert r["decision"]=="block",(signal,r)
    assert pid in {x["policyId"] for x in r["effectiveFindings"]}

waiver={
  "id":"exc-supply-1","policyIds":["P32-SUPPLY-001"],"owner":"thiepn",
  "approver":"reviewer-b","reason":"temporary migration action compatibility",
  "reference":"issue-123","createdAt":"2026-10-03T12:00:00Z",
  "expiresAt":"2026-10-03T13:00:00Z","scopes":["app:notes"]
}
r=run(base(riskSignals={"unpinnedProductionAction":True},exceptions=[waiver]))
assert r["decision"]=="admit"
assert any(x["exceptionId"]=="exc-supply-1" for x in r["waivedFindings"])

expired=dict(waiver)
expired["id"]="exc-expired"; expired["expiresAt"]="2026-10-03T12:15:00Z"
r=run(base(riskSignals={"unpinnedProductionAction":True},exceptions=[expired]))
assert r["decision"]=="block"
assert "exc-expired" in r["expiredExceptions"]
assert "P32-SUPPLY-001" in {x["policyId"] for x in r["effectiveFindings"]}

bad_nonwaivable=dict(waiver)
bad_nonwaivable["id"]="exc-secret"; bad_nonwaivable["policyIds"]=["P32-SEC-001"]
r=run(base(riskSignals={"serviceRoleInClient":True},exceptions=[bad_nonwaivable]))
ids={x["policyId"] for x in r["effectiveFindings"]}
assert r["decision"]=="block"
assert "P32-SEC-001" in ids
assert "P32-EXC-001" in ids

wild=dict(waiver); wild["id"]="exc-wild"; wild["policyIds"]=["*"]
r=run(base(riskSignals={"unpinnedProductionAction":True},exceptions=[wild]))
assert "P32-EXC-001" in {x["policyId"] for x in r["effectiveFindings"]}
self_exc=dict(waiver); self_exc["id"]="exc-self"; self_exc["approver"]="thiepn"
r=run(base(riskSignals={"unpinnedProductionAction":True},exceptions=[self_exc]))
assert "P32-EXC-001" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(
  changeId="leaderboard-breaking-001",
  owner="leaderboard",components=["leaderboard"],scopes=["app:leaderboard"],
  changeClass="provider_breaking",mutationTypes=["shared_edge_contract"],
  requiredTrainType="coordinated_breaking",
  p29ImpactComplete=False,affectedConsumers=["wordstrike"],
  integrationEnvironment={"kind":"local_supabase_ephemeral","status":"available_on_demand"}
))
assert "P32-COMPAT-001" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(
  changeId="leaderboard-additive-001",
  owner="leaderboard",components=["leaderboard"],scopes=["app:leaderboard"],
  changeClass="provider_additive",mutationTypes=["shared_edge_contract"],
  requiredTrainType="app_fast"
))
assert "P32-TRAIN-001" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(
  changeId="p32-policy-edit",
  owner="platform",components=["platform_control"],scopes=["platform_control"],
  files=["platform-p32-policy-bundle.json"],
  riskSignals={"policySelfModification":True}
))
assert r["decision"]=="escalate"
assert "P32-POLICY-001" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(
  claimsP31Eligible=True,candidateId="candidate-x",
  p31Decision={"decision":"block","candidateId":"candidate-x","scopes":["app:notes"]}
))
assert r["decision"]=="block"
assert "P32-P31-001" in {x["policyId"] for x in r["effectiveFindings"]}

r=run(base(riskSignals={"serviceRoleInClient":True}),fail=True)
assert r["decision"]=="block"
assert r["mergeBlockedByP32"] is False

r1=run(base(changeId="hash-a"))
r2=run(base(changeId="hash-b"))
assert r1["policyBundleSha256"]==r2["policyBundleSha256"]
assert len(r1["policyBundleSha256"])==64
assert r1["manifestSha256"]!=r2["manifestSha256"]
assert r1["admissionReceiptId"]!=r2["admissionReceiptId"]

print("P32 policy admission, exceptions, security and fleet-guardrail contracts passed.")
