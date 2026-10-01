import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p32-change-admission-plan.json','utf8'));
const bundle=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P32-POLICY-AS-CODE-ADMISSION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p32-change-admission-shadow.yml','utf8');

assert.equal(plan.phase,'P32');
assert.equal(plan.state,'staged_pending_p31');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(plan.currentMode,'shadow');
assert.equal(plan.activationRequires.p31Certification,'complete');
assert.equal(plan.activationRequires.p31ReleaseEpochStable,true);
assert.equal(plan.fleetGuardrails.noSharedAdmissionDuringMovingEpoch,true);
assert.equal(plan.fleetGuardrails.directProductionMutationNeverAutoAdmits,true);
assert.equal(plan.fleetGuardrails.policyEngineCannotGrantProductionApproval,true);

assert.equal(bundle.phase,'P32');
assert.equal(bundle.mode,'shadow');
assert.equal(bundle.defaultDecision,'block');
assert.ok(bundle.policies.length>=18);
assert.equal(bundle.shadowMode.blocksMerge,false);
assert.equal(bundle.exceptionPolicy.maximumLifetimeHours,168);
assert.equal(bundle.exceptionPolicy.selfApprovalAllowed,false);
assert.ok(bundle.nonWaivablePolicyIds.includes('P32-SEC-001'));
assert.ok(bundle.nonWaivablePolicyIds.includes('P32-DATA-001'));
assert.ok(bundle.nonWaivablePolicyIds.includes('P32-PROD-001'));
assert.equal(bundle.liveBaseline.releaseEpochState,'moving');
assert.equal(bundle.liveBaseline.migrationHead,'20261001162929_gomoku_p12_moderation_review');
assert.equal(bundle.liveBaseline.gomokuRoomVersion,38);
assert.equal(bundle.liveBaseline.p31SnapshotSuperseded,true);

assert.equal(fleet.releaseEpoch.state,'moving');

for(const token of [
  'P32 is **staged, not active**',
  'shadow mode',
  'admit',
  'block',
  'escalate',
  'non-waivable',
  'Gomoku P12',
  'v38',
  'entry into the governed release flow',
  'cannot grant production approval'
]) assert.ok(doc.includes(token),'P32 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('shadow'));
assert.doesNotMatch(workflow,/--fail-on-block/,'Shadow workflow must not block merges.');
assert.ok(workflow.includes('p32-admission-decision.json'));

console.log('P32 staged policy-as-code contract passed.');
