import assert from 'node:assert/strict';
import fs from 'node:fs';

const rem=JSON.parse(fs.readFileSync('platform-p36-remediation-execution.json','utf8'));
const freeze=JSON.parse(fs.readFileSync('platform-p36-stable-epoch-freeze.json','utf8'));
const oe=JSON.parse(fs.readFileSync('platform-p36-operating-effectiveness-state.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P36-REMEDIATION-FREEZE-OE-ACTIVATION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p36-remediation-freeze-oe-staging.yml','utf8');

assert.equal(rem.phase,'P36');
assert.equal(rem.productionMutationPerformed,false);
assert.equal(rem.executedDispositions.length,3);
assert.equal(rem.executedDispositions.find(x=>x.deficiencyId==='P34-D003').retest.tables,64);
assert.equal(rem.p25Generation3.active,true);

assert.equal(freeze.phase,'P36');
assert.equal(freeze.state,'invalidated_by_shared_epoch_change');
assert.equal(freeze.p25Generation,2);
assert.equal(freeze.currentP25Generation.generation,3);
assert.equal(freeze.currentP25Generation.state,'burn_in_active');
assert.equal(freeze.currentP25Generation.frozenEpoch.migrationVersion,'20261002172133');
assert.equal(freeze.currentP25Generation.frozenEpoch.gomokuRoomVersion,45);

assert.equal(oe.phase,'P36');
assert.equal(oe.state,'armed_waiting_p25_generation3_certification');
assert.equal(oe.active,false);
assert.equal(oe.activationIsRetroactive,false);
assert.equal(oe.activationGates.p25ActiveGenerationCertified,false);

assert.equal(p25.state,'burn_in_active');
assert.equal(p25.generation,3);
assert.equal(p25.generationState,'burn_in_active');
assert.equal(p25.currentGenerationEligible,true);
assert.equal(app.operationsVersion,'P25.0');
assert.equal(app.health.p25BurnInActive,true);
assert.equal(app.health.p25BurnInGeneration,3);

for(const token of [
  'P36 is **staged, not active**',
  'generation 2 freeze is invalid',
  'generation 3 is active',
  '20261002172133_gomoku_p17_certification_health_isolation',
  'v45',
  '64',
  'P34-D002',
  'P34-D003',
  'P34-D005',
  'not backdated'
]) assert.ok(doc.includes(token),'P36 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('p36-evaluate-activation.py'));
assert.ok(workflow.includes('p36-activate-oe.py'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P36 staging workflow must remain read-only.');

console.log('P36 staged remediation/generation-3/OE activation contract passed.');
