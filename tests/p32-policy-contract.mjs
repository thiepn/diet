import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p32-change-admission-plan.json','utf8'));
const bundle=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const releases=JSON.parse(fs.readFileSync('platform-p31-release-registry.json','utf8'));
const graph=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const schema=JSON.parse(fs.readFileSync('contracts/p32-change-manifest.schema.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P32-POLICY-AS-CODE-ADMISSION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p32-change-admission-warn.yml','utf8');

assert.equal(plan.phase,'P32');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.sourceMainSha,'fd0f541fef82539c75ce3c4b429a222b4a20663f');
assert.equal(plan.currentMode,'warn');
assert.equal(plan.operatorOverride.enabled,true);
assert.equal(plan.operatorOverride.doesNotAuthorizePolicySelfEnforcement,true);
assert.equal(plan.liveBaseline.projectStatus,'ACTIVE_HEALTHY');
assert.equal(plan.liveBaseline.migrationHead,'20261003105645');
assert.equal(plan.liveBaseline.gomokuRoomVersion,48);
assert.equal(plan.liveBaseline.cronJobs,14);
assert.equal(plan.liveBaseline.registeredApps,7);
assert.deepEqual(plan.liveBaseline.unmodeledComponents,['semester-os']);
assert.equal(plan.liveBaseline.releaseEpochState,'moving');
assert.equal(plan.fleetGuardrails.localSupabaseEphemeralAllowedForStatefulValidation,true);
assert.equal(plan.automation.mergeBlockingAllowedInCurrentMode,false);
assert.equal(plan.automation.productionPromotionAllowed,false);
assert.equal(plan.automation.productionMutationAllowed,false);

assert.equal(bundle.phase,'P32');
assert.equal(bundle.schemaVersion,2);
assert.equal(bundle.bundleVersion,'2026-10-03.2');
assert.equal(bundle.mode,'warn');
assert.equal(bundle.defaultDecision,'block');
assert.equal(bundle.fleetRegistryVersion,'2026-10-03.2');
assert.equal(bundle.releaseRegistryVersion,'2026-10-03.2');
assert.equal(bundle.dependencyGraphVersion,'2026-10-03.1');
assert.equal(bundle.policies.length,23);
assert.equal(bundle.nonWaivablePolicyIds.length,21);
assert.equal(bundle.exceptionPolicy.maximumLifetimeHours,168);
assert.equal(bundle.exceptionPolicy.selfApprovalAllowed,false);
assert.equal(bundle.modePolicy.blocksMerge,false);
assert.equal(bundle.modePolicy.automaticModePromotion,false);
for(const id of ['P32-SEC-001','P32-SEC-002','P32-SEC-003','P32-PROD-001','P32-DATA-001','P32-POLICY-001']){
  assert.ok(bundle.nonWaivablePolicyIds.includes(id),id+' must be non-waivable');
}

assert.equal(fleet.registryVersion,'2026-10-03.2');
assert.equal(fleet.releaseSafety,'amber');
assert.equal(fleet.releaseEpoch.edgeHighlights.gomokuRoom.version,48);
assert.equal(fleet.coverage.registeredAppsObserved,7);
assert.equal(fleet.coverage.registeredAppsGoverned,6);
assert.equal(fleet.components.find(x=>x.id==='semester-os').governance,'observed_unmodeled');
assert.equal(releases.latestMergedGovernancePhase,'P30');
assert.equal(graph.nodes.length,17);
assert.equal(app.operationsVersion,'P25.0');

for(const key of [
  'policyBundleVersion','fleetRegistryVersion','releaseRegistryVersion',
  'changeId','requester','owner','components','changeClass','requiredTrainType','now'
]) assert.ok(schema.required.includes(key),'P32 schema missing '+key);

for(const token of [
  'active by explicit operator override','Current mode: **warn**',
  'Production health remains **green**','Release safety remains **amber**',
  'semester-os','observed but unmodeled','v48',
  '94.44%','85.71%','non-waivable','168 hours',
  'local_supabase_ephemeral','admit','block','escalate',
  'does not grant production approval'
]) assert.ok(doc.includes(token),'P32 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('warn'));
assert.ok(workflow.includes('p32-admission-decision.json'));
assert.doesNotMatch(workflow,/--fail-on-non-admit/,'P32 warn workflow must remain non-blocking.');
assert.ok(workflow.includes('tests/p32-admission-contract.py'));

console.log('P32 policy bundle/warn-mode structural contract passed.');
