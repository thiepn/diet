import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseline=JSON.parse(fs.readFileSync('platform-p25-burn-in-plan.json','utf8'));
const doc=fs.readFileSync('docs/P25-POST-UPGRADE-BURN-IN.md','utf8');
const probe=fs.readFileSync('tests/p25-public-burnin.py','utf8');
const workflow=fs.readFileSync('.github/workflows/p25-post-upgrade-burnin.yml','utf8');

assert.equal(baseline.phase,'P25');
assert.equal(baseline.state,'blocked_pre_upgrade');
assert.equal(baseline.activationRequires.postgresServerVersionNumAtLeast,170011);
assert.equal(baseline.currentBlockers.upgradeExecuted,false);
assert.equal(baseline.currentBlockers.managedPostgresUpgradePending,true);
assert.equal(baseline.currentBlockers.p24Gate,'ready_for_manual_upgrade');
assert.equal(baseline.currentBlockers.schemaMatchesCertification,true);
assert.equal(baseline.currentBlockers.p23Preflight,'pass');
assert.equal(baseline.currentBlockers.latestObservedGomokuRoomEdgeVersion,27);
assert.equal(baseline.latestKnownPreUpgradeOffsiteBackup.conclusion,'success');
assert.equal(baseline.burnInRequirements.minimumHours,24);
assert.ok(baseline.burnInRequirements.minimumHourlyPublicSamples>=12);
assert.equal(baseline.burnInRequirements.requireSuccessfulPostUpgradeOffsiteBackup,true);
assert.equal(baseline.burnInRequirements.requireZeroNewCronFailures,true);
assert.equal(baseline.preUpgradeHealthBaseline.allSamplesHealthy,true);
assert.ok(baseline.regressionThresholds.authP95WarningMs>=2*baseline.preUpgradeHealthBaseline.authLatencyMs.p95);
assert.ok(baseline.regressionThresholds.databaseP95WarningMs>=2*baseline.preUpgradeHealthBaseline.databaseLatencyMs.p95);

for(const token of [
  'minimum 24-hour burn-in',
  'first P15 encrypted off-site backup',
  'P18 integrity = clean',
  'P20 schema drift = false',
  'P21 failure/readiness = pass',
  'P22 maintenance = pass',
  'PostgreSQL 17.11'
]) assert.ok(doc.includes(token),'P25 document missing '+token);

for(const token of ['platform-health','platform_p23_upgrade_status','platform_p24_execution_status','performanceWarning'])
  assert.ok(probe.includes(token),'P25 probe missing '+token);

assert.ok(workflow.includes("cron: '17 * * * *'"));
assert.ok(workflow.includes('p25-public-burnin.py'));
assert.ok(workflow.includes('retention-days: 30'));

console.log('P25 staged burn-in contract passed; activation remains blocked until P24 completes.');
