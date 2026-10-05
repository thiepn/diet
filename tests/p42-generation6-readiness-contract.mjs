import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p42-generation6-refreeze-plan.json','utf8'));
const obs=JSON.parse(fs.readFileSync('platform-p42-live-candidate-observation.json','utf8'));
const backup=JSON.parse(fs.readFileSync('platform-p42-latest-backup-evidence.json','utf8'));
const p41=JSON.parse(fs.readFileSync('platform-p41-generation5-epoch-watch.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/p42-generation6-refreeze.yml','utf8');
const backupWorkflow=fs.readFileSync('.github/workflows/p15-offsite-backup.yml','utf8');
const doc=fs.readFileSync('docs/P42-GENERATION6-REFREEZE.md','utf8');

assert.equal(plan.phase,'P42');
assert.equal(plan.state,'refreeze_pending');
assert.equal(plan.generation,6);
assert.equal(plan.predecessor.state,'invalidated_epoch_changed');
assert.equal(plan.candidateRevision,2);
assert.equal(plan.candidateEpoch.migrationHead,'20261005134753_library_account_deletion_authority');
assert.equal(plan.candidateEpoch.semanticSchemaSha256,'c91f0cf78cc6db7399081fd3fd0595ef84f0c0b4517d11a4767c3f2464bac174');
assert.equal(plan.candidateEpoch.edgeFunctionCount,12);
assert.equal(plan.candidateEpoch.gomokuRoomVersion,50);
assert.equal(plan.candidateEpoch.cronJobs,14);
assert.equal(plan.quietWindow.minimumMinutes,60);
assert.equal(plan.quietWindow.satisfied,false);
assert.equal(plan.backupGate.latestSuccessfulRunId,37324434181);
assert.equal(plan.backupGate.latestSuccessfulBackupFreshForCandidate,false);
assert.equal(plan.activationReadiness.eligibleToActivate,false);
assert.equal(plan.safety.generation6Activated,false);

assert.equal(obs.projectStatus,'ACTIVE_HEALTHY');
assert.equal(obs.p18Integrity,'clean');
assert.equal(obs.p20SchemaDrift,false);
assert.equal(obs.p21Readiness,'pass');
assert.equal(obs.p22Maintenance,'pass');
assert.equal(obs.cronFailures24h,0);
assert.equal(obs.blockingReplicationSlots,0);

assert.equal(backup.conclusion,'success');
assert.equal(backup.verificationPassed,true);
assert.equal(backup.encrypted,true);
assert.equal(backup.freshForCandidate,false);

assert.equal(p41.nextGeneration.generation,6);
assert.equal(p41.nextGeneration.required,true);

assert.ok(backupWorkflow.includes("- 'platform-p42-*.json'"));\nassert.ok(backupWorkflow.includes('platform-p42-generation6-refreeze-plan.json'));
assert.ok(backupWorkflow.includes('generation6_refreeze_pending'));
assert.ok(workflow.includes('p42-evaluate-generation6-readiness.py'));
assert.ok(workflow.includes('tests/p42-generation6-readiness-contract.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);

for(const token of [
  'Generation 6',
  'library_account_deletion_authority',
  '14:47:53Z',
  '37302894815',
  'stale',
  '60-minute',
  'not activated'
]) assert.ok(doc.includes(token),'P42 doc missing '+token);

console.log('P42 structural generation-6 refreeze contract passed.');
