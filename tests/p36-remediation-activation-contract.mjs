import assert from 'node:assert/strict';
import fs from 'node:fs';

const rem=JSON.parse(fs.readFileSync('platform-p36-remediation-execution.json','utf8'));
const freeze=JSON.parse(fs.readFileSync('platform-p36-stable-epoch-freeze.json','utf8'));
const oe=JSON.parse(fs.readFileSync('platform-p36-operating-effectiveness-state.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const p28=JSON.parse(fs.readFileSync('platform-p28-resource-ownership.json','utf8'));
const p29=JSON.parse(fs.readFileSync('platform-p29-dependency-graph.json','utf8'));
const p31=JSON.parse(fs.readFileSync('platform-p31-fleet-registry.json','utf8'));
const rr=JSON.parse(fs.readFileSync('platform-p31-release-registry.json','utf8'));
const p32=JSON.parse(fs.readFileSync('platform-p32-policy-bundle.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const doc=fs.readFileSync('docs/P36-REMEDIATION-FREEZE-OE-ACTIVATION.md','utf8');
const workflow=fs.readFileSync('.github/workflows/p36-remediation-freeze-oe-staging.yml','utf8');

assert.equal(rem.phase,'P36');
assert.equal(rem.schemaVersion,2);
assert.equal(rem.state,'partial_remediation_executed');
assert.equal(rem.productionMutationPerformed,false);
assert.equal(rem.governanceMutations.semesterOsOnboarded,true);
assert.equal(rem.governanceMutations.p29Nodes,18);
assert.equal(rem.governanceMutations.p29Edges,51);
assert.equal(rem.governanceMutations.p31DependencyCoveragePct,100);
assert.equal(rem.governanceMutations.p31RegisteredAppGovernanceCoveragePct,100);
assert.equal(rem.governanceMutations.p32Mode,'warn');
assert.equal(rem.executedDispositions.find(x=>x.deficiencyId==='P34-D005').state,'closed');
assert.equal(rem.executedDispositions.find(x=>x.deficiencyId==='P34-D002').state,'remediating');
assert.equal(rem.executedDispositions.find(x=>x.deficiencyId==='P34-D003').state,'ready_for_retest');
assert.equal(rem.executedDispositions.find(x=>x.deficiencyId==='P34-D006').generation,4);
assert.equal(rem.closureRules.noAutomaticRiskAcceptance,true);
assert.equal(rem.closureRules.noAutomaticDeficiencyClosure,true);

assert.equal(freeze.phase,'P36');
assert.equal(freeze.schemaVersion,2);
assert.equal(freeze.state,'frozen_burn_in_active');
assert.equal(freeze.generation,4);
assert.equal(freeze.previousGeneration.generation,3);
assert.equal(freeze.previousGeneration.state,'invalidated');
assert.equal(freeze.frozenEpoch.migrationHead,'20261003221217_hub_h15_tms60_projection');
assert.equal(freeze.frozenEpoch.semanticSchemaSha256,'5b7b1caddef09b97f59c85d79d04eabfbe55120fe1754340a7367c1b14d39375');
assert.equal(freeze.frozenEpoch.edgeFunctionCount,12);
assert.equal(freeze.frozenEpoch.gomokuRoomVersion,48);
assert.equal(freeze.frozenEpoch.cronJobs,14);
assert.equal(freeze.quietEvidence.satisfied,true);
assert.equal(freeze.quietEvidence.migrationQuietMinutes,883);
assert.equal(freeze.quietEvidence.edgeQuietMinutes,1536);
assert.equal(freeze.operationalEvidence.cronRuns24h,5791);
assert.equal(freeze.operationalEvidence.cronFailures24h,0);
assert.equal(freeze.operationalEvidence.blockingReplicationSlots,0);
assert.equal(freeze.operationalEvidence.p18Integrity,'clean');
assert.equal(freeze.operationalEvidence.p20SchemaDrift,false);
assert.equal(freeze.operationalEvidence.p21Readiness,'pass');
assert.equal(freeze.operationalEvidence.p22Maintenance,'pass');
assert.equal(freeze.backupEvidence.postFinalSharedChangeEncryptedBackupVerified,false);
assert.equal(freeze.certified,false);

assert.equal(oe.phase,'P36');
assert.equal(oe.state,'armed_waiting_generation4_and_high_deficiency_gate');
assert.equal(oe.active,false);
assert.equal(oe.activationIsRetroactive,false);
assert.equal(oe.freezeGeneration,4);
assert.equal(oe.activationGates.generation4EpochMatches,true);
assert.equal(oe.activationGates.p34D005Closed,true);
assert.equal(oe.activationGates.p34D002DispositionedOrRemediating,true);
assert.equal(oe.activationGates.p34D001Dispositioned,false);
assert.equal(oe.activationGates.p32ModeAtLeastWarn,true);
assert.equal(oe.activationGates.p33CanonicalEvidenceActive,true);
assert.equal(oe.externalAttestation,false);

assert.equal(p25.generation,5);
assert.equal(p25.state,'refreeze_pending');
assert.equal(p25.currentGenerationEligible,false);
assert.equal(p25.nextGeneration,6);
assert.equal(p25.generation4Invalidation.generation,4);
assert.equal(p25.previousGeneration.generation,4);
assert.equal(p25.previousGeneration.invalidated,true);
assert.notEqual(p25.currentEpochFreezeEvidence.migrationHead,freeze.frozenEpoch.migrationHead);
assert.notEqual(p25.latestObservedEpoch.migrationHead,freeze.frozenEpoch.migrationHead);
assert.equal(p25.currentEpochFreezeEvidence.gomokuRoomVersion,50);
assert.equal(p25.currentEpochFreezeEvidence.cronJobs,14);
assert.equal(p25.currentEpochFreezeEvidence.postFinalChangeEncryptedBackupVerified,true);

assert.equal(p28.registeredApps.length,7);
assert.ok(p28.registeredApps.some(x=>x.id==='semester-os'&&x.owner==='thiepn'));
assert.equal(p29.graphVersion,'2026-10-04.1');
assert.equal(p29.nodes.length,18);
assert.equal(p29.edges.length,51);
assert.equal(p29.edges.filter(x=>x.consumer==='semester-os').length,4);
assert.equal(p31.registryVersion,'2026-10-04.6');
assert.equal(p31.coverage.dependencyGraphCoveragePct,100);
assert.equal(p31.coverage.registeredAppGovernanceCoveragePct,100);
assert.equal(p31.components.find(x=>x.id==='semester-os').governance,'governed');
assert.ok(!p31.observedDrift.some(x=>x.id==='p29-graph-missing-semester-os'));
assert.equal(rr.registryVersion,'2026-10-04.2');
assert.equal(rr.latestMergedGovernancePhase,'P36');
assert.equal(rr.latestMergedMainSha,'c8c374917d739c971fe142cf16c3449d6c64e8cd');
for(const id of ['P31','P32','P33','P34','P35','P36']) assert.equal(rr.phases.find(x=>x.id===id).state,'merged_operator_override');

assert.equal(p32.mode,'warn');
assert.equal(p32.bundleVersion,'2026-10-04.6');
assert.equal(p32.fleetRegistryVersion,'2026-10-04.5');
assert.equal(p32.releaseRegistryVersion,'2026-10-04.2');
assert.equal(p32.dependencyGraphVersion,'2026-10-04.1');
assert.deepEqual(p32.liveBaseline.unmodeledComponents,[]);
assert.equal(p32.liveBaseline.dependencyGraphCoveragePct,100);
assert.equal(p32.liveBaseline.registeredAppGovernanceCoveragePct,100);

assert.equal(app.health.p25BurnInGeneration,5);
assert.equal(app.health.p25FrozenMigrationHead,'20261004173117_gomoku_p23_security_admission_gate');
assert.equal(app.health.p25FrozenGomokuEdgeVersion,50);
assert.equal(app.health.p25FrozenCronJobCount,14);
assert.equal(app.health.p25Generation4BackupPrerequisiteSatisfied,false);
assert.equal(app.health.p25CurrentGenerationValid,false);
assert.equal(app.health.p25NextGeneration,6);

for(const token of [
  'active by explicit operator override',
  'generation 4',
  'hub_h15_tms60_projection',
  '18/18',
  '7/7',
  'P34-D005',
  'P34-D001',
  '47',
  '73',
  '38',
  '883',
  '1536',
  '5,791',
  'post-final-shared-change backup',
  'six 4-hour',
  'not backdated',
  'warn mode',
  'not started',
  'not an external attestation'
]) assert.ok(doc.includes(token),'P36 doc missing '+token);

assert.ok(workflow.includes('pull_request'));
assert.ok(workflow.includes('workflow_dispatch'));
assert.ok(workflow.includes('p36-evaluate-activation.py'));
assert.ok(workflow.includes('p36-activate-oe.py'));
assert.ok(workflow.includes('current-p36-observation.json'));
assert.doesNotMatch(workflow,/contents:\s*write/,'P36 workflow must stay read-only.');

console.log('P36 remediation, stable-epoch freeze and OE activation structural contract passed.');
