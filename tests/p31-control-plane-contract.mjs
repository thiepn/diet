import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p31-control-plane-plan.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const releases=JSON.parse(fs.readFileSync('platform-p31-release-registry.json','utf8'));
const graph=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const schema=JSON.parse(fs.readFileSync('contracts/p31-release-intent.schema.json','utf8'));
const doc=fs.readFileSync('docs/P31-CONTROL-PLANE-RELEASE-REGISTRY.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p31-control-plane-staging.yml','utf8');

assert.equal(plan.phase,'P31');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.sourceMainSha,'dd35a66826471b4cd94c1b9e8ead90be18dc1dc5');
assert.equal(plan.operatorOverride.enabled,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeProductionPromotion,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeProductionMutation,true);
assert.equal(plan.currentControlPlane.productionHealth,'green');
assert.equal(plan.currentControlPlane.releaseSafety,'amber');
assert.equal(plan.currentControlPlane.coordinationMode,'registry_and_epoch_drift');
assert.equal(plan.automation.productionPromotionAllowed,false);
assert.equal(plan.automation.productionMutationAllowed,false);
assert.equal(plan.automation.paidProvisioningAllowed,false);

assert.equal(fleet.phase,'P31');
assert.equal(fleet.registryVersion,'2026-10-04.3');
assert.equal(fleet.canonicalProject.serviceStatus,'ACTIVE_HEALTHY');
assert.equal(fleet.productionHealth,'green');
assert.equal(fleet.releaseSafety,'amber');
assert.equal(fleet.releaseEpoch.migrationHead,'20261004173117');
assert.equal(fleet.releaseEpoch.cronJobs,14);
assert.equal(fleet.releaseEpoch.edgeFunctionCount,12);
assert.equal(fleet.releaseEpoch.edgeHighlights.gomokuRoom.version,50);
assert.equal(fleet.releaseEpoch.edgeHighlights.microArcadeBackup.version,2);
assert.equal(fleet.releaseEpoch.state,'refreeze_pending_generation5_candidate_revision2');
assert.equal(fleet.components.length,18);
assert.equal(fleet.coverage.registeredAppsObserved,7);
assert.equal(fleet.coverage.registeredAppsGoverned,7);
assert.equal(fleet.coverage.dependencyGraphCoveragePct,100);
const semester=fleet.components.find(x=>x.id==='semester-os');
assert.equal(semester.governance,'governed');
assert.equal(semester.route,'/semester/');
assert.ok(!fleet.observedDrift.some(x=>x.id==='p29-graph-missing-semester-os'));
assert.ok(!fleet.observedDrift.some(x=>x.id==='gomoku-edge-moved-since-p30'));
assert.equal(fleet.governanceUnresolvedResources.length,0);

const governedIds=new Set(fleet.components.filter(x=>x.governance==='governed').map(x=>x.id));
const graphIds=new Set(graph.nodes.map(x=>x.id));
assert.deepEqual([...governedIds].sort(),[...graphIds].sort());
assert.equal(graph.nodes.length,18);

assert.equal(releases.phase,'P31');
assert.equal(releases.registryVersion,'2026-10-04.2');
assert.equal(releases.publishedOperationsVersion,'P25.0');
assert.equal(releases.latestMergedGovernancePhase,'P36');
assert.equal(releases.latestMergedMainSha,'c8c374917d739c971fe142cf16c3449d6c64e8cd');
assert.deepEqual(releases.phases.map(x=>x.id),['P26','P27','P28','P29','P30','P31','P32','P33','P34','P35','P36']);
for(const p of releases.phases){
  assert.ok(p.state.startsWith('merged_'));
  assert.match(p.mergeSha,/^[0-9a-f]{40}$/);
}
assert.equal(releases.invariants.manualProductionApprovalRequired,true);
assert.equal(releases.invariants.unmodeledComponentCannotSelfAuthorize,true);

for(const key of [
  'candidateId','fleetRegistryVersion','releaseRegistryVersion',
  'p29CertificateStatus','p30PromotionStatus','targetStage'
]) assert.ok(schema.required.includes(key),'P31 intent schema missing '+key);

for(const token of [
  'active by explicit operator override','Production health: **green**',
  'Release safety: **amber**','semester-os','`gomoku-room` is now **v48**',
  '100%','7/7','governed',
  'expired leases remain evidence','does not promote production'
]) assert.ok(doc.includes(token),'P31 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P31 control-plane workflow must remain manual-only.');
assert.ok(workflow.includes('p31-control-plane-contract.py'));
assert.ok(workflow.includes('p31-control-plane.py validate'));

console.log('P31 fleet registry/control-plane structural contract passed.');
