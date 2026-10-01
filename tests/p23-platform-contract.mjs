import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const inventory=JSON.parse(read('platform-p23-inventory.json'));
const original=read('supabase/migrations/20260930000921_platform_p23_shared_postgres_17_11_upgrade_readiness.sql');
const post=read('supabase/migrations/20261001121450_platform_p24_post_upgrade_hosted_build_validation.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p)).join('\n');

assert.equal(app.webRelease,'2.0.3');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(app.platformUpgradeRelease,'P23');
assert.equal(app.pendingOperationsPhase,'P25');
assert.equal(app.health?.sharedPlatformUpgradeCertification,true);
assert.equal(app.health?.sharedPlatformUpgradeExecuted,true);
assert.equal(app.health?.sharedPlatformPostUpgradeValidation,'pass');
assert.equal(app.health?.registeredSharedApps,6);
assert.equal(app.health?.sharedEdgeFunctionCount,11);
assert.equal(app.health?.sharedCronJobCount,8);
assert.match(app.health?.sharedPlatformSchemaSha256||'',/^[0-9a-f]{64}$/);

const policy=backend.platform_upgrade_policy;
assert.equal(policy?.release,'P23');
assert.equal(policy?.current_postgres,'17.6');
assert.equal(policy?.target_postgres,'17.11');
assert.equal(policy?.target_server_version_num,170011);
assert.equal(policy?.hosted_upgrade_executed,true);
assert.equal(policy?.post_upgrade_validation,'pass');
assert.equal(policy?.schema_contract_format,'platform-p23-shared-schema-v2');
assert.equal(policy?.certified_schema_sha256,app.health.sharedPlatformSchemaSha256);
assert.equal(policy?.legacy_pre_upgrade_schema_sha256_v1,'8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe');
assert.equal(policy?.hosted_build_before,'17.6.1.127');
assert.equal(policy?.hosted_build_after,'17.6.1.164');
assert.equal(policy?.hosted_release_channel_before,'ga');
assert.equal(policy?.hosted_release_channel_after,'preview');
assert.equal(policy?.postgres_17_11_compatibility_baseline_met,false);
assert.equal(policy?.postgres_17_11_tracked_separately,true);
assert.equal(policy?.registered_active_apps,6);
assert.equal(policy?.certified_application_surfaces,10);
assert.equal(policy?.replication_slot_state?.blocking,0);

assert.equal(inventory.release,'P23');
assert.equal(inventory.currentPostgres,'17.6');
assert.equal(inventory.targetPostgres,'17.11');
assert.equal(inventory.upgradeExecuted,true);
assert.equal(inventory.postUpgradeValidation,'pass');
assert.equal(inventory.schemaContractFormat,'platform-p23-shared-schema-v2');
assert.equal(inventory.sharedSchemaSha256,policy.certified_schema_sha256);
assert.equal(inventory.registeredApps.length,6);
assert.equal(inventory.databaseSurfaces.platform.relations,2);
assert.equal(inventory.databaseSurfaces.platform.functions,10);
assert.equal(inventory.edgeFunctions.length,11);
assert.equal(inventory.cron.jobs,8);
assert.equal(inventory.cron.activeJobs,8);
assert.equal(inventory.cron.failures7d,0);
assert.equal(inventory.replicationSlotState.blocking,0);
assert.equal(inventory.hostedUpgrade.validated,true);
assert.equal(inventory.hostedUpgrade.buildAfter,'17.6.1.164');
assert.equal(inventory.postgres1711Compatibility.met,false);
assert.equal(inventory.postgres1711Compatibility.trackedSeparately,true);

for(const token of [
  'private.platform_upgrade_certifications',
  'private.platform_p23_shared_schema_contract',
  'private.platform_p23_shared_schema_fingerprint',
  'private.platform_p23_upgrade_preflight',
  'private.platform_p23_certify_readiness',
  'platform-p23-shared-schema-v1'
]) assert.ok(original.includes(token),'Missing original P23 contract: '+token);

for(const token of [
  'platform-p23-shared-schema-v2',
  'jsonb_agg(r.rolname',
  'platform_managed_upgrade_events',
  'platform_p24_post_upgrade_validation',
  'platform_p24_post_upgrade_status'
]) assert.ok(post.includes(token),'Missing post-upgrade semantic contract: '+token);

for(const symbol of [
  'platform_p23_upgrade_status','platform_p23_upgrade_preflight',
  'platform_p23_certify_readiness','platform_p23_post_upgrade_validation',
  'platform_p24_post_upgrade_status'
]) assert.doesNotMatch(browser,new RegExp(symbol),'Operator surface must not enter browser runtime.');

assert.equal(backend.change_governance_policy?.checkpoint?.release,'P22');
assert.equal(backend.maintenance_policy?.release,'P22');

console.log('P23 shared-platform compatibility contract passed under P25 active burn-in.');
