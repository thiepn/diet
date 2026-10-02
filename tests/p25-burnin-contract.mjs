import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseline=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const doc=fs.readFileSync('docs/P25-POST-UPGRADE-BURN-IN.md','utf8');
const probe=fs.readFileSync('tests/p25-public-burnin.py','utf8');
const workflow=fs.readFileSync('.github/workflows/p25-post-upgrade-burnin.yml','utf8');
const migration=fs.readFileSync('supabase/migrations/20261001121450_platform_p24_post_upgrade_hosted_build_validation.sql','utf8');

assert.equal(baseline.phase,'P25');
assert.equal(baseline.state,'burn_in_active');
assert.equal(baseline.generation,3);
assert.equal(baseline.generationState,'burn_in_active');
assert.equal(baseline.currentGenerationEligible,true);
assert.equal(baseline.nextGeneration,null);
assert.equal(baseline.invalidationEvidence.observedMigrationName,'gomoku_p17_release_environments_preview_promotion');
assert.equal(baseline.invalidationEvidence.observedGomokuRoomVersion,43);
assert.equal(baseline.refreezePolicy.minimumQuietMinutes,60);
assert.equal(baseline.latestObservedEpoch.migrationName,'gomoku_p17_certification_health_isolation');
assert.equal(baseline.latestObservedEpoch.gomokuRoomVersion,45);
assert.equal(baseline.latestPostUpgradeOffsiteBackup.sufficientForGeneration3Refreeze,true);
assert.equal(baseline.latestPostUpgradeOffsiteBackup.runId,37040772134);
assert.equal(baseline.latestObservedEpoch.migrationVersion,'20261002172133');
assert.equal(baseline.latestObservedEpoch.gomokuRoomVersion,45);
assert.equal(baseline.currentEpochFreezeEvidence.migrationHead,'20261002172133_gomoku_p17_certification_health_isolation');
assert.equal(baseline.currentEpochFreezeEvidence.gomokuRoomVersion,45);
assert.equal(baseline.currentEpochFreezeEvidence.cronJobs,11);
assert.equal(baseline.currentEpochFreezeEvidence.cronFailures24h,0);
assert.equal(baseline.currentEpochFreezeEvidence.edgeFunctionCount,11);
assert.equal(baseline.currentEpochFreezeEvidence.edgeFunctionsAllActive,true);
assert.equal(baseline.currentEpochFreezeEvidence.postgres1711Hazards.applicationRegTypeColumns,0);
assert.equal(baseline.currentEpochFreezeEvidence.postgres1711Hazards.md5LoginRoles,0);
assert.equal(baseline.currentEpochFreezeEvidence.hostedUpgradeRegressionDetected,false);
assert.equal(baseline.burnInRequirements.requireFrozenReleaseEpoch,true);
assert.equal(baseline.burnInRequirements.requireNoSharedEpochChangeDuringWindow,true);
assert.equal(baseline.burnInRequirements.requireCurrentP24ValidatorPass,false);
assert.equal(baseline.activationEvidence.p24PostUpgradeValidation,'pass');
assert.equal(baseline.activationEvidence.managedHostedBuildBefore,'17.6.1.127');
assert.equal(baseline.activationEvidence.managedHostedBuildAfter,'17.6.1.164');
assert.equal(baseline.activationEvidence.postgresServerVersion,'17.6');
assert.equal(baseline.activationEvidence.postgres1711CompatibilityBaselineMet,false);
assert.equal(baseline.activationEvidence.postgres1711TrackedSeparately,true);
assert.equal(baseline.activationEvidence.semanticFingerprintFormat,'platform-p23-shared-schema-v2');
assert.match(baseline.activationEvidence.semanticSchemaSha256,/^[0-9a-f]{64}$/);
assert.equal(baseline.activationEvidence.applicationSurfaceCountsMatchPreUpgrade,true);
assert.equal(baseline.activationEvidence.p18Integrity,'clean');
assert.equal(baseline.activationEvidence.p20SchemaDrift,false);
assert.equal(baseline.activationEvidence.p21Readiness,'pass');
assert.equal(baseline.activationEvidence.p22Maintenance,'pass');
assert.equal(baseline.completionState.complete,false);
assert.equal(baseline.burnInRequirements.minimumHours,24);
assert.ok(baseline.burnInRequirements.minimumHourlyPublicSamples>=12);
assert.equal(baseline.burnInRequirements.requireSuccessfulPostUpgradeOffsiteBackup,true);
assert.equal(baseline.preUpgradeHealthBaseline.allSamplesHealthy,true);

for(const token of [
  'P25 is **active**',
  'Generation 2',
  'minimum 24-hour burn-in',
  '17.6.1.127',
  '17.6.1.164',
  'platform-p23-shared-schema-v2',
  'gomoku_p16_certification_null_fix',
  'gomoku_p17_release_environments_preview_promotion',
  'generation 3',
  'gomoku_p17_certification_health_isolation',
  'Generation 3 is **active but not yet certifiable**',
  'P18 remains clean',
  'P20 remains drift-free',
  'P21 remains pass',
  'P22 remains pass'
]) assert.ok(doc.includes(token),'P25 document missing '+token);

for(const token of [
  'platform-health',
  'platform_p23_upgrade_status',
  'platform_p24_execution_status',
  'platform_p24_post_upgrade_status',
  'performanceWarning'
]) assert.ok(probe.includes(token),'P25 probe missing '+token);

for(const token of [
  'platform-p23-shared-schema-v2',
  'jsonb_agg(r.rolname',
  'platform_managed_upgrade_events',
  'platform_p24_post_upgrade_validation',
  'platform_p24_post_upgrade_status'
]) assert.ok(migration.includes(token),'P24 post-upgrade migration missing '+token);

assert.ok(workflow.includes("cron: '17 * * * *'"));
assert.ok(workflow.includes("cron: '7,27,47 * * * *'"));
assert.equal(baseline.generation3Sampling.evidenceRuleUnchanged,true);
assert.equal(baseline.generation3Sampling.nominalTriggerOpportunitiesPerHour,4);
assert.equal(baseline.generation3Sampling.minimumCoverageBuckets,6);
assert.ok(workflow.includes('p25-public-burnin.py'));
assert.ok(workflow.includes('retention-days: 30'));

console.log('P25 active post-upgrade burn-in contract passed.');
