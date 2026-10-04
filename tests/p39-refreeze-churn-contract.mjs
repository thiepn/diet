import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p39-refreeze-churn-plan.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const policy=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8')).post_upgrade_burn_in_policy;
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const p15=fs.readFileSync('.github/workflows/p15-offsite-backup.yml','utf8');
const workflow=fs.readFileSync('.github/workflows/p39-refreeze-churn.yml','utf8');
const doc=fs.readFileSync('docs/P39-REFREEZE-CHURN-RESILIENCE.md','utf8');
const script=fs.readFileSync('scripts/p39-reconcile-refreeze-candidate.py','utf8');

assert.equal(plan.phase,'P39');
assert.equal(plan.state,'implementation_active_candidate_rebased');
assert.equal(plan.sourceMainSha,'d7575dac485823001049bcf7187a408b4d25a318');
assert.equal(plan.liveObservation.migrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(plan.liveObservation.gomokuRoom.version,50);
assert.equal(plan.candidateReconciliation.generationRemains,5);
assert.equal(plan.candidateReconciliation.candidateRevision,2);
assert.equal(plan.candidateReconciliation.quietMinutesObserved,4.14);
assert.equal(plan.latestSuccessfulEncryptedBackup.runId,37218356705);
assert.equal(plan.latestSuccessfulEncryptedBackup.freshnessState,'stale_for_current_candidate');
assert.equal(plan.backupFreshnessAutomation.refreezeSchedule,'47 * * * *');

assert.equal(p25.state,'refreeze_pending');
assert.equal(p25.nextGeneration,5);
assert.equal(p25.pendingGeneration5.generation,5);
assert.equal(p25.pendingGeneration5.candidateRevision,2);
assert.equal(p25.pendingGeneration5.state,'waiting_quiet_window_and_fresh_backup');
assert.equal(p25.pendingGeneration5.candidateEpoch.gomokuRoomVersion,50);
assert.equal(p25.pendingGeneration5.latestSuccessfulBackup.runId,37218356705);
assert.equal(p25.pendingGeneration5.latestSuccessfulBackup.freshForCandidate,false);
assert.equal(p25.refreezePolicy.earliestRefreezeAt,'2026-10-04T18:36:39.032000Z');

assert.equal(backend.generation5_state,'waiting_quiet_window_and_fresh_backup');
assert.equal(backend.generation5_candidate_revision,2);
assert.equal(backend.latest_backup_run,37218356705);
assert.equal(app.health.p25Generation5State,'waiting_quiet_window_and_fresh_backup');
assert.equal(app.health.p25Generation5CandidateRevision,2);

assert.equal(fleet.registryVersion,'2026-10-04.3');
assert.equal(fleet.releaseEpoch.state,'refreeze_pending_generation5_candidate_revision2');
assert.equal(fleet.releaseEpoch.edgeHighlights.gomokuRoom.version,50);
assert.equal(fleet.releaseEpoch.latestSuccessfulBackupFreshForCandidate,false);
assert.equal(policy.bundleVersion,'2026-10-04.3');
assert.equal(policy.fleetRegistryVersion,'2026-10-04.3');
assert.equal(policy.liveBaseline.gomokuRoomVersion,50);

assert.ok(p15.includes("cron: '17 4 * * *'"));
assert.ok(p15.includes("cron: '47 * * * *'"));
assert.ok(p15.includes("hourly_refreeze_pending"));
assert.ok(p15.includes('platform-p25-burn-in-plan.json'));
assert.ok(p15.includes("steps.cadence.outputs.run_backup == 'true'"));
assert.ok(p15.includes('retention-days: 90'));

for(const token of [
  'candidateRebased','candidateRevision','backup_predates_latest_shared_change',
  'pendingGeneration5','sourceFilesMutated'
]) assert.ok(script.includes(token),'P39 reconciler missing '+token);

for(const token of [
  'generation 5 remains generation 5',
  'gomoku_p23_security_admission_gate',
  'v50',
  '37218356705',
  'successful but stale',
  '18:36:39',
  'hourly',
  'refreeze_pending',
  'does not activate generation 5'
]) assert.ok(doc.includes(token),'P39 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p39-reconcile-refreeze-candidate.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);

console.log('P39 structural epoch-churn and backup-freshness contract passed.');
