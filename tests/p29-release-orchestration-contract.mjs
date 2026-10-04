import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const plan=JSON.parse(fs.readFileSync('platform-p29-release-orchestration-plan.json','utf8'));
const graph=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const ownership=JSON.parse(fs.readFileSync('platform-p28-resource-ownership.json','utf8'));
const doc=fs.readFileSync('docs/P29-RELEASE-ORCHESTRATION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p29-release-staging.yml','utf8');
const evidenceSchema=JSON.parse(fs.readFileSync('contracts/p29-release-evidence.schema.json','utf8'));
const changeSchema=JSON.parse(fs.readFileSync('contracts/p29-change-manifest.schema.json','utf8'));

assert.equal(plan.phase,'P29');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.operatorOverride.enabled,true);
assert.equal(plan.operatorOverride.doesNotBypassFutureP29CompatibilityEvidence,true);
assert.equal(plan.dependencyGraph.nodeCount,18);
assert.equal(plan.dependencyGraph.edgeCount,51);
assert.equal(plan.dependencyGraph.unresolvedP28Resources,0);
assert.equal(plan.currentEpoch.migrationHead,'20261004192902');
assert.equal(plan.currentEpoch.edgeFunctionCount,12);
assert.equal(plan.currentEpoch.cronJobs,14);
assert.equal(plan.currentEpoch.gomokuRoom.version,50);
assert.equal(plan.releaseProtocol.providerBeforeConsumer,true);
assert.equal(plan.certificationPolicy.certificateIsImmutableReceipt,true);
assert.equal(plan.automation.productionPromotionAllowed,false);
assert.equal(plan.automation.productionMutationAllowed,false);

assert.equal(graph.phase,'P29');
assert.equal(graph.graphVersion,'2026-10-04.1');
assert.equal(graph.nodes.length,18);
assert.equal(graph.edges.length,51);
assert.equal(graph.resourceOwners.edgeFunctions['micro-arcade-p31-backup-export'],'micro_arcade');
assert.equal(graph.resourceOwners.cronJobs['micro-arcade-p31-monthly'],'micro_arcade');
assert.equal(graph.liveBaseline.cronJobs,14);
assert.equal(graph.liveBaseline.releaseEpochState,'refreeze_pending_generation6_candidate_revision2');
assert.equal(graph.liveBaseline.edgeHighlights.gomokuRoom.version,50);
assert.equal(graph.liveBaseline.edgeHighlights.microArcadeBackup.version,2);
assert.equal(graph.liveBaseline.edgeFunctionCount,12);
assert.equal(graph.liveBaseline.p28ResourceOwnershipUnresolved,0);

const ids=new Set(graph.nodes.map(n=>n.id));
for(const e of graph.edges){
  assert.ok(ids.has(e.provider),'unknown provider '+e.provider);
  assert.ok(ids.has(e.consumer),'unknown consumer '+e.consumer);
  assert.ok(e.contract);
  assert.ok(['hard','soft'].includes(e.strength));
}
for(const app of ownership.registeredApps)assert.ok(ids.has(app.id));
assert.ok(graph.edges.some(e=>e.consumer==='gomoku'&&e.provider==='account'));
assert.ok(graph.edges.some(e=>e.consumer==='gomoku'&&e.provider==='leaderboard'));
assert.ok(graph.edges.some(e=>e.consumer==='gomoku'&&e.provider==='realtime'));
assert.ok(graph.edges.some(e=>e.consumer==='wordstrike'&&e.provider==='leaderboard'));

for(const token of [
  'active by explicit operator override','18 nodes','51 dependency edges',
  'expand → migrate → contract','Graph/content identity','60-minute',
  'provider before consumer','Compatibility certificate',
  'does not promote production'
]) assert.ok(doc.includes(token),'P29 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p29-validate-graph.mjs'));
assert.ok(workflow.includes('p29-orchestration-contract.py'));
assert.ok(workflow.includes('p29-impact-analysis.json'));

assert.ok(evidenceSchema.required.includes('graphSha256'));
assert.ok(evidenceSchema.required.includes('changeManifestSha256'));
assert.ok(evidenceSchema.required.includes('quietWindowObservedMinutes'));
assert.ok(changeSchema.required.includes('changes'));

const out='p29-graph-validation.test.json';
try{
  execFileSync(process.execPath,['scripts/p29-validate-graph.mjs',out],{stdio:'pipe'});
  const result=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.equal(result.passed,true);
  assert.equal(result.nodeCount,18);
  assert.equal(result.edgeCount,51);
  assert.equal(result.ownershipAligned,true);
} finally { fs.rmSync(out,{force:true}); }

console.log('P29 cross-app release orchestration contract passed.');
