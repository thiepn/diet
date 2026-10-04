import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const plan=JSON.parse(fs.readFileSync('platform-p26-steady-state-plan.json','utf8'));
const p25=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const doc=fs.readFileSync('docs/P26-STEADY-STATE-BASELINE.md','utf8');
const sql=fs.readFileSync('scripts/p26-steady-state-baseline.sql','utf8').toLowerCase();
const gateScript=fs.readFileSync('scripts/p26-activation-readiness.mjs','utf8');
const triageScript=fs.readFileSync('scripts/p26-optimization-triage.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/p26-steady-state-baseline.yml','utf8');
const publicProbe=fs.readFileSync('tests/p26-public-steady-state.py','utf8');
const promotionScript=fs.readFileSync('scripts/p26-build-promotion-plan.mjs','utf8');

assert.equal(plan.phase,'P26');
assert.ok(plan.schemaVersion>=2);
assert.equal(plan.state,'staged_pending_p25');
assert.equal(plan.activeOperationsRelease,'P25.0');
assert.equal(plan.activationRequires.p25Certification,'complete');
assert.equal(plan.activationRequires.p25Generation,'current_eligible_generation');
assert.equal(plan.activationRequires.p25MinimumBurnInHours,24);
assert.ok(plan.activationRequires.p25MinimumSuccessfulSamples>=12);
assert.equal(plan.activationRequires.p25AllSixFourHourCoverageBuckets,true);
assert.equal(plan.activationRequires.p25TerminalSampleAtOrAfterMinimumCompleteAfter,true);
assert.equal(plan.activationRequires.p25FrozenEpochUnchanged,true);
assert.equal(plan.activationRequires.historicalHostedUpgradeAttestation,'pass');
assert.equal(plan.activationRequires.postFinalSharedChangeEncryptedBackup,'success_current_freeze');
assert.equal(Object.hasOwn(plan.activationRequires,'p24PostUpgradeValidation'),false);

assert.equal(p25.generation,5);
assert.equal(p25.currentGenerationEligible,true);
assert.equal(plan.currentGateSnapshot.p25Generation,5);
assert.equal(plan.currentGateSnapshot.nextGeneration,null);
assert.equal(plan.currentGateSnapshot.generationEligible,true);
assert.equal(plan.currentGateSnapshot.timeGateMetAtSnapshot,false);
assert.equal(plan.currentGateSnapshot.activatedAt,p25.activatedAt);
assert.equal(plan.currentGateSnapshot.minimumCompleteAfter,p25.minimumCompleteAfter);
assert.equal(plan.currentGateSnapshot.latestSuccessfulEncryptedBackupRun,37222829955);
assert.equal(plan.currentGateSnapshot.successfulSamplesKnownAtScheduleChange,0);

assert.equal(plan.baselinePolicy.authoritativeOnlyAfterP25,true);
assert.ok(plan.baselinePolicy.authoritativeObservationHours>=72);
assert.ok(plan.baselinePolicy.unusedIndexMinimumObservationDays>=7);
assert.equal(plan.baselinePolicy.publicSampling.cadenceHours,4);
assert.equal(plan.baselinePolicy.publicSampling.minimumObservationHours,72);
assert.ok(plan.baselinePolicy.publicSampling.minimumScheduledSamples>=19);
assert.equal(plan.baselinePolicy.publicSampling.authoritativePhaseState,'active_observation');
assert.equal(plan.baselinePolicy.publicSampling.authoritativeOperationsRelease,'P26.0');
assert.equal(plan.baselinePolicy.publicSampling.qualifierRequiresExactPhaseIdentity,true);
assert.equal(plan.baselinePolicy.publicSampling.scheduledRunsRequireActivationReady,true);
assert.equal(plan.optimizationGuardrails.noDatabaseDdlBeforeP25Completion,true);
assert.equal(plan.optimizationGuardrails.noIndexDropsFromFreshlyResetStats,true);
assert.equal(plan.optimizationGuardrails.noSpeculativeIndexes,true);

const live=plan.liveProvisionalRefresh;
assert.ok(live.database.overallCacheHitPct>99);
assert.ok(live.database.tableBlockHitPct>99);
assert.ok(live.database.indexBlockHitPct>99);
assert.equal(live.database.deadlocks,0);
assert.equal(live.database.waitingLocks,0);
assert.equal(live.database.conflicts,0);
assert.ok(live.database.pgStatStatementsCalls>100000);
assert.ok(live.database.pgStatStatementsWeightedMeanExecMs<2);
assert.equal(live.database.repeatedSlowStatementsMeanOver100msCallsAtLeast10,1);
assert.equal(live.repeatedSlowStatement.query,'SELECT name FROM pg_timezone_names');
assert.equal(live.repeatedSlowStatement.dietRepositoryReferenceFound,false);
assert.match(live.repeatedSlowStatement.disposition,/watch_only/);
assert.equal(live.performanceAdvisor.unindexedForeignKeys,21);
assert.equal(live.performanceAdvisor.gomokuForeignKeys,19);
assert.equal(live.performanceAdvisor.microArcadeForeignKeys,2);
assert.equal(live.indexes.performanceAdvisorUnusedIndexFindings,108);
assert.equal(live.indexes.zeroScanIndexesAtLeast1MiB,0);
assert.equal(live.indexes.unusedIndexFindingsActionableNow,false);
assert.equal(live.service24h.edgeGateway.rest.http5xx,0);
assert.equal(live.service24h.edgeGateway.auth.http5xx,0);
assert.ok(live.service24h.edgeGateway.rest.p95OriginMs<450);
assert.ok(live.service24h.edgeGateway.auth.p95OriginMs<1422);
assert.equal(live.service24h.authService.http5xx,0);
assert.ok(live.service24h.authService.p95Ms<100);
assert.equal(live.service24h.postgrestDiagnostics.timeoutManagerMessages,170);
assert.equal(live.service24h.postgrestDiagnostics.userFacingEdge5xxObserved,0);

for(const token of [
  'P26 is **staged, not active**',
  '2026-10-05 12:55:17 UTC',
  'historical hosted-upgrade attestation',
  'No database DDL while P25 is still burning in',
  'at least 72 hours',
  'at least seven days',
  '99.9657%',
  'SELECT name FROM pg_timezone_names',
  '21 unindexed foreign keys',
  '108 unused indexes',
  '23,359',
  '326 ms',
  '619 ms',
  '170',
  'zero 5xx'
]) assert.ok(doc.includes(token),'P26 doc missing '+token);

for(const banned of [
  /\bcreate\s+(table|index|function|view|policy)\b/,
  /\balter\s+(table|function|role|database|system)\b/,
  /\bdrop\s+(table|index|function|view|policy)\b/,
  /\binsert\s+into\b/,
  /\bupdate\s+[^
]+\s+set\b/,
  /\bdelete\s+from\b/,
  /\btruncate\b/,
  /\breindex\b/,
  /\bvacuum\b/,
  /pg_stat_statements_reset/
]) assert.doesNotMatch(sql,banned,'P26 baseline SQL must remain read-only/non-resetting.');

for(const required of [
  'pg_stat_database','pg_statio_user_indexes','pg_statio_user_tables',
  'pg_stat_activity','pg_locks','pg_stat_statements','pg_stat_statements_info'
]) assert.ok(sql.includes(required),'P26 baseline SQL missing '+required);

for(const required of [
  '--require-ready','p25_not_certified','minimum_window_open',
  'historicalHostedUpgradeAttestation','postFinalChangeEncryptedBackupVerified',
  'frozen_epoch_changed'
]) assert.ok(gateScript.includes(required),'P26 activation gate missing '+required);

for(const required of [
  'automaticWritesAllowed=false','unused-indexes','unindexed-foreign-keys',
  'postgrest-timeout-manager','temp-io','observe_and_measure'
]) assert.ok(triageScript.includes(required),'P26 optimization triage missing '+required);

for(const required of [
  "cron: '23 */4 * * *'",
  'scripts/p26-activation-readiness.mjs --require-ready',
  'p26-optimization-triage.json',
  'p26-public-steady-state.json'
]) assert.ok(workflow.includes(required),'P26 sampling workflow missing '+required);

assert.ok(publicProbe.includes('platform-p26-steady-state-plan.json'));
assert.ok(publicProbe.includes('"state":plan.get("state","unknown")'));
assert.ok(publicProbe.includes('"activeOperationsRelease":plan.get("activeOperationsRelease")'));

for(const required of [
  'active_observation','P26.0','earliestAuthoritativeBaselineCompleteAt',
  'mutationsAllowed:false','optimizationTriage.automaticWritesAllowed=false'
]) assert.ok(promotionScript.includes(required),'P26 promotion plan missing '+required);

const sampleDir='p26-public-samples.test';
const summaryOut='p26-public-baseline-summary.test.json';
try {
  fs.mkdirSync(sampleDir,{recursive:true});
  const start=Date.parse('2026-10-04T00:00:00Z');
  for(let i=0;i<19;i++){
    const checkedAt=new Date(start+i*4*60*60*1000).toISOString().replace('.000Z','Z');
    const sample={
      schemaVersion:1,
      phase:'P26',
      state:'active_observation',
      activeOperationsRelease:'P26.0',
      checkedAt,
      passed:true,
      performanceWarning:false,
      thresholds:{authInternalWarningMs:1422,databaseInternalWarningMs:2100},
      checks:[
        {name:'diet_shell',passed:true,status:200,endToEndLatencyMs:100+i},
        {name:'auth_health',passed:true,status:200,endToEndLatencyMs:80+i},
        {name:'platform_health',passed:true,status:200,platformStatus:'healthy',endToEndLatencyMs:150+i,authLatencyMs:300+i,databaseLatencyMs:500+i}
      ]
    };
    fs.writeFileSync(`${sampleDir}/p26-public-steady-state-${String(i).padStart(2,'0')}.json`,JSON.stringify(sample));
  }
  execFileSync('python',[
    'scripts/p26-summarize-public-samples.py',
    sampleDir,
    '--out',summaryOut
  ],{stdio:'pipe'});
  const summary=JSON.parse(fs.readFileSync(summaryOut,'utf8'));
  assert.equal(summary.qualification.qualified,true);
  assert.equal(summary.qualification.sampleCountMet,true);
  assert.equal(summary.qualification.spanMet,true);
  assert.equal(summary.qualification.requiredPhaseStateMet,true);
  assert.equal(summary.qualification.requiredOperationsReleaseMet,true);
  assert.equal(summary.window.sampleCount,19);
  assert.equal(summary.window.spanHours,72);
} finally {
  fs.rmSync(sampleDir,{recursive:true,force:true});
  fs.rmSync(summaryOut,{force:true});
}

const promotionP25='p26-promotion-p25.test.json';
const promotionP26='p26-promotion-p26.test.json';
const promotionOut='p26-promotion-plan.test.json';
try {
  const readyP25=structuredClone(p25);
  readyP25.completionState={...(readyP25.completionState||{}),complete:true,remaining:[]};
  readyP25.currentGenerationEligible=true;
  readyP25.state='burn_in_active';
  readyP25.generationState='burn_in_active';
  readyP25.generation=5;
  readyP25.nextGeneration=null;
  readyP25.activatedAt='2026-10-04T18:30:00Z';
  readyP25.minimumCompleteAfter='2026-10-05T18:30:00Z';
  readyP25.historicalHostedUpgradeAttestation={...(readyP25.historicalHostedUpgradeAttestation||{}),status:'pass'};
  readyP25.latestPostUpgradeOffsiteBackup={
    ...(readyP25.latestPostUpgradeOffsiteBackup||{}),
    conclusion:'success',afterLatestDatabaseMigration:true,afterLatestEdgeDeployment:true
  };
  readyP25.currentEpochFreezeEvidence={
    ...(readyP25.currentEpochFreezeEvidence||{}),
    p18Integrity:'clean',p20SchemaDrift:false,p21Readiness:'pass',p22Maintenance:'pass',
    securityAdvisorReviewed:true,performanceAdvisorReviewed:true,postFinalChangeEncryptedBackupVerified:true
  };
  readyP25.latestObservedEpoch={
    ...(readyP25.latestObservedEpoch||{}),
    migrationVersion:readyP25.currentEpochFreezeEvidence.migrationVersion,
    semanticSchemaSha256:readyP25.currentEpochFreezeEvidence.semanticSchemaSha256,
    gomokuRoomVersion:readyP25.currentEpochFreezeEvidence.gomokuRoomVersion,
    gomokuRoomSha256:readyP25.currentEpochFreezeEvidence.gomokuRoomSha256
  };
  fs.writeFileSync(promotionP25,JSON.stringify(readyP25));
  fs.writeFileSync(promotionP26,JSON.stringify(plan));
  execFileSync(process.execPath,[
    'scripts/p26-build-promotion-plan.mjs',
    '--p25',promotionP25,
    '--p26',promotionP26,
    '--at','2026-10-05T18:35:00Z',
    '--out',promotionOut
  ],{stdio:'pipe'});
  const promotion=JSON.parse(fs.readFileSync(promotionOut,'utf8'));
  assert.equal(promotion.readyForPromotion,true);
  assert.equal(promotion.mutationsAllowed,false);
  assert.equal(promotion.proposedMetadata.state,'active_observation');
  assert.equal(promotion.proposedMetadata.activeOperationsRelease,'P26.0');
  assert.equal(promotion.proposedMetadata.minimumPublicSamples,19);
  assert.equal(promotion.proposedMetadata.publicSampleCadenceHours,4);
  assert.equal(promotion.proposedMetadata.earliestAuthoritativeBaselineCompleteAt,'2026-10-08T18:35:00.000Z');
} finally {
  fs.rmSync(promotionP25,{force:true});
  fs.rmSync(promotionP26,{force:true});
  fs.rmSync(promotionOut,{force:true});
}

const triageOut='p26-optimization-triage.test.json';
try {
  execFileSync(process.execPath,[
    'scripts/p26-optimization-triage.mjs',
    '--out',triageOut
  ],{stdio:'pipe'});
  const triage=JSON.parse(fs.readFileSync(triageOut,'utf8'));
  assert.equal(triage.automaticWritesAllowed,false);
  assert.equal(triage.decision,'observe_and_measure');
  assert.equal(triage.summary.actionableNow,0);
  assert.ok(triage.findings.some(x=>x.id==='db-lock-health' && x.state==='healthy'));
  assert.ok(triage.findings.some(x=>x.id==='service-errors' && x.state==='healthy'));
  assert.ok(triage.findings.some(x=>x.id==='unused-indexes' && x.state==='blocked'));
  assert.ok(triage.findings.some(x=>x.id==='unindexed-foreign-keys' && x.state==='measure'));
  assert.ok(triage.findings.some(x=>x.id==='postgrest-timeout-manager' && x.state==='watch'));
} finally {
  fs.rmSync(triageOut,{force:true});
}

const testOut='p26-activation-readiness.test.json';
try {
  execFileSync(process.execPath,[
    'scripts/p26-activation-readiness.mjs',
    '--at','2026-10-04T16:30:00Z',
    '--out',testOut
  ],{stdio:'pipe'});
  const report=JSON.parse(fs.readFileSync(testOut,'utf8'));
  assert.equal(report.ready,false);
  assert.equal(report.state,'staged_pending_p25');
  assert.ok(report.blockers.some(x=>x.code==='p25_not_certified'));
  assert.ok(report.blockers.some(x=>x.code==='minimum_window_open'));
} finally {
  fs.rmSync(testOut,{force:true});
}

console.log('P26 staged steady-state contract passed; activation follows the current eligible P25 generation.');
