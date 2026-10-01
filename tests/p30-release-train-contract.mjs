import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p30-release-train-plan.json','utf8'));
const env=JSON.parse(fs.readFileSync('platform-p30-environment-contract.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P30-RELEASE-TRAINS-PROMOTION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p30-release-train-staging.yml','utf8');

assert.equal(plan.phase,'P30');
assert.equal(plan.state,'staged_pending_p29');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p26Certification,'complete');
assert.equal(plan.activationRequires.p27Certification,'complete');
assert.equal(plan.activationRequires.p28Certification,'complete');
assert.equal(plan.activationRequires.p29Certification,'complete');
assert.equal(plan.activationRequires.statefulPromotionEnvironmentHealthy,true);

assert.equal(plan.currentReleaseEpoch.epochStable,false);
assert.equal(plan.currentReleaseEpoch.currentMigration,'20261001151625_gomoku_p10_competitive_identity');
assert.equal(plan.currentReleaseEpoch.currentGomokuRoomVersion,32);
assert.equal(plan.candidateIdentity.noInPlaceCandidateMutation,true);
assert.equal(plan.promotionRules.noStageSkipping,true);
assert.equal(plan.promotionRules.sharedStatefulChangesRequireIsolatedSupabaseEnvironment,true);
assert.equal(plan.promotionRules.productionPromotionManualOnly,true);
assert.equal(plan.rolloutPolicy.databaseSchemaCanarySupported,false);
assert.equal(plan.rolloutPolicy.edgeCanaryConfigured,false);
assert.equal(plan.rollbackPolicy.defaultForDatabase,'forward_fix');

assert.equal(env.phase,'P30');
assert.equal(env.organization.plan,'free');
assert.equal(env.currentNonProductionStatefulEnvironments,0);
assert.equal(env.creationPolicy.automaticCreation,false);
assert.equal(env.branchRegistryObservation.branchActionStatus,'MIGRATIONS_FAILED');
assert.equal(env.branchRegistryObservation.remoteBranchPromotionBlockedUntilResolved,true);
assert.equal(env.environments.find(x=>x.id==='production').serviceStatus,'ACTIVE_HEALTHY');
assert.equal(env.environments.find(x=>x.id==='preview').provisioned,false);

for(const token of [
  'P30 is **staged, not active**',
  'gomoku_p10_competitive_identity',
  'v32',
  'stateful shared backend change',
  'MIGRATIONS_FAILED',
  'expand → migrate → contract → observe',
  'forward fix',
  'no automatic preview/staging environment creation'
]) assert.ok(doc.includes(token),'P30 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.doesNotMatch(workflow,/\bschedule\s*:/,'P30 staging workflow must stay manual-only.');
assert.ok(workflow.includes('p30-promotion-contract.py'));

console.log('P30 staged release-train/environment contract passed.');
