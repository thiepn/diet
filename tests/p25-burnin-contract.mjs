import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseline=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8')).post_upgrade_burn_in_policy;
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P25-POST-UPGRADE-BURN-IN.md','utf8');
const probe=fs.readFileSync('tests/p25-public-burnin.py','utf8');
const workflow=fs.readFileSync('.github/workflows/p25-post-upgrade-burnin.yml','utf8');

assert.equal(baseline.phase,'P25');
assert.equal(baseline.state,'refreeze_pending');
assert.equal(baseline.generation,4);
assert.equal(baseline.generationState,'invalidated_epoch_changed');
assert.equal(baseline.currentGenerationEligible,false);
assert.equal(baseline.nextGeneration,5);
assert.equal(baseline.completionState.complete,false);
assert.equal(baseline.completionState.invalidated,true);
assert.equal(baseline.generation4Invalidation.generation,4);
assert.equal(baseline.generation4Invalidation.invalidatedAt,'2026-10-04T16:21:43.552540Z');
assert.equal(baseline.generation4Invalidation.observedMigrationHead,'20261004132839_gomoku_p21_capacity_admission_gate');
assert.equal(baseline.generation4Invalidation.observedGomokuRoomVersion,49);
assert.equal(baseline.pendingGeneration5.generation,5);
assert.equal(baseline.pendingGeneration5.state,'waiting_quiet_window_and_fresh_backup');
assert.equal(baseline.pendingGeneration5.eligibleToActivate,false);
assert.equal(baseline.pendingGeneration5.edgeQuietMinutesObserved,4.14);
assert.equal(baseline.pendingGeneration5.postFinalChangeEncryptedBackupVerified,false);
assert.equal(baseline.pendingGeneration5.lastRecheckedAt,'2026-10-04T17:40:47.662109Z');
assert.equal(baseline.pendingGeneration5.lastDecision,'blocked');
assert.ok(baseline.pendingGeneration5.lastBlockers.includes('quiet_window_open:4.14/60'));
assert.ok(baseline.pendingGeneration5.lastBlockers.includes('backup_predates_latest_shared_change'));
assert.equal(baseline.pendingGeneration5.candidateRevision,2);
assert.equal(baseline.refreezePolicy.minimumQuietMinutes,60);
assert.equal(baseline.refreezePolicy.earliestRefreezeAt,'2026-10-04T18:36:39.032000Z');
assert.equal(baseline.latestObservedEpoch.migrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(baseline.latestObservedEpoch.gomokuRoomVersion,50);
assert.equal(baseline.latestObservedEpoch.edgeFunctionCount,12);
assert.equal(baseline.latestObservedEpoch.cronJobs,14);
assert.equal(baseline.latestObservedEpoch.cronFailures24h,0);
assert.equal(baseline.latestObservedEpoch.p18Integrity,'clean');
assert.equal(baseline.latestObservedEpoch.p20SchemaDrift,false);
assert.equal(baseline.latestObservedEpoch.p21Readiness,'pass');
assert.equal(baseline.latestObservedEpoch.p22Maintenance,'pass');
assert.equal(baseline.generation5Sampling.minimumSuccessfulSamples,12);
assert.equal(baseline.generation5Sampling.minimumCoverageBuckets,6);
assert.equal(baseline.generation5Sampling.coverageBucketHours,4);
assert.equal(baseline.generation5Sampling.terminalSampleRequiredAtOrAfterMinimumCompleteAfter,true);
assert.equal(baseline.generation5Sampling.preActivationSamplesQualify,false);
assert.equal(baseline.historicalHostedUpgradeAttestation.status,'pass');

assert.equal(backend.state,'refreeze_pending');
assert.equal(backend.current_generation,4);
assert.equal(backend.current_generation_eligible,false);
assert.equal(backend.next_generation,5);
assert.equal(backend.last_generation_state,'invalidated_epoch_changed');
assert.equal(backend.latest_observed_migration,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(backend.latest_observed_gomoku_edge_version,50);
assert.equal(backend.generation5_state,'waiting_quiet_window_and_fresh_backup');
assert.equal(backend.generation5_candidate_revision,2);
assert.equal(backend.latest_backup_run,37218356705);
assert.equal(backend.generation5_backup_prerequisite_satisfied,false);

assert.equal(app.health.p25BurnInActive,false);
assert.equal(app.health.p25CurrentGenerationValid,false);
assert.equal(app.health.p25BurnInGeneration,4);
assert.equal(app.health.p25BurnInGenerationState,'invalidated_epoch_changed');
assert.equal(app.health.p25NextGeneration,5);
assert.equal(app.health.p25Generation5State,'waiting_quiet_window_and_fresh_backup');
assert.equal(app.health.p25Generation5CandidateRevision,2);
assert.equal(app.health.p25LatestBackupRun,37218356705);

for(const token of [
  'platform-health',
  'platform_p23_upgrade_status',
  'platform_p24_execution_status',
  'platform_p24_post_upgrade_status',
  'qualifiesForBurnIn',
  'currentGenerationEligible',
  'generationState'
]) assert.ok(probe.includes(token),'P25 probe missing '+token);

assert.ok(workflow.includes("cron: '17 * * * *'"));
assert.ok(workflow.includes("cron: '7,27,37,47,57 * * * *'"));
assert.ok(workflow.includes('p25-public-burnin.py'));
assert.ok(workflow.includes('retention-days: 30'));

for(const token of [
  'Generation 4',
  'invalidated',
  'generation 5',
  'gomoku_p21_capacity_admission_gate',
  'v49',
  'micro-arcade-p31-backup-export',
  '2026-10-04T17:20:09.879000Z',
  'pre-refreeze samples do not qualify'
]) assert.ok(doc.includes(token),'P25 document missing '+token);

console.log('P25 generation-4 invalidation and generation-5 refreeze-pending contract passed.');
