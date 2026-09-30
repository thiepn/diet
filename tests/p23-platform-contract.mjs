import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const inventory=JSON.parse(read('platform-p23-inventory.json'));
const migration=read('supabase/migrations/20260930000921_platform_p23_shared_postgres_17_11_upgrade_readiness.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p))
  .join('\n');

assert.equal(app.webRelease,'2.0.3');
assert.equal(app.operationsVersion,'P23.0');
assert.equal(app.platformUpgradeRelease,'P23');
assert.equal(app.platformUpgradeModel,'shared-schema-fingerprint-cross-app-postgres-17-11-readiness-v1');

for(const [k,v] of Object.entries({
  securityRelease:'P14',
  resilienceRelease:'P15',
  performanceRelease:'P16',
  privacyRelease:'P17',
  integrityRelease:'P18',
  concurrencyRelease:'P19',
  changeGovernanceRelease:'P20',
  incidentCertificationRelease:'P21',
  maintenanceRelease:'P22'
})) assert.equal(app[k],v);

assert.equal(app.health?.sharedPlatformUpgradeCertification,true);
assert.equal(app.health?.sharedPlatformUpgradeReady,true);
assert.equal(app.health?.sharedPlatformUpgradeExecuted,false);
assert.equal(app.health?.sharedPlatformPostUpgradeValidation,'pending');
assert.equal(app.health?.certifiedApplicationSurfaceCount,10);
assert.equal(app.health?.certifiedPlatformControlSurfaceCount,1);
assert.equal(app.health?.registeredSharedApps,5);
assert.equal(app.health?.sharedEdgeFunctionCount,11);
assert.equal(app.health?.sharedCronJobCount,8);
assert.equal(app.health?.sharedUpgradeHazardCount,0);
assert.equal(app.health?.platformUpgradeStatusServiceOnly,true);
assert.match(app.health?.sharedPlatformSchemaSha256||'',/^[0-9a-f]{64}$/);

const policy=backend.platform_upgrade_policy;
assert.equal(policy?.release,'P23');
assert.deepEqual(policy?.migration_versions,['20260930000921']);
assert.equal(policy?.current_postgres,'17.6');
assert.equal(policy?.target_postgres,'17.11');
assert.equal(policy?.target_server_version_num,170011);
assert.equal(policy?.upgrade_available,true);
assert.equal(policy?.safe_to_schedule_upgrade,true);
assert.equal(policy?.automatic_upgrade,false);
assert.equal(policy?.upgrade_executed,false);
assert.equal(policy?.post_upgrade_validation,'pending');
assert.equal(policy?.shared_project,true);
assert.equal(policy?.registered_active_apps,5);
assert.equal(policy?.certified_application_surfaces,10);
assert.equal(policy?.certified_platform_control_surfaces,1);
assert.equal(policy?.schema_contract_format,'platform-p23-shared-schema-v1');
assert.equal(policy?.certified_schema_sha256,app.health.sharedPlatformSchemaSha256);
assert.equal(policy?.certification_retention_days,730);
assert.equal(policy?.status_rpc_service_only,true);
assert.equal(policy?.edge_function_inventory,'platform-p23-inventory.json');
assert.equal(policy?.edge_function_count,11);
assert.equal(policy?.cron_jobs,8);
assert.equal(policy?.cron_scheduler_workers,1);
assert.equal(policy?.recent_cron_failures_7d,0);
assert.equal(policy?.advisor_security_findings,0);
assert.equal(policy?.advisor_performance_findings,0);
assert.equal(policy?.maintenance_window_required,true);
assert.equal(policy?.cross_app_post_upgrade_validation_required,true);
for(const value of Object.values(policy?.hazards||{})) assert.equal(value,0);

assert.equal(inventory.release,'P23');
assert.equal(inventory.currentPostgres,'17.6');
assert.equal(inventory.targetPostgres,'17.11');
assert.equal(inventory.safeToScheduleUpgrade,true);
assert.equal(inventory.upgradeExecuted,false);
assert.equal(inventory.postUpgradeValidation,'pending');
assert.equal(inventory.sharedSchemaSha256,policy.certified_schema_sha256);
assert.equal(inventory.registeredApps.length,5);
assert.equal(Object.keys(inventory.databaseSurfaces).length,11);
assert.equal(inventory.edgeFunctions.length,11);
assert.equal(inventory.cron.jobs,8);
assert.equal(inventory.cron.activeJobs,8);
assert.equal(inventory.cron.failures7d,0);
for(const value of Object.values(inventory.upgradeHazards)) assert.equal(value,0);
for(const fn of inventory.edgeFunctions){
  assert.match(fn.sha256,/^[0-9a-f]{64}$/);
  assert.equal(typeof fn.version,'number');
}

for(const token of [
  'private.platform_upgrade_certifications',
  'platform_p23_upgrade_certifications_deny',
  'private.platform_p23_shared_schema_contract',
  'private.platform_p23_shared_schema_fingerprint',
  'private.platform_p23_upgrade_preflight',
  'private.platform_p23_certify_readiness',
  'private.platform_p23_post_upgrade_validation',
  'public.platform_p23_upgrade_status',
  'platform-p23-shared-schema-v1',
  "'targetPostgres','17.11'",
  "'safeToScheduleUpgrade'",
  "'edgeFunctionInventoryRequired',true",
  "'requiresCrossAppPostUpgradeValidation',true",
  "platform_p23_certify_readiness('release')"
]) assert.ok(migration.includes(token),'Missing P23 migration contract: '+token);

assert.match(migration,/revoke all on function public\.platform_p23_upgrade_status\(\) from public, anon, authenticated|revoke all on function public\.platform_p23_upgrade_status\(\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.platform_p23_upgrade_status\(\) to service_role/i);

for(const symbol of [
  'platform_p23_upgrade_status',
  'platform_p23_upgrade_preflight',
  'platform_p23_certify_readiness',
  'platform_p23_post_upgrade_validation'
]) assert.doesNotMatch(browser,new RegExp(symbol),'P23 operator surface must not enter browser runtime.');

assert.equal(backend.change_governance_policy?.checkpoint?.release,'P22');
assert.equal(backend.change_governance_policy?.checkpoint?.operations_version,'P22.0');
assert.equal(backend.maintenance_policy?.release,'P22');

console.log('P23 shared-platform Postgres 17.11 readiness contract passed.');
