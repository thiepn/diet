import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p38-generation5-refreeze-plan.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/p38-generation5-burnin.yml','utf8');
const doc=fs.readFileSync('docs/P38-GENERATION5-REFREEZE-BURNIN.md','utf8');
const activate=fs.readFileSync('scripts/p38-activate-generation5.py','utf8');
const progress=fs.readFileSync('scripts/p38-burnin-progress.py','utf8');

assert.equal(plan.phase,'P38');
assert.equal(plan.schemaVersion,1);
assert.equal(plan.state,'operationally_activated_generation5_burn_in_active');
assert.equal(plan.sourceMainSha,'8ca191a7939b840c028e1c317fa0d3468bc49c07');
assert.equal(plan.operatorOverride.doesNotAuthorizeGenerationActivation,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeBackupFabrication,true);
assert.equal(plan.liveObservation.projectStatus,'ACTIVE_HEALTHY');
assert.equal(plan.liveObservation.migrationHead,'20261004132839_gomoku_p21_capacity_admission_gate');
assert.equal(plan.liveObservation.edgeFunctionCount,12);
assert.equal(plan.liveObservation.gomokuRoom.version,49);
assert.equal(plan.liveObservation.microArcadeBackup.version,2);
assert.equal(plan.currentRefreezeStatus.quietMinutesObserved,75.38);
assert.equal(plan.currentRefreezeStatus.minimumQuietMinutes,60);
assert.equal(plan.currentRefreezeStatus.postFinalChangeEncryptedBackupVerified,true);
assert.equal(plan.currentRefreezeStatus.decision,'activated');
assert.equal(plan.burnInEvidenceContinuity.minimumSuccessfulSamples,12);
assert.equal(plan.burnInEvidenceContinuity.requiredCoverageBuckets,6);
assert.equal(plan.burnInEvidenceContinuity.preActivationSamplesCount,false);
assert.equal(plan.automationBoundary.mayCommitActivationAutomatically,false);
assert.equal(plan.automationBoundary.productionMutationAllowed,false);

assert.equal(p25.state,'refreeze_pending');
assert.equal(p25.generation,5);
assert.equal(p25.nextGeneration,6);
assert.equal(p25.currentGenerationEligible,false);
assert.equal(p25.pendingGeneration5.edgeQuietMinutesObserved,75.38);
assert.equal(p25.pendingGeneration5.candidateRevision,2);
assert.equal(p25.pendingGeneration5.lastDecision,'activated');
assert.equal(p25.pendingGeneration5.state,'activated');
assert.equal(p25.pendingGeneration5.postFinalChangeEncryptedBackupVerified,true);

for(const token of [
  'ready_to_commit_generation5_activation',
  'sourceFilesMutated',
  'postFinalChangeEncryptedBackupVerified',
  'currentGenerationEligible'
]) assert.ok(activate.includes(token),'activation engine missing '+token);

for(const token of [
  'qualifiesForBurnIn',
  'duplicate_sample',
  'wrong_generation',
  'pre_activation',
  'missing_coverage_buckets',
  'readyForP37Certification'
]) assert.ok(progress.includes(token),'progress engine missing '+token);

for(const token of [
  'generation 5 is not active',
  '41.79',
  '60-minute',
  'post-final-change encrypted backup',
  'preview-only',
  'wrong-generation',
  'pre-activation',
  'duplicate',
  'P37 certification',
  'not start OE'
]) assert.ok(doc.includes(token),'P38 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p38-activate-generation5.py'));
assert.ok(workflow.includes('p38-burnin-progress.py'));
assert.ok(workflow.includes('p37-evaluate-refreeze.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);

console.log('P38 structural refreeze and evidence-continuity contract passed.');
