#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"scripts/p32-admit-change.py"

def base(**overrides):
    m={
      "changeId":"test-change",
      "requester":"test",
      "owner":"notes",
      "components":["notes"],
      "changeClass":"consumer_only",
      "scopes":["app:notes"],
      "resources":[],
      "mutationTypes":["frontend_code"],
      "targetEnvironment":"ci",
      "riskSignals":{},
      "requestedPaidResources":[],
      "productionMutationRequested":False,
      "p29ImpactComplete":True,
      "requiredTrainType":"app_fast",
      "affectedConsumers":[],
      "files":["notes/app.js"],
      "humanApprovals":{},
      "integrationEnvironment":{"kind":"logical","status":"healthy"},
      "intent":"feature",
      "now":"2026-10-01T18:30:00Z",
      "exceptions":[]
    }
    m.update(overrides)
    return m

def decide(manifest,fail_on_block=False):
    with tempfile.TemporaryDirectory() as d:
        inp=Path(d)/"manifest.json"; out=Path(d)/"decision.json"
        inp.write_text(json.dumps(manifest),encoding="utf-8")
        cmd=[sys.executable,str(ENGINE),str(inp),"--out",str(out)]
        if fail_on_block:
            cmd.append("--fail-on-block")
        p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
        result=json.loads(out.read_text(encoding="utf-8"))
        return p,result

# Unrelated app-fast can be admitted even though shared epoch is moving.
p,r=decide(base())
assert p.returncode==0
assert r["decision"]=="admit"
assert r["productionApproved"] is False
assert r["admissionMeaning"]=="entry_to_governed_release_flow_only"

# Shared/stateful change blocks on moving epoch and missing isolated preview.
m=base(
  changeId="gomoku-shared",
  owner="gomoku",components=["gomoku"],changeClass="provider_additive",
  scopes=["app:gomoku","database_schema","edge:gomoku-room"],
  mutationTypes=["database_schema","shared_edge_contract"],
  requiredTrainType="shared_standard",
  integrationEnvironment={"kind":"logical","status":"healthy"}
)
p,r=decide(m,True)
assert p.returncode==1
ids={x["policyId"] for x in r["effectiveFindings"]}
assert "P32-EPOCH-001" in ids
assert "P32-ENV-001" in ids

# Existing MIGRATIONS_FAILED branch is independently blocked.
m["integrationEnvironment"]={"kind":"supabase_branch","status":"healthy","branchActionStatus":"MIGRATIONS_FAILED"}
p,r=decide(m,True)
ids={x["policyId"] for x in r["effectiveFindings"]}
assert "P32-ENV-002" in ids

# Unresolved governance resource blocks.
p,r=decide(base(resources=["public.change_log"]),True)
assert r["decision"]=="block"
assert "P32-GOV-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Secret/service-role exposure cannot be waived.
nonwaivable_exception={
  "id":"exc-secret","policyIds":["P32-SEC-001"],"owner":"notes","approver":"platform",
  "reason":"test","reference":"TEST-1",
  "createdAt":"2026-10-01T18:00:00Z","expiresAt":"2026-10-02T18:00:00Z",
  "scopes":["app:notes"]
}
p,r=decide(base(
  riskSignals={"serviceRoleInClient":True},
  exceptions=[nonwaivable_exception]
),True)
assert r["decision"]=="block"
assert "P32-SEC-001" in {x["policyId"] for x in r["effectiveFindings"]}
assert "P32-SEC-001" not in r["waivedPolicyIds"]
assert r["invalidExceptions"]

# Missing RLS blocks.
p,r=decide(base(
  mutationTypes=["database_schema"],
  riskSignals={"newExposedTable":True,"rlsEnabled":False},
  requiredTrainType="shared_standard",
  integrationEnvironment={"kind":"supabase_branch","status":"healthy","branchActionStatus":"READY"}
),True)
assert "P32-SEC-003" in {x["policyId"] for x in r["effectiveFindings"]}

# Waivable deprecated auth.role policy can be waived with a short independent exception.
valid_exception={
  "id":"exc-auth-role","policyIds":["P32-SEC-005"],"owner":"notes","approver":"platform",
  "reason":"legacy compatibility during short migration","reference":"MIG-42",
  "createdAt":"2026-10-01T18:00:00Z","expiresAt":"2026-10-03T18:00:00Z",
  "scopes":["app:notes"]
}
p,r=decide(base(
  riskSignals={"deprecatedAuthRole":True},
  exceptions=[valid_exception]
))
assert r["decision"]=="admit"
assert "P32-SEC-005" in r["waivedPolicyIds"]

# Expired waiver does not apply and itself creates an exception-policy finding.
expired=dict(valid_exception)
expired["id"]="exc-expired"
expired["expiresAt"]="2026-10-01T18:15:00Z"
p,r=decide(base(riskSignals={"deprecatedAuthRole":True},exceptions=[expired]),True)
assert r["decision"]=="block"
assert "P32-SEC-005" in {x["policyId"] for x in r["effectiveFindings"]}
assert "P32-EXC-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Paid resource request escalates instead of auto-admitting.
p,r=decide(base(requestedPaidResources=["supabase_preview_branch"]))
assert r["decision"]=="escalate"
assert "P32-COST-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Production mutation is never auto-approved by the engine.
p,r=decide(base(
  targetEnvironment="production",
  productionMutationRequested=True,
  humanApprovals={"production":True}
))
assert r["decision"]=="escalate"
assert r["productionApproved"] is False
assert "P32-PROD-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Destructive data action escalates and cannot be waived.
p,r=decide(base(mutationTypes=["delete_user_data"]))
assert r["decision"]=="escalate"
assert "P32-DATA-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Breaking provider requires all transitive consumers and P29 impact evidence.
p,r=decide(base(
  changeId="leaderboard-breaking",
  owner="leaderboard",components=["leaderboard"],changeClass="provider_breaking",
  scopes=["app:leaderboard"],mutationTypes=["shared_edge_contract"],
  requiredTrainType="coordinated_breaking",
  p29ImpactComplete=False,
  affectedConsumers=["wordstrike"],
  integrationEnvironment={"kind":"supabase_branch","status":"healthy","branchActionStatus":"READY"}
),True)
assert "P32-COMPAT-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Shared change routed to app_fast is rejected.
p,r=decide(base(
  owner="leaderboard",components=["leaderboard"],changeClass="provider_additive",
  mutationTypes=["shared_edge_contract"],requiredTrainType="app_fast",
  integrationEnvironment={"kind":"supabase_branch","status":"healthy","branchActionStatus":"READY"}
),True)
assert "P32-TRAIN-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Policy engine cannot self-approve its own change.
p,r=decide(base(
  owner="platform",components=["platform_control"],
  files=["platform-p32-policy-bundle.json"],
  riskSignals={"policySelfModification":True}
))
assert r["decision"]=="escalate"
assert "P32-POLICY-001" in {x["policyId"] for x in r["effectiveFindings"]}

# Bundle hash is deterministic across repeated evaluations.
_,r1=decide(base(changeId="hash-1"))
_,r2=decide(base(changeId="hash-2"))
assert r1["policyBundleSha256"]==r2["policyBundleSha256"]
assert len(r1["policyBundleSha256"])==64

print("P32 policy admission, exception and non-waivable guardrail contracts passed.")
