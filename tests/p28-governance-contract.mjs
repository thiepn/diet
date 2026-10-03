import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';

const plan=JSON.parse(fs.readFileSync('platform-p28-lifecycle-governance-plan.json','utf8'));
const own=JSON.parse(fs.readFileSync('platform-p28-resource-ownership.json','utf8'));
const doc=fs.readFileSync('docs/P28-LIFECYCLE-COST-MULTIAPP-GOVERNANCE.md','utf8');
const sql=fs.readFileSync('scripts/p28-governance-inventory.sql','utf8').toLowerCase();
const workflow=fs.readFileSync('.github/workflows/p28-governance-staging.yml','utf8');

assert.equal(plan.phase,'P28');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.operatorOverride.enabled,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeDestructiveLifecycleOrBillingActions,true);
assert.equal(plan.organization.plan,'free');
assert.equal(plan.organization.nonDefaultPreviewBranches,0);
assert.equal(plan.platformInventory.registeredApps,6);
assert.equal(plan.platformInventory.edgeFunctions,12);
assert.equal(plan.platformInventory.cronJobs,13);
assert.equal(plan.currentKnownQuotaUsage.databaseUtilizationPct,7.07);
assert.equal(plan.costEfficiencyPolicy.unknownUsageState,'unknown_not_zero');
assert.equal(plan.costEfficiencyPolicy.automaticPurchase,false);
assert.equal(plan.retirementPolicy.automaticUserDataDeletion,false);
assert.equal(plan.automation.destructiveActionAllowed,false);
assert.equal(plan.automation.billingActionAllowed,false);
assert.ok(plan.platformCompatibilityWatch.some(x=>x.effectiveDate==='2026-10-30'));

assert.equal(own.registeredApps.length,6);
assert.equal(own.edgeFunctions.length,12);
assert.equal(own.cronJobs.length,13);
assert.equal(own.storageBuckets.length,1);
assert.equal(own.databaseInventory.unresolved.length,0);
assert.ok(own.databaseInventory.verifiedLegacyAssignments.some(x=>x.resource==='public.change_log'&&x.owner==='diet'));
assert.ok(own.databaseInventory.verifiedLegacyAssignments.some(x=>x.resource==='public.training_distribution_settings'&&x.owner==='diet'));
assert.ok(own.edgeFunctions.every(x=>x.owner));
assert.ok(own.cronJobs.every(x=>x.owner));

for(const token of [
  'active by explicit operator override','99.97%','7.07%','unknown as unknown',
  '2026-10-30','Retirement never automatically deletes user data',
  'App count alone is never a project-split trigger'
]) assert.ok(doc.includes(token),'P28 doc missing '+token);

for(const banned of [
  /\bcreate\s+(table|index|function|view|policy)\b/,
  /\balter\s+(table|function|role|database|system)\b/,
  /\bdrop\s+(table|index|function|view|policy)\b/,
  /\binsert\s+into\b/,/\bupdate\s+[^\n]+\s+set\b/,/\bdelete\s+from\b/,
  /\btruncate\b/,/\bterminate_backend\b/,/\bcancel_backend\b/,/pg_stat_statements_reset/
]) assert.doesNotMatch(sql,banned,'P28 inventory SQL must remain read-only.');

assert.ok(workflow.includes("cron: '31 4 * * 0'"));
assert.ok(workflow.includes('p28-governance-audit.mjs'));
assert.ok(workflow.includes('p28-governance-audit.json'));

const auditOut='p28-governance-audit.test.json';
try{
  execFileSync(process.execPath,['scripts/p28-governance-audit.mjs','--out',auditOut],{stdio:'pipe'});
  const audit=JSON.parse(fs.readFileSync(auditOut,'utf8'));
  assert.equal(audit.passed,true);
  assert.equal(audit.destructiveActionAllowed,false);
  assert.equal(audit.billingActionAllowed,false);
  assert.equal(audit.ownershipCoverage.unresolvedKnownResources,0);
}finally{fs.rmSync(auditOut,{force:true});}

function transition(payload){
  const input='p28-transition.test.json',output='p28-transition-out.test.json';
  fs.writeFileSync(input,JSON.stringify(payload));
  const r=spawnSync(process.execPath,['scripts/p28-lifecycle-transition.mjs','--input',input,'--out',output],{encoding:'utf8'});
  const report=JSON.parse(fs.readFileSync(output,'utf8'));
  fs.rmSync(input,{force:true});fs.rmSync(output,{force:true});
  return {code:r.status,report};
}
let t=transition({component:'legacy-app',current:'deprecated',target:'retired',liveDependents:1,dataDispositionApproved:false,backupDecisionRecorded:false,ownerApproval:false});
assert.equal(t.report.allowed,false);
assert.ok(t.report.blockers.includes('live_dependents'));
assert.ok(t.report.blockers.includes('data_disposition_not_approved'));
t=transition({component:'legacy-app',current:'deprecated',target:'retired',liveDependents:0,dataDispositionApproved:true,backupDecisionRecorded:true,ownerApproval:true});
assert.equal(t.report.allowed,true);
assert.equal(t.report.automaticMutationPerformed,false);
assert.equal(t.report.destructiveActionAllowed,false);

console.log('P28 lifecycle/cost/multi-app governance contract passed.');
