import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync('platform-p40-generation5-activation-plan.json','utf8'));
const obs=JSON.parse(fs.readFileSync('platform-p40-live-refreeze-observation.json','utf8'));
const decision=JSON.parse(fs.readFileSync('platform-p40-refreeze-decision.json','utf8'));
const receipt=JSON.parse(fs.readFileSync('platform-p40-generation5-activation-receipt.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8')).post_upgrade_burn_in_policy;
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const p26=JSON.parse(fs.readFileSync('platform-p26-steady-state-plan.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const policy=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const doc=fs.readFileSync('docs/P40-GENERATION5-ACTIVATION-BURNIN.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p40-generation5-activation.yml','utf8');

assert.equal(plan.phase,'P40');
assert.equal(plan.state,'generation5_burn_in_active');
assert.equal(plan.generation,5);
assert.equal(plan.candidateRevision,2);
assert.equal(plan.activatedAt,'2026-10-04T18:52:01.712991Z');
assert.equal(plan.minimumCompleteAfter,'2026-10-05T18:52:01.712991Z');
assert.equal(plan.refreezeEvidence.quietMinutesObserved,75.38);
assert.equal(plan.backupEvidence.runId,37222829955);
assert.equal(plan.backupEvidence.verificationPassed,true);
assert.equal(plan.publicHealthEvidence.runId,37224033250);
assert.equal(plan.currentState.burnInCertified,false);
assert.equal(plan.currentState.oeStarted,false);

assert.equal(obs.projectStatus,'ACTIVE_HEALTHY');
assert.equal(obs.migrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(obs.gomokuRoomVersion,50);
assert.equal(obs.postFinalSharedChangeBackupVerified,true);
assert.equal(obs.crossAppSmokePassed,true);
assert.equal(obs.storageHealthy,true);
assert.equal(obs.backup.runId,37222829955);

assert.equal(decision.decision,'ready_to_activate_generation5');
assert.equal(decision.generation,5);
assert.equal(decision.errors.length,0);
assert.equal(decision.quietMinutesObserved,75.38);
assert.equal(decision.frozenEpoch.postFinalChangeEncryptedBackupVerified,true);
assert.equal(decision.decisionId,'4153ec4f7fc90a3afcacc59e61e7fcd78e571b2b2aa5012caa175920f0547e78');

assert.equal(receipt.decision,'ready_to_commit_generation5_activation');
assert.equal(receipt.generation,5);
assert.equal(receipt.sourceFilesMutated,true);
assert.equal(receipt.productionMutationPerformed,false);
assert.equal(receipt.activationReceiptId,'8e24ecd727550f365aacabeb7d59a7b18ed9d07322ef8929f8d6ddb48df3badd');

assert.equal(p25.state,'burn_in_active');
assert.equal(p25.generation,5);
assert.equal(p25.currentGenerationEligible,true);
assert.equal(p25.nextGeneration,null);
assert.equal(p25.currentEpochFreezeEvidence.gomokuRoomVersion,50);
assert.equal(p25.currentEpochFreezeEvidence.postFinalChangeEncryptedBackupVerified,true);
assert.equal(p25.pendingGeneration5.state,'activated');
assert.equal(p25.latestSuccessfulEncryptedOffsiteBackup.runId,37222829955);

assert.equal(backend.state,'burn_in_active');
assert.equal(backend.current_generation,5);
assert.equal(backend.current_generation_eligible,true);
assert.equal(backend.next_generation,null);
assert.equal(backend.generation5_backup_prerequisite_satisfied,true);

assert.equal(app.health.p25BurnInActive,true);
assert.equal(app.health.p25CurrentGenerationValid,true);
assert.equal(app.health.p25BurnInGeneration,5);
assert.equal(app.health.p25Generation5State,'burn_in_active');

assert.equal(p26.state,'staged_pending_p25');
assert.equal(p26.currentGateSnapshot.p25Generation,5);
assert.equal(p26.currentGateSnapshot.generationEligible,true);
assert.equal(p26.currentGateSnapshot.timeGateMetAtSnapshot,false);

assert.equal(fleet.registryVersion,'2026-10-04.4');
assert.equal(fleet.releaseEpoch.state,'generation5_burn_in_active');
assert.equal(fleet.releaseEpoch.sharedPromotionsBlocked,true);
assert.equal(policy.bundleVersion,'2026-10-04.4');
assert.equal(policy.mode,'warn');
assert.equal(policy.liveBaseline.releaseEpochState,'generation5_burn_in_active');

for(const token of [
  '75.38 minutes','37222829955','37224033250',
  'generation-5 burn-in','not yet certified','pre-activation samples',
  '2026-10-05T18:52:01.712991Z'
]) assert.ok(doc.includes(token),'P40 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('tests/p40-generation5-activation-contract.py'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);

console.log('P40 generation-5 activation structural contract passed.');
