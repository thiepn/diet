import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p30-release-train-plan.json','utf8'));
const env=JSON.parse(fs.readFileSync('platform-p30-environment-contract.json','utf8'));
const schema=JSON.parse(fs.readFileSync('contracts/p30-release-candidate.schema.json','utf8'));
const doc=fs.readFileSync('docs/P30-RELEASE-TRAINS-PROMOTION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p30-release-train-staging.yml','utf8');

assert.equal(plan.phase,'P30');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'implementation_active_operator_override');
assert.equal(plan.operatorOverride.enabled,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeProductionPromotion,true);
assert.equal(plan.operatorOverride.doesNotAuthorizePaidEnvironmentProvisioning,true);
assert.equal(plan.currentReleaseEpoch.migrationHead,'20261003105645');
assert.equal(plan.currentReleaseEpoch.migrationName,'gomoku_p20_production_slos_error_budgets');
assert.equal(plan.currentReleaseEpoch.edgeFunctionCount,12);
assert.equal(plan.currentReleaseEpoch.cronJobs,14);
assert.equal(plan.currentReleaseEpoch.newlyObservedCron,'gomoku-p20-slo-sample');
assert.equal(plan.currentReleaseEpoch.p29BaselineSuperseded,true);
assert.equal(plan.candidateIdentity.noInPlaceMutation,true);
assert.equal(plan.promotionRules.exactAdjacentTransitionsOnly,true);
assert.equal(plan.promotionRules.productionPromotionManualOnly,true);
assert.equal(plan.rolloutPolicy.falseCanaryClaimsRejected,true);
assert.equal(plan.rollbackPolicy.databaseDefault,'forward_fix');
assert.equal(plan.automation.productionPromotionAllowed,false);
assert.equal(plan.automation.paidProvisioningAllowed,false);

assert.equal(env.phase,'P30');
assert.equal(env.organization.plan,'free');
assert.equal(env.production.serviceStatus,'ACTIVE_HEALTHY');
assert.equal(env.hostedBranching.currentPlanEligible,false);
assert.equal(env.hostedBranching.requiredPlan,'pro');
assert.equal(env.hostedBranching.currentNonDefaultBranches,0);
assert.equal(env.hostedBranching.defaultBranch.branchActionStatus,'MIGRATIONS_FAILED');
assert.equal(env.hostedBranching.defaultBranch.previewProjectStatus,'ACTIVE_HEALTHY');
assert.equal(env.creationPolicy.automaticPlanUpgrade,false);
assert.equal(env.creationPolicy.automaticBranchCreation,false);
assert.equal(env.creationPolicy.automaticProjectCreation,false);
const local=env.environments.find(x=>x.id==='local_supabase_ephemeral');
assert.equal(local.statefulIsolation,true);
assert.equal(local.costApprovalRequired,false);
assert.ok(local.eligibleTrainTypes.includes('shared_standard'));
const hosted=env.environments.find(x=>x.id==='hosted_preview');
assert.equal(hosted.currentlyAvailable,false);
assert.equal(hosted.planUpgradeRequired,true);

for(const k of [
  'dependencyGraphSha256','p29CertificateId','changeManifestSha256',
  'impactAnalysisSha256','semanticSchemaSha256','migrationHead',
  'edgeInventorySha256','cronInventorySha256','environmentTopologyVersion'
]) assert.ok(schema.properties.immutable.required.includes(k),'candidate schema missing '+k);

for(const token of [
  'active by explicit operator override','gomoku_p20_production_slos_error_budgets',
  'cron jobs: **14**','Free plan','Branching requires Pro',
  'local_supabase_ephemeral','source → candidate → integration → production_ready → production → observation → certified',
  'expand → migrate → contract → observe','false canary','forward fix',
  'does not promote production'
]) assert.ok(doc.includes(token),'P30 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P30 release-train workflow must remain manual-only.');
assert.ok(workflow.includes('p30-promotion-contract.py'));
assert.ok(workflow.includes('p30-build-candidate.py'));

console.log('P30 release-train/environment-promotion contract passed.');
