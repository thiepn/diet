import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const plan=JSON.parse(fs.readFileSync('platform-p27-capacity-slo-plan.json','utf8'));
const doc=fs.readFileSync('docs/P27-CAPACITY-SLO-AUTONOMOUS-OPS.md','utf8');
const sql=fs.readFileSync('scripts/p27-capacity-snapshot.sql','utf8').toLowerCase();
const workflow=fs.readFileSync('.github/workflows/p27-capacity-slo-staging.yml','utf8');
const forecast=fs.readFileSync('scripts/p27-capacity-forecast.py','utf8');
const evaluator=fs.readFileSync('scripts/p27-evaluate-slo.py','utf8');
const autonomy=fs.readFileSync('scripts/p27-autonomy-decision.mjs','utf8');
const publicProbe=fs.readFileSync('tests/p27-public-slo.py','utf8');

assert.equal(plan.phase,'P27');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.operatorOverride.enabled,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeProductionMutation,true);
assert.equal(plan.productionMutationMode,'human_approval_only');

const cap=plan.provisionalCapacitySnapshot;
assert.equal(cap.databasePretty,'35 MB');
assert.equal(cap.maxConnections,60);
assert.equal(cap.usableConnections,57);
assert.equal(cap.currentConnections,10);
assert.equal(cap.blockedSessions,0);
assert.equal(cap.idleInTransactionConnections,0);
assert.equal(plan.shortWindowGrowthDiagnostic.forecastQualified,false);
assert.ok(plan.trafficSnapshot.observedPeakHourlyRequests>=10000);
assert.equal(plan.trafficSnapshot.observedPeakHour5xx,0);

assert.equal(plan.capacityPolicy.connectionWarningPctOfUsable,60);
assert.equal(plan.capacityPolicy.connectionCriticalPctOfUsable,80);
assert.equal(plan.capacityPolicy.databaseGrowthForecastMinimumDays,14);
assert.equal(plan.capacityPolicy.databaseGrowthForecastMinimumSamples,3);
assert.deepEqual(plan.capacityPolicy.forecastHorizonDays,[30,90,180,365]);

assert.equal(plan.sloPolicy.availability.targetPct,99.9);
assert.equal(plan.sloPolicy.availability.monthlyErrorBudgetMinutesApprox,43.2);
assert.equal(plan.sloPolicy.latency.restP95WarningMs,750);
assert.equal(plan.sloPolicy.latency.authP95WarningMs,929);
assert.equal(plan.sloPolicy.burnPolicy.fastBurnRateCritical,14.4);
assert.equal(plan.sloPolicy.burnPolicy.slowBurnRateCritical,6);

assert.equal(plan.autonomyModel.activeLevel,'L1_detect_classify_report');
assert.equal(plan.autonomyModel.mutationAllowedWithoutHumanApproval,false);
for(const required of ['schema DDL','terminate sessions','compute resize','RLS changes','user-data deletion']){
  assert.ok(plan.autonomyModel.prohibitedWithoutApproval.includes(required));
}

for(const token of [
  'active by explicit operator override',
  '35 MB',
  '10,289 requests',
  '99.9%',
  '14.4×',
  '6×',
  'L1 — detect, classify, report',
  'All production mutation remains here',
  'runs hourly'
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

for(const required of [
  "cron: '17 * * * *'",
  'workflow_dispatch',
  'p27-public-slo.py',
  'retention-days: 30'
]) assert.ok(workflow.includes(required),'P27 monitoring workflow missing '+required);

for(const required of ['minimum-days','minimum-samples','daysToCapacity','qualified','rSquared']){
  assert.ok(forecast.includes(required),'P27 forecast missing '+required);
}
for(const required of ['fastBurnRate1h','slowBurnRate6h','errorBudgetConsumedPct','productionMutationAllowed']){
  assert.ok(evaluator.includes(required),'P27 SLO evaluator missing '+required);
}
for(const required of ['mutationAllowed:false','approvalRequiredForMutation:true','L1_detect_classify_report']){
  assert.ok(autonomy.includes(required),'P27 autonomy guard missing '+required);
}
assert.ok(publicProbe.includes('platform-p27-capacity-slo-plan.json'));
assert.ok(publicProbe.includes('"productionMutationAllowed":False'));

const sloPath='p27-autonomy-slo.test.json';
const capPath='p27-autonomy-capacity.test.json';
const outPath='p27-autonomy.test.json';
try{
  fs.writeFileSync(sloPath,JSON.stringify({
    phase:'P27',state:'warning',burnState:'budget_overrun',latencyState:'healthy'
  }));
  fs.writeFileSync(capPath,JSON.stringify({
    phase:'P27',qualified:false,observationDays:2,sampleCount:2,daysToCapacity:null
  }));
  execFileSync(process.execPath,[
    'scripts/p27-autonomy-decision.mjs',
    '--slo',sloPath,
    '--capacity',capPath,
    '--out',outPath
  ],{stdio:'pipe'});
  const decision=JSON.parse(fs.readFileSync(outPath,'utf8'));
  assert.equal(decision.autonomyLevel,'L1_detect_classify_report');
  assert.equal(decision.mutationAllowed,false);
  assert.equal(decision.approvalRequiredForMutation,true);
  assert.ok(decision.findings.some(x=>x.domain==='slo'));
  assert.ok(decision.findings.some(x=>x.domain==='capacity'));
  assert.ok(decision.runbookRecommendations.length>=2);
} finally {
  fs.rmSync(sloPath,{force:true});
  fs.rmSync(capPath,{force:true});
  fs.rmSync(outPath,{force:true});
}

console.log('P27 capacity/SLO/autonomous-operations contract passed; autonomous production mutation remains disabled.');
