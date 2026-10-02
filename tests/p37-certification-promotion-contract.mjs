import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p37-certification-promotion-launch-plan.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('contracts/p37-governance-promotion-manifest.json','utf8'));
const risk=JSON.parse(fs.readFileSync('platform-p37-d001-risk-treatment.json','utf8'));
const target=JSON.parse(fs.readFileSync('platform-p37-governance-activation-target.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const freeze=JSON.parse(fs.readFileSync('platform-p36-stable-epoch-freeze.json','utf8'));
const doc=fs.readFileSync('docs/P37-BURNIN-PROMOTION-OE-LAUNCH.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p37-certification-promotion-staging.yml','utf8');

assert.equal(plan.phase,'P37');
assert.equal(plan.state,'staged_waiting_p25_generation3_refreeze');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(plan.p25Current.minimumSuccessfulSamples,12);
assert.equal(plan.p25Current.minimumCoverageBuckets,6);
assert.equal(plan.p25Current.currentGenerationEligible,false);
assert.equal(plan.governancePromotion.onePhaseAtATime,true);
assert.equal(plan.governancePromotion.allowBatchMerge,false);
assert.equal(plan.oeLaunch.startIsRetroactive,false);

assert.equal(manifest.phase,'P37');
assert.equal(manifest.policy.certificationRequired,'P25_current_eligible_generation_certified');
assert.equal(manifest.phases.length,11);
assert.deepEqual(manifest.phases.map(x=>x.phase),['P26','P27','P28','P29','P30','P31','P32','P33','P34','P35','P36']);
assert.equal(new Set(manifest.phases.map(x=>x.prNumber)).size,11);
assert.equal(manifest.policy.batchMergeForbidden,true);
assert.equal(manifest.policy.freshCIPerCandidate,true);

assert.equal(risk.deficiencyId,'P34-D001');
assert.equal(risk.liveEvidence.usersWithPasswordHash,0);
assert.deepEqual(risk.liveEvidence.identityProviderCounts,{google:11});
assert.equal(risk.permanentClosure,false);
assert.equal(risk.paidPlanUpgradeAuthorized,false);

assert.equal(target.phase,'P37');
assert.equal(target.targetState.p32Mode,'warn');
assert.equal(target.targetState.p33CanonicalEvidenceActive,true);
assert.equal(target.targetState.controlCatalogFrozen,true);
assert.equal(target.deficiencyStateAtLaunch['P34-D006'],'closed_by_current_active_generation_stability_certification');
assert.equal(target.launchInvariant.activationIsRetroactive,false);

assert.equal(p25.state,'refreeze_pending');
assert.equal(p25.generationState,'generation3_refreeze_pending');
assert.equal(p25.currentGenerationEligible,false);
assert.equal(p25.nextGeneration,3);
assert.equal(p25.generation2Sampling.nominalTriggerOpportunitiesPerHour,4);
assert.equal(freeze.state,'invalidated_by_shared_epoch_change');

for(const token of [
  'P37 is **staged, not active**',
  'generation 3',
  'refreeze pending',
  'gomoku_p17_certification_health_isolation',
  'v45',
  'six 4-hour coverage buckets',
  'P26 → P27 → P28 → P29 → P30 → P31 → P32 → P33 → P34 → P35 → P36',
  '11 Google identities',
  '0 users with a password hash',
  'P32',
  'warn',
  'P33',
  'not backdated'
]) assert.ok(doc.includes(token),'P37 doc missing '+token);

assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('p37-certify-burnin.py'));
assert.ok(workflow.includes('p37-evaluate-promotion.py'));
assert.ok(workflow.includes('p37-build-oe-launch.py'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P37 staging workflow must be read-only.');

console.log('P37 staged current-generation certification/promotion/OE launch contract passed.');
