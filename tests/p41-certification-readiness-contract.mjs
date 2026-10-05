import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p41-generation5-epoch-watch.json','utf8'));
const obs=JSON.parse(fs.readFileSync('platform-p41-live-epoch-observation.json','utf8'));
const p40=JSON.parse(fs.readFileSync('platform-p40-generation5-activation-plan.json','utf8'));
const doc=fs.readFileSync('docs/P41-GENERATION5-EPOCH-WATCH.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p41-generation5-epoch-watch.yml','utf8');

assert.equal(plan.phase,'P41');
assert.equal(plan.state,'generation5_invalidated_epoch_changed');
assert.equal(plan.generation,5);
assert.equal(plan.activation.frozenMigrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(plan.epochWatch.firstIncompatibleMigration.head,'20261004185802_studyos_p7_master_map_and_packet');
assert.equal(plan.epochWatch.currentMigrationHead,'20261005133228_hub_h18_notes_capture');
assert.equal(plan.certificationReadiness.generation5Certifiable,false);
assert.equal(plan.nextGeneration.generation,6);
assert.equal(plan.safety.productionMutationPerformed,false);

assert.equal(obs.projectStatus,'ACTIVE_HEALTHY');
assert.equal(obs.frozenEpochMatch,false);
assert.equal(obs.edgeFunctionCount,12);
assert.equal(obs.gomokuRoomVersion,50);
assert.equal(obs.cronJobs,14);

assert.equal(p40.state,'generation5_burn_in_active');
assert.equal(p40.currentState.burnInCertified,false);

for(const token of [
  'Generation 5 is invalidated',
  'studyos_p7_master_map_and_packet',
  'hub_h18_notes_capture',
  'Generation 6',
  'historical P40 activation evidence',
  'cannot be certified'
]) assert.ok(doc.includes(token),'P41 doc missing '+token);

assert.ok(workflow.includes('p41-certification-readiness.py'));
assert.ok(workflow.includes('tests/p41-certification-readiness-contract.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);

console.log('P41 structural certification-readiness contract passed.');
