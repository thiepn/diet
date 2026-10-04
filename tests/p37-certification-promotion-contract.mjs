import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p37-certification-promotion-launch-plan.json','utf8'));
const risk=JSON.parse(fs.readFileSync('platform-p37-d001-risk-treatment.json','utf8'));
const target=JSON.parse(fs.readFileSync('platform-p37-governance-activation-target.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('contracts/p37-governance-stack-manifest.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const releases=JSON.parse(fs.readFileSync('platform-p31-release-registry.json','utf8'));
const policy=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const doc=fs.readFileSync('docs/P37-BURNIN-PROMOTION-OE-LAUNCH.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p37-certification-promotion-staging.yml','utf8');

assert.equal(plan.phase,'P37');
assert.equal(plan.schemaVersion,2);
assert.equal(plan.state,'implementation_active_generation5_burn_in');
assert.equal(plan.operatorOverride.doesNotAuthorizeBurnInCertification,true);
assert.equal(plan.operatorOverride.doesNotAuthorizeRiskAcceptance,true);
assert.equal(plan.currentReality.p26ThroughP36AlreadyMerged,true);
assert.equal(plan.currentReality.governanceStackRequiresRePromotion,false);
assert.equal(plan.currentReality.generation4Invalidated,true);
assert.equal(plan.currentReality.nextGeneration,null);
assert.equal(plan.currentReality.oePeriodStarted,false);
assert.equal(plan.liveEpoch.migrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(plan.liveEpoch.gomokuRoom.version,50);
assert.equal(plan.liveEpoch.microArcadeBackup.version,2);
assert.equal(plan.refreezeGate.currentDecision,'activated_generation5');
assert.equal(plan.refreezeGate.postFinalSharedChangeEncryptedBackupVerified,true);
assert.equal(plan.d001.riskAcceptanceAuthorized,false);
assert.equal(plan.oeLaunch.state,'blocked');

assert.equal(p25.state,'refreeze_pending');
assert.equal(p25.generation,5);
assert.equal(p25.generationState,'invalidated_epoch_changed');
assert.equal(p25.currentGenerationEligible,false);
assert.equal(p25.nextGeneration,6);
assert.equal(p25.pendingGeneration5.state,'activated');

assert.equal(fleet.registryVersion,'2026-10-04.6');
assert.equal(fleet.releaseEpoch.state,'refreeze_pending_generation6_candidate_revision2');
assert.equal(fleet.releaseEpoch.edgeHighlights.gomokuRoom.version,50);
assert.equal(fleet.releaseEpoch.edgeHighlights.microArcadeBackup.version,2);
assert.equal(fleet.coverage.dependencyGraphCoveragePct,100);
assert.equal(fleet.coverage.registeredAppGovernanceCoveragePct,100);
assert.equal(releases.registryVersion,'2026-10-04.2');
assert.equal(releases.latestMergedGovernancePhase,'P36');
assert.equal(releases.latestMergedMainSha,'c8c374917d739c971fe142cf16c3449d6c64e8cd');
assert.equal(releases.phases.at(-1).id,'P36');
assert.equal(policy.bundleVersion,'2026-10-04.5');
assert.equal(policy.mode,'warn');
assert.equal(policy.liveBaseline.releaseEpochState,'refreeze_pending_generation6_candidate_revision1');

assert.equal(risk.state,'prepared_pending_independent_risk_approval');
assert.equal(risk.liveEvidence.passwordAuthUsers,0);
assert.equal(risk.liveEvidence.googleIdentityUsers,11);
assert.equal(risk.permanentClosure,false);
assert.equal(risk.paidPlanUpgradeAuthorized,false);
assert.equal(risk.riskAcceptanceAuthorized,false);

assert.equal(target.state,'prepared_launch_blocked');
assert.equal(target.current.p32Mode,'warn');
assert.equal(target.current.p34D001,'decision_required');
assert.equal(target.current.p34D006,'remediating_generation5_required');
assert.equal(target.current.oePeriodStarted,false);

assert.deepEqual(manifest.phases.map(x=>x.phase),Array.from({length:11},(_,i)=>'P'+(26+i)));
assert.equal(manifest.phases.at(-1).mergeSha,'c8c374917d739c971fe142cf16c3449d6c64e8cd');
assert.equal(manifest.policy.rePromotionForbidden,true);
assert.equal(manifest.expectedLatestMergedGovernancePhase,'P36');

for(const token of [
  'engineering-active',
  'generation 4 is invalidated',
  'generation 5',
  'gomoku_p21_capacity_admission_gate',
  'v49',
  'micro-arcade-p31-backup-export',
  '60-minute',
  'P26–P36 are already merged',
  '11 Google',
  '0 password-auth',
  'independent',
  'not backdated',
  'OE is not started'
]) assert.ok(doc.includes(token),'P37 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p37-evaluate-refreeze.py'));
assert.ok(workflow.includes('p37-certify-burnin.py'));
assert.ok(workflow.includes('p37-certify-governance-stack.py'));
assert.ok(workflow.includes('p37-build-oe-launch.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);

console.log('P37 structural current-state contract passed.');
