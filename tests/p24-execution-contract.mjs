import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const p23=JSON.parse(read('platform-p23-inventory.json'));
const p24=JSON.parse(read('platform-p24-pre-upgrade.json'));
const gateMigration=read('supabase/migrations/20260930014316_platform_p24_controlled_upgrade_execution_gate.sql');
const classifierMigration=read('supabase/migrations/20260930014417_platform_p24_classify_execution_controls.sql');
const realtimeMigration=read('supabase/migrations/20260930161902_platform_p24_managed_realtime_replication_preflight.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p)).join('\n');

assert.equal(app.webRelease,'2.0.3');
assert.equal(app.operationsVersion,'P23.0');
assert.equal(app.pendingOperationsPhase,'P24');
assert.ok(['awaiting_final_quiet_window_after_p24_refresh','ready_for_manual_supabase_infrastructure_upgrade'].includes(app.platformUpgradeExecutionState));
assert.equal(app.health?.sharedPlatformUpgradeExecuted,false);
assert.equal(app.health?.sharedPlatformPostUpgradeValidation,'pending');
assert.equal(app.health?.platformUpgradeExecutionGate,true);
assert.equal(app.health?.platformUpgradeExecutionGateServiceOnly,true);
assert.equal(app.health?.platformUpgradeExecutionMinimumQuietMinutes,10);
assert.equal(app.health?.platformUpgradeExecutionWritesPaused,false);
assert.equal(app.health?.platformUpgradeExecutionManualActionRequired,true);
assert.equal(app.health?.platformUpgradeExecutionConnectorAvailable,false);
assert.equal(app.health?.platformUpgradeFreshSnapshotVerified,true);
assert.equal(app.health?.platformUpgradeLatestOffsiteBackupSucceeded,true);
assert.equal(app.health?.platformUpgradeConcurrentChangeProtection,true);
assert.equal(app.health?.platformUpgradeEdgeQuietRequired,true);
assert.equal(app.health?.platformUpgradeEdgeQuietMinutes,10);
assert.equal(app.health?.platformUpgradeEdgeInventoryRequiresFinalRecheck,true);
assert.equal(app.health?.platformUpgradeDatabaseGateCoversEdgeDeployments,false);
assert.equal(app.health?.platformUpgradeLatestObservedGomokuEdgeVersion,24);
assert.equal(app.health?.platformUpgradeBlockingReplicationSlots,0);
assert.equal(app.health?.platformUpgradeDashboardPreflightAuthoritative,true);

const policy=backend.platform_upgrade_execution_policy;
assert.equal(policy?.release,'P24');
assert.equal(policy?.active_operations_release,'P23.0');
assert.deepEqual(policy?.migration_versions,['20260930014316','20260930014417','20260930161902']);
assert.equal(policy?.execution_state,app.platformUpgradeExecutionState);
assert.equal(policy?.current_postgres,'17.6');
assert.equal(policy?.target_postgres,'17.11');
assert.equal(policy?.managed_upgrade_method,'supabase_infrastructure_in_place_pg_upgrade');
assert.equal(policy?.connector_can_execute_managed_upgrade,false);
assert.equal(policy?.manual_dashboard_action_required,true);
assert.equal(policy?.upgrade_executed,false);
assert.equal(policy?.post_upgrade_validation,'pending');
assert.equal(policy?.execution_gate,'private.platform_p24_execution_gate');
assert.equal(policy?.execution_status_rpc,'public.platform_p24_execution_status');
assert.equal(policy?.execution_status_rpc_service_only,true);
assert.equal(policy?.minimum_quiet_minutes,10);
assert.equal(policy?.writes_paused,false);
assert.equal(policy?.recovery?.fresh_snapshot_verified,true);
assert.equal(policy?.recovery?.restore_plan_safe_to_stage,true);
assert.equal(policy?.recovery?.destructive_restore_automatic,false);
assert.equal(policy?.recovery?.encrypted_offsite_backup_conclusion,'success');
assert.equal(policy?.concurrent_change_protection?.enabled,true);
assert.equal(policy?.concurrent_change_protection?.require_schema_match,true);
assert.equal(policy?.concurrent_change_protection?.require_quiet_window,true);
assert.equal(policy?.concurrent_change_protection?.edge_deployment_quiet_minutes,10);
assert.equal(policy?.concurrent_change_protection?.edge_inventory_final_recheck_required,true);
assert.equal(policy?.concurrent_change_protection?.database_gate_covers_edge_deployments,false);
assert.equal(policy?.concurrent_change_protection?.latest_observed_gomoku_room_edge?.version,24);
assert.equal(policy?.concurrent_change_protection?.replication_slot_state?.blocking,0);
assert.equal(policy?.concurrent_change_protection?.replication_slot_state?.dashboard_preflight_authoritative,true);

assert.equal(p24.phase,'P24');
assert.equal(p24.executionState,app.platformUpgradeExecutionState);
assert.equal(p24.activeOperationsRelease,'P23.0');
assert.equal(p24.currentPostgres,'17.6');
assert.equal(p24.targetPostgres,'17.11');
assert.equal(p24.connectorCanExecuteManagedUpgrade,false);
assert.equal(p24.manualDashboardActionRequired,true);
assert.equal(p24.upgradeExecuted,false);
assert.equal(p24.postUpgradeValidation,'pending');
assert.equal(p24.preUpgrade.sharedSchemaSha256,policy.current_certified_schema_sha256);
assert.equal(p24.preUpgrade.schemaMatchesLatestCertification,true);
assert.equal(p24.preUpgrade.preflightStatus,'pass');
assert.equal(p24.preUpgrade.safeToScheduleUpgrade,true);
assert.equal(p24.preUpgrade.minimumQuietMinutes,10);
assert.equal(p24.preUpgrade.writesPaused,false);
assert.equal(p24.preUpgrade.databaseQuietWindowSatisfied,app.platformUpgradeExecutionState==='ready_for_manual_supabase_infrastructure_upgrade');
assert.equal(p24.preUpgrade.edgeQuietWindowSatisfied,true);
if(app.platformUpgradeExecutionState==='ready_for_manual_supabase_infrastructure_upgrade') assert.ok(p24.preUpgrade.quietMinutesObserved>=10);
else assert.ok(p24.preUpgrade.quietMinutesObserved<10);
assert.ok(p24.preUpgrade.edgeQuietMinutesObservedAtRefresh>=10);
for(const value of Object.values(p24.preUpgrade.hazards)) assert.equal(value,0);
assert.equal(p24.recovery.freshInDatabaseSnapshot,true);
assert.equal(p24.recovery.snapshotVerified,true);
assert.equal(p24.recovery.snapshotId,'aebe85b2-43a4-4e0b-b44d-e782bb97aa18');
assert.equal(p24.recovery.snapshotCapturedAt,'2026-09-30T16:19:59.549832Z');
assert.equal(p24.recovery.snapshotHashOk,true);
assert.equal(p24.recovery.snapshotSchemaOk,true);
assert.equal(p24.recovery.restorePlanSafeToStage,true);
assert.equal(p24.recovery.destructiveRestoreAutomatic,false);
assert.equal(p24.recovery.latestEncryptedOffsiteBackupConclusion,'success');
assert.equal(p24.edgeFunctions.length,11);
assert.equal(p24.edgeInventoryAtCaptureHistorical,true);
assert.equal(p24.edgeRevalidation?.required,true);
assert.equal(p24.edgeRevalidation?.databaseExecutionGateCoversEdgeDeployments,false);
assert.equal(p24.edgeRevalidation?.minimumQuietMinutes,10);
assert.equal(p24.edgeRevalidation?.latestObservedGomokuRoomVersion,24);
assert.equal(p24.edgeRevalidation?.quietWindowSatisfied,true);

assert.equal(p23.sharedSchemaSha256,policy.current_certified_schema_sha256);
assert.equal(p23.databaseSurfaces.gomoku.relations,9);
assert.equal(p23.databaseSurfaces.gomoku.functions,8);
assert.equal(p23.databaseSurfaces.platform.functions,8);
const gomokuEdge=p23.edgeFunctions.find(x=>x.slug==='gomoku-room');
assert.equal(gomokuEdge?.version,24);
assert.equal(gomokuEdge?.sha256,'c66bc31db80b0eb12ef7c4b8d93fc14f5b3a1b9ec23e99b969ad46e6bc301378');

for(const token of [
  'private.platform_p24_execution_gate',
  'public.platform_p24_execution_status',
  "'minimumQuietMinutes',10",
  "'managedUpgradeMustUseSupabaseInfrastructure',true",
  "'readyForManualUpgrade'",
  "'schemaMatchesCertification'"
]) assert.ok(gateMigration.includes(token),'Missing P24 gate token: '+token);

assert.ok(classifierMigration.includes("platform_p24_%"),'P23 classifier must recognize P24 controls.');
for(const token of ['v_managed_realtime_slots','v_blocking_slots','managedRealtimeTemporary','dashboardPreflightAuthoritative']) assert.ok(realtimeMigration.includes(token),'Missing P24 managed Realtime token: '+token);
assert.match(gateMigration,/revoke all on function public\.platform_p24_execution_status\(\) from public, anon, authenticated|revoke all on function public\.platform_p24_execution_status\(\) from public,anon,authenticated/i);
assert.match(gateMigration,/grant execute on function public\.platform_p24_execution_status\(\) to service_role/i);

for(const symbol of ['platform_p24_execution_gate','platform_p24_execution_status']){
  assert.doesNotMatch(browser,new RegExp(symbol),'P24 operator surface must not enter browser code.');
}

console.log('P24 controlled upgrade execution-boundary contract passed.');
