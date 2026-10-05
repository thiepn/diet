import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p43-final-revalidation.json','utf8'));
const obs=JSON.parse(fs.readFileSync('platform-p43-live-observation.json','utf8'));
const backup=JSON.parse(fs.readFileSync('platform-p43-backup-evidence.json','utf8'));
const p42=JSON.parse(fs.readFileSync('platform-p42-generation6-refreeze-plan.json','utf8'));
const doc=fs.readFileSync('docs/P43-GENERATION6-FINAL-ACTIVATION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p43-generation6-final-activation.yml','utf8');

assert.equal(plan.phase,'P43');
assert.equal(plan.state,'blocked_quiet_window');
assert.equal(plan.generation,6);
assert.equal(plan.candidateRevision,4);
assert.equal(plan.exactCandidateMatch,true);
assert.equal(plan.activation.eligibleToActivate,false);
assert.equal(plan.activation.generation6Activated,false);
assert.equal(plan.backup.runId,37327405248);
assert.equal(plan.backup.freshForCandidate,true);

assert.equal(obs.migrationHead,p42.candidateEpoch.migrationHead);
assert.equal(obs.semanticSchemaSha256,p42.candidateEpoch.semanticSchemaSha256);
assert.equal(obs.edgeFunctionCount,12);
assert.equal(obs.edgeFunctionsAllActive,true);
assert.equal(obs.gomokuRoomVersion,50);
assert.equal(obs.cronJobs,14);
assert.equal(obs.cronFailures24h,0);
assert.equal(obs.securityAdvisorsReviewed,true);
assert.equal(obs.performanceAdvisorsReviewed,true);

assert.equal(backup.runId,37327405248);
assert.equal(backup.conclusion,'success');
assert.equal(backup.freshForCandidate,true);

assert.ok(workflow.includes('p43-final-revalidate.py'));
assert.ok(workflow.includes('p43-activate-generation6.py'));
assert.ok(workflow.includes('tests/p43-generation6-activation-contract.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);

for (const token of [
  'Generation 6',
  '20261005143803_studyos_p11_calendar_deadline_sync',
  '37327405248',
  '15:38:03Z',
  '47.27',
  'not activated',
  'deterministic activation transform'
]) assert.ok(doc.includes(token),'P43 doc missing '+token);

console.log('P43 structural activation contract passed.');
