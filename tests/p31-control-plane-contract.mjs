import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p31-control-plane-plan.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const releases=JSON.parse(fs.readFileSync('platform-p31-release-registry.json','utf8'));
const graph=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P31-CONTROL-PLANE-RELEASE-REGISTRY.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p31-control-plane-staging.yml','utf8');

assert.equal(plan.phase,'P31');
assert.equal(plan.state,'staged_pending_p30');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p26Certification,'complete');
assert.equal(plan.activationRequires.p27Certification,'complete');
assert.equal(plan.activationRequires.p28Certification,'complete');
assert.equal(plan.activationRequires.p29Certification,'complete');
assert.equal(plan.activationRequires.p30Certification,'complete');

assert.equal(plan.currentFleetState,'amber');
assert.equal(plan.currentCoordinationMode,'epoch_moving');
assert.equal(plan.lockPolicy.noAutomaticLockStealing,true);
assert.equal(plan.reconciliationPolicy.neverSilentlyRewriteDesiredStateFromProduction,true);
assert.equal(plan.controlPlaneActions.requireHumanApproval.includes('production promotion'),true);

assert.equal(fleet.phase,'P31');
assert.equal(fleet.controlPlaneStatus,'amber');
assert.equal(fleet.releaseEpoch.state,'moving');
assert.equal(fleet.releaseEpoch.migrationHead,'20261001154723_gomoku_p11_social_cron');
assert.equal(fleet.releaseEpoch.edge.gomokuRoom.version,35);
assert.equal(fleet.releaseEpoch.cronJobs,10);
assert.equal(fleet.releaseEpoch.sharedPromotionsBlocked,true);
assert.equal(fleet.components.length,17);
assert.ok(fleet.observedBlocks.some(x=>x.id==='shared-epoch-moving'));
assert.ok(fleet.observedBlocks.some(x=>x.id==='supabase-main-branch-action-failed'));
assert.ok(fleet.governanceUnresolved.some(x=>x.id==='public.change_log'));

const fleetIds=new Set(fleet.components.map(x=>x.id));
const graphIds=new Set(graph.nodes.map(x=>x.id));
assert.deepEqual([...fleetIds].sort(),[...graphIds].sort());

assert.equal(releases.phase,'P31');
assert.equal(releases.activeOperationsRelease,'P25.0');
assert.equal(releases.activePhase.id,'P25');
assert.equal(releases.activePhase.state,'restart_required');
assert.equal(releases.stagedPhases.length,6);
assert.deepEqual(releases.stagedPhases.map(x=>x.id),['P26','P27','P28','P29','P30','P31']);
assert.equal(releases.invariants.manualProductionApprovalRequired,true);
assert.equal(releases.invariants.liveProductionObservationOverridesStaleRegistryFacts,true);

for(const token of [
  'P31 is **staged, not active**',
  'Current control-plane state: **amber**',
  'gomoku_p11_social_cron',
  'v35',
  'app_fast',
  'shared-epoch-moving',
  'expired locks remain evidence',
  'It may not autonomously'
]) assert.ok(doc.includes(token),'P31 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P31 staging workflow must remain manual-only.');
assert.ok(workflow.includes('p31-control-plane-contract.py'));

console.log('P31 staged control-plane/release-registry contract passed.');
