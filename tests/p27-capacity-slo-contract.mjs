import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p27-capacity-slo-plan.json','utf8'));
const doc=fs.readFileSync('docs/P27-CAPACITY-SLO-AUTONOMOUS-OPS.md','utf8');
const sql=fs.readFileSync('scripts/p27-capacity-snapshot.sql','utf8').toLowerCase();
const workflow=fs.readFileSync('.github/workflows/p27-capacity-slo-staging.yml','utf8');

assert.equal(plan.phase,'P27');
assert.equal(plan.state,'staged_pending_p26');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p26Certification,'complete');
assert.ok(plan.activationRequires.p26AuthoritativeBaselineHoursAtLeast>=72);
assert.ok(plan.activationRequires.p26UnusedIndexObservationDaysAtLeast>=7);

assert.equal(plan.provisionalCapacitySnapshot.databasePretty,'26 MB');
assert.equal(plan.provisionalCapacitySnapshot.maxConnections,60);
assert.equal(plan.provisionalCapacitySnapshot.usableConnections,57);
assert.equal(plan.provisionalCapacitySnapshot.blockedSessions,0);
assert.equal(plan.provisionalCapacitySnapshot.idleInTransactionConnections,0);

assert.equal(plan.candidateSloPolicy.status,'provisional_until_p26_baseline');
assert.equal(plan.candidateSloPolicy.availability.targetPct,99.9);
assert.equal(plan.candidateSloPolicy.database.deadlocksTarget,0);
assert.equal(plan.autonomyModel.defaultLevel,'L1_detect_and_report');
assert.ok(plan.autonomyModel.prohibitedWithoutHumanApproval.includes('schema DDL'));
assert.ok(plan.autonomyModel.prohibitedWithoutHumanApproval.includes('change compute size'));
assert.ok(plan.autonomyModel.prohibitedWithoutHumanApproval.includes('delete user data'));

for(const token of [
  'P27 is **staged, not active**',
  '99.9%',
  '60% of usable connections',
  '80%',
  'L1 — detect, classify, report',
  'Production mutation remains here by default',
  'P27 workflows stay manual-only'
]) assert.ok(doc.includes(token),'P27 doc missing '+token);

for(const banned of [
  /\bcreate\s+(table|index|function|view|policy)\b/,
  /\balter\s+(table|function|role|database|system)\b/,
  /\bdrop\s+(table|index|function|view|policy)\b/,
  /\binsert\s+into\b/,
  /\bupdate\s+[^\n]+\s+set\b/,
  /\bdelete\s+from\b/,
  /\btruncate\b/,
  /\bterminate_backend\b/,
  /\bcancel_backend\b/,
  /\breindex\b/,
  /\bvacuum\b/,
  /pg_stat_statements_reset/
]) assert.doesNotMatch(sql,banned,'P27 capacity SQL must remain read-only.');

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P27 staging workflow must not be scheduled before activation.');
assert.ok(workflow.includes('p27-public-slo.py'));

console.log('P27 staged capacity/SLO/autonomous-operations contract passed; activation remains blocked on P26.');
