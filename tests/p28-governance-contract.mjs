import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p28-lifecycle-governance-plan.json','utf8'));
const ownership=JSON.parse(fs.readFileSync('platform-p28-resource-ownership.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const sql=fs.readFileSync('scripts/p28-governance-inventory.sql','utf8').toLowerCase();
const workflow=fs.readFileSync('.github/workflows/p28-governance-staging.yml','utf8');
const doc=fs.readFileSync('docs/P28-LIFECYCLE-COST-MULTIAPP-GOVERNANCE.md','utf8');

assert.equal(plan.phase,'P28');
assert.equal(plan.state,'staged_pending_p27');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p26Certification,'complete');
assert.equal(plan.activationRequires.p27Certification,'complete');
assert.equal(plan.activationRequires.resourceOwnershipCoveragePct,100);
assert.equal(plan.activationRequires.unresolvedProductionResources,0);

assert.deepEqual(
  plan.lifecycleModel.states,
  ['incubating','active','maintenance','deprecated','archived','retired']
);
assert.deepEqual(plan.lifecycleModel.allowedTransitions.retired,[]);
assert.equal(plan.retirementPolicy.automaticProductionDeletion,false);
assert.equal(plan.retirementPolicy.automaticProjectPauseOrDelete,false);
assert.equal(plan.costEfficiencyPolicy.mode,'showback_before_chargeback');
assert.ok(plan.costEfficiencyPolicy.minimumAttributionCoveragePctBeforeChargeback>=90);
assert.deepEqual(plan.costEfficiencyPolicy.quotaBandsPct,{observe:60,plan:80,protect:90});
assert.equal(plan.organization.plan,'free');
assert.equal(plan.organization.nonDefaultPreviewBranchCount,0);
assert.equal(plan.billingDocsSnapshot.refreshBeforeAnyPlanOrCostDecision,true);
assert.equal(plan.currentCapacityAgainstKnownQuota.currentCostPressure,'low');
assert.equal(plan.attributionSnapshot.classificationCoveragePct,99.61);
assert.equal(plan.attributionSnapshot.observed5xx,0);

assert.equal(ownership.phase,'P28');
assert.equal(ownership.registeredApps.length,6);
assert.equal(ownership.edgeFunctions.length,11);
assert.equal(ownership.cronJobs.length,8);
assert.equal(ownership.storageBuckets.length,1);
assert.ok(ownership.edgeFunctions.every(x=>x.owner));
assert.ok(ownership.cronJobs.every(x=>x.owner));
assert.ok(ownership.storageBuckets.every(x=>x.owner));
assert.ok(ownership.unresolved.some(x=>x.resource==='public.change_log' && x.activationBlocker===true));

for(const token of [
  'P28 is **staged, not active**',
  'showback before chargeback',
  '99.61%',
  'public.change_log',
  'Retirement never automatically deletes user data',
  'number of apps as a split trigger'
]) assert.ok(doc.includes(token),'P28 doc missing '+token);

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
  /\bpause\b/,
  /pg_stat_statements_reset/
]) assert.doesNotMatch(sql,banned,'P28 inventory SQL must remain read-only.');

for(const required of ['account_apps','pg_class','pg_proc','cron.job','storage.objects','pg_database_size'])
  assert.ok(sql.includes(required),'P28 inventory SQL missing '+required);

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P28 staging workflow must be manual-only.');
assert.ok(workflow.includes('p28-cost-attribution.py'));

console.log('P28 staged lifecycle/cost/multi-app governance contract passed.');
