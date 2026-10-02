import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const p23=JSON.parse(read('platform-p23-inventory.json'));
const pre=JSON.parse(read('platform-p24-pre-upgrade.json'));
const gateMigration=read('supabase/migrations/20260930014316_platform_p24_controlled_upgrade_execution_gate.sql');
const postMigration=read('supabase/migrations/20261001121450_platform_p24_post_upgrade_hosted_build_validation.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p)).join('\n');

assert.equal(app.webRelease,'2.0.3');
assert.equal(app.operationsVersion,'P25.0');
assert.equal(app.pendingOperationsPhase,'P25');
assert.equal(app.platformUpgradeExecutionState,'completed_managed_hosted_upgrade_validated');
assert.equal(app.health.sharedPlatformUpgradeExecuted,true);
assert.equal(app.health.sharedPlatformPostUpgradeValidation,'pass');
assert.equal(app.health.platformUpgradeExecutionManualActionRequired,false);
assert.equal(app.health.platformManagedBuildBefore,'17.6.1.127');
assert.equal(app.health.platformManagedBuildAfter,'17.6.1.164');
assert.equal(app.health.platformSemanticFingerprintFormat,'platform-p23-shared-schema-v2');
assert.equal(app.health.postgres1711CompatibilityBaselineMet,false);
assert.equal(app.health.postgres1711TrackedSeparately,true);
assert.equal(app.health.p25BurnInActive,true);
assert.equal(app.health.p25BurnInGenerationState,'burn_in_active');

const policy=backend.platform_upgrade_execution_policy;
assert.equal(policy.release,'P24');
assert.equal(policy.active_operations_release,'P25.0');
assert.ok(policy.migration_versions.includes('20261001121450'));
assert.equal(policy.execution_state,'completed_managed_hosted_upgrade_validated');
assert.equal(policy.current_postgres,'17.6');
assert.equal(policy.target_postgres,'17.11');
assert.equal(policy.connector_can_execute_managed_upgrade,false);
assert.equal(policy.manual_dashboard_action_required,false);
assert.equal(policy.upgrade_executed,true);
assert.equal(policy.post_upgrade_validation,'pass');
assert.equal(policy.post_upgrade_validator,'private.platform_p24_post_upgrade_validation');
assert.equal(policy.post_upgrade_status_rpc,'public.platform_p24_post_upgrade_status');
assert.equal(policy.post_upgrade_status_rpc_service_only,true);
assert.equal(policy.managed_hosted_build_before,'17.6.1.127');
assert.equal(policy.managed_hosted_build_after,'17.6.1.164');
assert.equal(policy.managed_hosted_release_channel_before,'ga');
assert.equal(policy.managed_hosted_release_channel_after,'preview');
assert.match(policy.post_upgrade_semantic_schema_sha256,/^[0-9a-f]{64}$/);
assert.equal(policy.semantic_fingerprint_format,'platform-p23-shared-schema-v2');
assert.equal(policy.postgres_17_11_compatibility_baseline_met,false);
assert.equal(policy.postgres_17_11_tracked_separately,true);
assert.deepEqual(policy.completion_requires,[]);

assert.equal(backend.post_upgrade_burn_in_policy.release,'P25');
assert.equal(backend.post_upgrade_burn_in_policy.state,'burn_in_active');
assert.equal(backend.post_upgrade_burn_in_policy.p24_post_upgrade_validation,'pass');
assert.equal(backend.post_upgrade_burn_in_policy.semantic_schema_sha256,policy.post_upgrade_semantic_schema_sha256);

// The P24 manifest is deliberately historical pre-upgrade evidence.
assert.equal(pre.phase,'P24');
assert.equal(pre.executionState,'ready_for_manual_supabase_infrastructure_upgrade');
assert.equal(pre.upgradeExecuted,false);
assert.equal(pre.postUpgradeValidation,'pending');
assert.equal(pre.preUpgrade.preflightStatus,'pass');
assert.equal(pre.preUpgrade.databaseQuietWindowSatisfied,true);
assert.equal(pre.edgeRevalidation.latestObservedGomokuRoomVersion,27);

assert.equal(p23.upgradeExecuted,true);
assert.equal(p23.postUpgradeValidation,'pass');
assert.equal(p23.databaseSurfaces.platform.relations,2);
assert.equal(p23.databaseSurfaces.platform.functions,10);

for(const token of [
  'private.platform_p24_execution_gate',
  'public.platform_p24_execution_status',
  "'readyForManualUpgrade'",
  "'schemaMatchesCertification'"
]) assert.ok(gateMigration.includes(token),'Missing original P24 gate token: '+token);

for(const token of [
  'platform-p23-shared-schema-v2',
  'jsonb_agg(r.rolname',
  'platform_managed_upgrade_events',
  'platform_p24_post_upgrade_validation',
  'platform_p24_post_upgrade_status',
  "'17.6.1.127'","'17.6.1.164'"
]) assert.ok(postMigration.includes(token),'Missing P24 post-upgrade token: '+token);

for(const symbol of [
  'platform_p24_execution_gate','platform_p24_execution_status',
  'platform_p24_post_upgrade_status'
]) assert.doesNotMatch(browser,new RegExp(symbol),'P24 operator surface must not enter browser code.');

console.log('P24 managed hosted-upgrade validation contract passed; P25 generation 3 burn-in is active.');
