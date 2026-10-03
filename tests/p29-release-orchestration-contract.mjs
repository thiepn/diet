import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p29-release-orchestration-plan.json','utf8'));
const graph=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P29-RELEASE-ORCHESTRATION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p29-release-staging.yml','utf8');

assert.equal(plan.phase,'P29');
assert.equal(plan.state,'staged_pending_p28');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p26Certification,'complete');
assert.equal(plan.activationRequires.p27Certification,'complete');
assert.equal(plan.activationRequires.p28Certification,'complete');
assert.equal(plan.activationRequires.dependencyGraphCoveragePct,100);
assert.equal(plan.activationRequires.compatibilityCertificatesRequiredForAllAffectedConsumers,true);

assert.equal(plan.currentReleaseInterruption.detected,true);
assert.equal(plan.currentReleaseInterruption.p25BurnInStillCertifiable,false);
assert.equal(plan.currentReleaseInterruption.latestMigration,'20261001142949_gomoku_p9_competitive_operations');
assert.equal(plan.currentReleaseInterruption.gomokuRoomVersion,30);
assert.equal(plan.currentReleaseInterruption.cronJobs,9);

assert.equal(graph.phase,'P29');
assert.equal(graph.nodes.length,17);
assert.ok(graph.edges.length>=35);
const nodeIds=new Set(graph.nodes.map(n=>n.id));
for(const e of graph.edges){
  assert.ok(nodeIds.has(e.consumer),'Unknown consumer '+e.consumer);
  assert.ok(nodeIds.has(e.provider),'Unknown provider '+e.provider);
  assert.ok(e.contract);
  assert.ok(['hard','soft'].includes(e.strength));
}
assert.ok(graph.edges.some(e=>e.consumer==='gomoku'&&e.provider==='account'));
assert.ok(graph.edges.some(e=>e.consumer==='gomoku'&&e.provider==='leaderboard'));
assert.ok(graph.edges.some(e=>e.consumer==='gomoku'&&e.provider==='realtime'));
assert.ok(graph.edges.some(e=>e.consumer==='wordstrike'&&e.provider==='leaderboard'));
assert.equal(graph.resourceOwners.cronJobs['gomoku-p9-competition-tick'],'gomoku');
assert.equal(graph.liveBaseline.gomokuRoomEdge.version,30);
assert.equal(graph.liveBaseline.p24HistoricalPostUpgradeValidator,'fail_after_later_shared_changes');

assert.equal(plan.releaseProtocol.default,'expand_migrate_contract');
assert.equal(plan.quietWindowPolicy.certificationWindowMinutes,60);
assert.equal(plan.quietWindowPolicy.anySharedProviderChangeRestartsCertificationWindow,true);
assert.ok(plan.certificationPolicy.invalidationTriggers.includes('new database migration'));
assert.ok(plan.certificationPolicy.invalidationTriggers.includes('dependency graph version change'));

for(const token of [
  'P29 is **staged, not active**',
  'existing P25 burn-in is **not certifiable**',
  'expand → migrate → contract',
  'W0 — Freeze baseline',
  'Certificate invalidation',
  'Gomoku → Account grants/connections',
  'Gomoku → Leaderboard profiles',
  'Gomoku → Realtime'
]) assert.ok(doc.includes(token),'P29 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P29 staging workflow must remain manual-only.');
assert.ok(workflow.includes('p29-orchestration-contract.py'));

console.log('P29 staged release-orchestration contract passed.');
