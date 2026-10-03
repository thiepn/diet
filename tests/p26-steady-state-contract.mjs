import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p26-steady-state-plan.json','utf8'));
const doc=fs.readFileSync('docs/P26-STEADY-STATE-BASELINE.md','utf8');
const sql=fs.readFileSync('scripts/p26-steady-state-baseline.sql','utf8').toLowerCase();

assert.equal(plan.phase,'P26');
assert.equal(plan.state,'staged_pending_p25');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p25MinimumBurnInHours,24);
assert.ok(plan.activationRequires.p25MinimumSuccessfulSamples>=12);
assert.equal(plan.baselinePolicy.authoritativeOnlyAfterP25,true);
assert.ok(plan.baselinePolicy.authoritativeObservationHours>=72);
assert.ok(plan.baselinePolicy.unusedIndexMinimumObservationDays>=7);
assert.equal(plan.optimizationGuardrails.noDatabaseDdlBeforeP25Completion,true);
assert.equal(plan.optimizationGuardrails.noIndexDropsFromFreshlyResetStats,true);
assert.equal(plan.optimizationGuardrails.noSpeculativeIndexes,true);
assert.equal(plan.provisionalBaseline.database.deadlocks,0);
assert.equal(plan.provisionalBaseline.database.waitingLocks,0);
assert.equal(plan.provisionalBaseline.edgeGateway.auth.http5xx,0);
assert.equal(plan.provisionalBaseline.edgeGateway.rest.http5xx,0);
assert.equal(plan.provisionalBaseline.advisors.unusedIndexFindingsActionableNow,false);
assert.equal(plan.provisionalBaseline.advisors.unindexedForeignKeys,2);

for(const token of [
  'P26 is **staged, not active**',
  'No database DDL while P25 is still burning in',
  'at least 72 hours',
  'at least seven days',
  '19 timeout-manager messages',
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

console.log('P26 staged steady-state contract passed; production optimization remains blocked on P25 completion.');
