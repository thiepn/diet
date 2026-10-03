import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const plan=JSON.parse(fs.readFileSync('platform-p26-steady-state-plan.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const doc=fs.readFileSync('docs/P26-STEADY-STATE-BASELINE.md','utf8');
const sql=fs.readFileSync('scripts/p26-steady-state-baseline.sql','utf8').toLowerCase();
const gateScript=fs.readFileSync('scripts/p26-activation-readiness.mjs','utf8');

assert.equal(plan.phase,'P26');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'staged_pending_p25');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p25Generation,3);
assert.equal(plan.activationRequires.p25MinimumBurnInHours,24);
assert.ok(plan.activationRequires.p25MinimumSuccessfulSamples>=12);
assert.equal(plan.activationRequires.p25AllSixFourHourCoverageBuckets,true);
assert.equal(plan.activationRequires.p25TerminalSampleAtOrAfterMinimumCompleteAfter,true);
assert.equal(plan.activationRequires.p25FrozenEpochUnchanged,true);
assert.equal(plan.activationRequires.historicalHostedUpgradeAttestation,'pass');
assert.equal(plan.activationRequires.postFinalSharedChangeEncryptedBackup,'success');
assert.equal(Object.hasOwn(plan.activationRequires,'p24PostUpgradeValidation'),false);

assert.equal(p25.generation,3);
assert.equal(p25.currentGenerationEligible,true);
assert.equal(plan.currentGateSnapshot.p25Generation,3);
assert.equal(plan.currentGateSnapshot.timeGateMetAtSnapshot,false);
assert.equal(plan.currentGateSnapshot.earliestCertificationAt,p25.minimumCompleteAfter);
assert.equal(plan.currentGateSnapshot.successfulSamplesKnownAtScheduleChange,5);

assert.equal(plan.baselinePolicy.authoritativeOnlyAfterP25,true);
assert.ok(plan.baselinePolicy.authoritativeObservationHours>=72);
assert.ok(plan.baselinePolicy.unusedIndexMinimumObservationDays>=7);
assert.equal(plan.optimizationGuardrails.noDatabaseDdlBeforeP25Completion,true);
assert.equal(plan.optimizationGuardrails.noIndexDropsFromFreshlyResetStats,true);
assert.equal(plan.optimizationGuardrails.noSpeculativeIndexes,true);

const live=plan.liveProvisionalRefresh;
assert.ok(live.database.overallCacheHitPct>99);
assert.ok(live.database.tableBlockHitPct>99);
assert.ok(live.database.indexBlockHitPct>99);
assert.equal(live.database.deadlocks,0);
assert.equal(live.database.waitingLocks,0);
assert.equal(live.database.conflicts,0);
assert.ok(live.database.pgStatStatementsCalls>100000);
assert.ok(live.database.pgStatStatementsWeightedMeanExecMs<2);
assert.equal(live.database.repeatedSlowStatementsMeanOver100msCallsAtLeast10,1);
assert.equal(live.repeatedSlowStatement.query,'SELECT name FROM pg_timezone_names');
assert.equal(live.repeatedSlowStatement.dietRepositoryReferenceFound,false);
assert.match(live.repeatedSlowStatement.disposition,/watch_only/);
assert.equal(live.performanceAdvisor.unindexedForeignKeys,21);
assert.equal(live.performanceAdvisor.gomokuForeignKeys,19);
assert.equal(live.performanceAdvisor.microArcadeForeignKeys,2);
assert.equal(live.indexes.performanceAdvisorUnusedIndexFindings,108);
assert.equal(live.indexes.zeroScanIndexesAtLeast1MiB,0);
assert.equal(live.indexes.unusedIndexFindingsActionableNow,false);

for(const token of [
  'P26 is **staged, not active**',
  '2026-10-03 20:16:15 UTC',
  'historical hosted-upgrade attestation',
  'No database DDL while P25 is still burning in',
  'at least 72 hours',
  'at least seven days',
  '99.9657%',
  'SELECT name FROM pg_timezone_names',
  '21 unindexed foreign keys',
  '108 unused indexes',
  'zero 5xx'
]) assert.ok(doc.includes(token),'P26 doc missing '+token);

for(const banned of [
  /\bcreate\s+(table|index|function|view|policy)\b/,
  /\balter\s+(table|function|role|database|system)\b/,
  /\bdrop\s+(table|index|function|view|policy)\b/,
  /\binsert\s+into\b/,
  /\bupdate\s+[^\n]+\s+set\b/,
  /\bdelete\s+from\b/,
  /\btruncate\b/,
  /\breindex\b/,
  /\bvacuum\b/,
  /pg_stat_statements_reset/
]) assert.doesNotMatch(sql,banned,'P26 baseline SQL must remain read-only/non-resetting.');

for(const required of [
  'pg_stat_database','pg_statio_user_indexes','pg_statio_user_tables',
  'pg_stat_activity','pg_locks','pg_stat_statements','pg_stat_statements_info'
]) assert.ok(sql.includes(required),'P26 baseline SQL missing '+required);

for(const required of [
  '--require-ready','p25_not_certified','minimum_window_open',
  'historicalHostedUpgradeAttestation','postFinalSharedChangeEncryptedBackup',
  'frozen_epoch_changed'
]) assert.ok(gateScript.includes(required),'P26 activation gate missing '+required);

const testOut='p26-activation-readiness.test.json';
try {
  execFileSync(process.execPath,[
    'scripts/p26-activation-readiness.mjs',
    '--at','2026-10-03T08:09:28.650287Z',
    '--out',testOut
  ],{stdio:'pipe'});
  const report=JSON.parse(fs.readFileSync(testOut,'utf8'));
  assert.equal(report.ready,false);
  assert.equal(report.state,'staged_pending_p25');
  assert.ok(report.blockers.some(x=>x.code==='p25_not_certified'));
  assert.ok(report.blockers.some(x=>x.code==='minimum_window_open'));
} finally {
  fs.rmSync(testOut,{force:true});
}

console.log('P26 staged steady-state contract passed; activation gate remains closed until P25 generation 3 is formally certified.');
