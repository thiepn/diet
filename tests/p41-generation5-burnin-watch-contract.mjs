import assert from 'node:assert/strict';
import fs from 'node:fs';

const watch=JSON.parse(fs.readFileSync('platform-p41-generation5-burnin-watch.json','utf8'));
const obs=JSON.parse(fs.readFileSync('platform-p41-live-epoch-observation.json','utf8'));
const receipt=JSON.parse(fs.readFileSync('platform-p41-generation5-invalidation-receipt.json','utf8'));
const samples=JSON.parse(fs.readFileSync('platform-p41-generation5-samples.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8')).post_upgrade_burn_in_policy;
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const p26=JSON.parse(fs.readFileSync('platform-p26-steady-state-plan.json','utf8'));
const fleet=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const policy=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/p41-generation5-burnin-watch.yml','utf8');
const doc=fs.readFileSync('docs/P41-GENERATION5-BURNIN-EPOCH-WATCH.md','utf8');

assert.equal(watch.phase,'P41');
assert.equal(watch.state,'generation5_invalidated_refreeze_pending_generation6');
assert.equal(watch.generation5.valid,false);
assert.equal(watch.generation5.firstEpochChangeAt,'2026-10-04T18:58:02Z');
assert.equal(watch.evidence.successfulQualifyingSamples,0);
assert.equal(watch.evidence.certificationReady,false);
assert.deepEqual(watch.epochWatch.changedFields,['migrationVersion','migrationName','migrationHead','semanticSchemaSha256']);
assert.equal(watch.generation6.candidateRevision,2);
assert.equal(watch.generation6.candidateMigration,'20261004192902_studyos_p8_checkpoint_dimension_evidence');
assert.equal(watch.generation6.earliestRefreezeAt,'2026-10-04T20:56:54.779364Z');
assert.equal(watch.generation6.latestBackupFreshForCandidate,false);
assert.equal(watch.generation6.eligibleToActivate,false);

assert.equal(obs.projectStatus,'ACTIVE_HEALTHY');
assert.equal(obs.frozenEpoch.migrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(obs.currentEpoch.migrationHead,'20261004192902_studyos_p8_checkpoint_dimension_evidence');
assert.notEqual(obs.currentEpoch.semanticSchemaSha256,obs.frozenEpoch.semanticSchemaSha256);
assert.equal(obs.currentEpoch.dietSchemaSha256,obs.frozenEpoch.semanticSchemaSha256);
assert.equal(obs.currentEpoch.gomokuRoomVersion,50);
assert.equal(obs.currentEpoch.edgeInventorySha256,obs.frozenEpoch.edgeInventorySha256);
assert.equal(obs.currentEpoch.cronInventorySha256,obs.frozenEpoch.cronInventorySha256);

assert.equal(receipt.decision,'invalidate_generation5_and_open_generation6_refreeze');
assert.equal(receipt.nextGeneration,6);
assert.equal(receipt.candidateRevision,2);
assert.equal(receipt.sourceFilesMutated,true);
assert.equal(receipt.productionMutationPerformed,false);
assert.equal(receipt.receiptId,'a82f168c21ff694cfd386395cfeb3aa936c1b3acfdcb496c2885fa708ee2c886');
assert.equal(samples.samples.length,0);

assert.equal(p25.state,'refreeze_pending');
assert.equal(p25.generation,5);
assert.equal(p25.generationState,'invalidated_epoch_changed');
assert.equal(p25.currentGenerationEligible,false);
assert.equal(p25.nextGeneration,6);
assert.equal(p25.pendingGeneration6.state,'waiting_quiet_window_and_fresh_backup');
assert.equal(p25.pendingGeneration6.candidateRevision,2);
assert.equal(p25.pendingGeneration6.latestSuccessfulBackup.freshForCandidate,false);

assert.equal(backend.state,'refreeze_pending');
assert.equal(backend.current_generation,5);
assert.equal(backend.current_generation_eligible,false);
assert.equal(backend.next_generation,6);
assert.equal(backend.generation5_state,'invalidated_epoch_changed');
assert.equal(backend.generation6_state,'waiting_quiet_window_and_fresh_backup');

assert.equal(app.health.p25BurnInActive,false);
assert.equal(app.health.p25CurrentGenerationValid,false);
assert.equal(app.health.p25NextGeneration,6);
assert.equal(app.health.p25Generation5State,'invalidated_epoch_changed');
assert.equal(app.health.p25Generation6State,'waiting_quiet_window_and_fresh_backup');

assert.equal(p26.state,'staged_pending_p25');
assert.equal(p26.currentGateSnapshot.p25State,'refreeze_pending');
assert.equal(p26.currentGateSnapshot.nextGeneration,6);
assert.equal(p26.currentGateSnapshot.generationEligible,false);

assert.equal(fleet.registryVersion,'2026-10-04.6');
assert.equal(fleet.releaseEpoch.state,'refreeze_pending_generation6_candidate_revision2');
assert.equal(fleet.releaseEpoch.sharedPromotionsBlocked,true);
assert.equal(policy.bundleVersion,'2026-10-04.6');
assert.equal(policy.fleetRegistryVersion,'2026-10-04.6');
assert.equal(policy.liveBaseline.releaseEpochState,'refreeze_pending_generation6_candidate_revision2');

assert.ok(workflow.includes('scripts/p41-evaluate-burnin-epoch.py'));
assert.ok(workflow.includes('platform-p41-generation5-invalidation-receipt.json'));
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/supabase\s+db\s+/);
for(const token of ['18:58:02Z','generation 6','revision 2','37222829955','20:56:54.779364Z','must not be certified']) {
  assert.ok(doc.includes(token),'P41 doc missing '+token);
}

console.log('P41 generation-5 burn-in epoch-watch structural contract passed.');
