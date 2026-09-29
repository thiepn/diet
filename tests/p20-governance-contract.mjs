import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const account=JSON.parse(read('.well-known/thiepn-account-release.json'));
const migration=read('supabase/migrations/20260929221452_diet_p20_schema_drift_release_governance.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p))
  .join('\n');
const sw=read('sw.js');
const aliasSw=read('v2/sw.js');
const pwa=read('v2/pwa.js');

assert.equal(app.release,'2.0.3');
assert.equal(app.webRelease,'2.0.3');
assert.equal(account.consumerRelease,'2.0.3');
assert.ok(['P20.0','P21.0','P22.0'].includes(app.operationsVersion),'P20 governance must remain valid through P22.');
assert.equal(app.changeGovernanceRelease,'P20');
assert.equal(app.schemaContractModel,'deterministic-schema-fingerprint-certified-checkpoint-v1');
assert.equal(app.securityRelease,'P14');
assert.equal(app.resilienceRelease,'P15');
assert.equal(app.performanceRelease,'P16');
assert.equal(app.privacyRelease,'P17');
assert.equal(app.integrityRelease,'P18');
assert.equal(app.concurrencyRelease,'P19');

assert.equal(app.health?.schemaDriftWatchdog,true);
assert.equal(app.health?.schemaDriftDetected,false);
assert.ok(app.health?.schemaContractRelationCount>=23);
assert.equal(app.health?.schemaDriftAuditRetentionDays,365);
assert.equal(app.health?.schemaDriftCronUtc,'03:37');
assert.equal(app.health?.schemaDriftAutoRepair,false);
assert.equal(app.health?.releaseCheckpointing,true);
assert.equal(app.health?.releaseStatusServiceOnly,true);

const policy=backend.change_governance_policy;
assert.equal(policy?.release,'P20');
assert.deepEqual(policy?.migration_versions,['20260929221452']);
assert.equal(policy?.schema_contract_format,'diet-p20-schema-contract-v1');
assert.match(policy?.certified_schema_sha256||'',/^[0-9a-f]{64}$/);
assert.equal(policy?.contract_scope?.diet_public_tables,18);
assert.ok(policy?.contract_scope?.private_operational_tables>=5);
assert.deepEqual(policy?.contract_scope?.includes,[
  'relations','columns','constraints','indexes','rls_policies','triggers','diet_functions','diet_cron_jobs'
]);
assert.deepEqual(policy?.contract_scope?.excludes,[
  'table_rows','auth_managed_schema','storage_managed_schema','unrelated_apps'
]);
assert.equal(policy?.checkpoint?.status,'clean');
assert.ok(['P20','P21','P22'].includes(policy?.checkpoint?.release));
assert.ok(['P20.0','P21.0','P22.0'].includes(policy?.checkpoint?.operations_version));
assert.equal(policy?.drift_audit?.retention_days,365);
assert.equal(policy?.drift_audit?.cron_utc,'03:37_daily');
assert.equal(policy?.drift_audit?.auto_repair,false);
assert.equal(policy?.release_status_service_only,true);
assert.equal(policy?.rollback_probe?.drift_detected,true);
assert.equal(policy?.rollback_probe?.fingerprint_restored_after_rollback,true);
assert.equal(policy?.rollback_probe?.persisted_probe_change,false);

for(const table of [
  'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
  'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
  'target_recommendations','activity_daily','training_distribution_settings',
  'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices',
  'diet_recovery_snapshots','diet_integrity_audits','diet_mutation_requests',
  'diet_release_checkpoints','diet_schema_drift_audits'
]) assert.match(migration,new RegExp("'"+table.replace(/[.*+?^$()|[\]{}]/g,'\\$&')+"'"));

assert.match(migration,/create table if not exists private\.diet_release_checkpoints/i);
assert.match(migration,/create table if not exists private\.diet_schema_drift_audits/i);
assert.match(migration,/alter table private\.diet_release_checkpoints enable row level security/i);
assert.match(migration,/alter table private\.diet_schema_drift_audits enable row level security/i);
assert.match(migration,/create policy diet_p20_release_checkpoints_deny/i);
assert.match(migration,/create policy diet_p20_schema_drift_audits_deny/i);
assert.match(migration,/as restrictive[\s\S]*to authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);

assert.match(migration,/create or replace function private\.diet_p20_schema_contract\(\)/i);
assert.match(migration,/diet-p20-schema-contract-v1/);
assert.match(migration,/information_schema\.columns/);
assert.match(migration,/pg_catalog\.pg_get_constraintdef/);
assert.match(migration,/pg_catalog\.pg_get_indexdef/);
assert.match(migration,/pg_catalog\.pg_policy/);
assert.match(migration,/pg_catalog\.pg_get_triggerdef/);
assert.match(migration,/pg_catalog\.pg_get_functiondef/);
assert.match(migration,/jobname like 'diet-%'/);

assert.match(migration,/create or replace function private\.diet_p20_schema_fingerprint\(\)/i);
assert.match(migration,/extensions\.digest/i);
assert.match(migration,/'sha256'/i);
assert.match(migration,/create or replace function private\.diet_p20_certify_release/i);
assert.match(migration,/create or replace function private\.diet_p20_run_drift_audit/i);
assert.match(migration,/status text not null check \(status in \('clean','drift','no_checkpoint'\)\)/i);
assert.match(migration,/audited_at < clock_timestamp\(\)-interval '365 days'/i);
assert.match(migration,/autoRepair',false/i);

assert.match(migration,/create or replace function public\.diet_p20_release_status\(\)/i);
assert.match(migration,/revoke all on function public\.diet_p20_release_status\(\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.diet_p20_release_status\(\) to service_role/i);
assert.match(migration,/diet-p20-schema-drift-daily/);
assert.match(migration,/37 3 \* \* \*/);
assert.match(migration,/diet_p20_certify_release\([\s\S]*'P20'[\s\S]*'P20\.0'/i);
assert.match(migration,/diet_p20_run_drift_audit\('release'\)/i);

assert.doesNotMatch(browser,/diet_p20_schema_contract/,'P20 schema contract must not be browser-callable.');
assert.doesNotMatch(browser,/diet_p20_schema_fingerprint/,'P20 schema fingerprint must not be browser-callable.');
assert.doesNotMatch(browser,/diet_p20_certify_release/,'P20 release certification must not be browser-callable.');
assert.doesNotMatch(browser,/diet_p20_run_drift_audit/,'P20 drift audit must not be browser-callable.');
assert.doesNotMatch(browser,/diet_p20_release_status/,'P20 release status must not be browser-called.');

assert.doesNotMatch(migration,/update\s+public\.(?:profiles|daily_logs|meals|meal_items|weight_entries|goal_phases|saved_foods|saved_food_portions|saved_meals|saved_meal_items|target_recommendations|activity_daily|training_distribution_settings|training_days|ai_actions|change_log|weekly_reviews|diet_native_devices)/i,'P20 must not rewrite Diet user data.');
assert.doesNotMatch(migration,/delete\s+from\s+public\.(?:profiles|daily_logs|meals|meal_items|weight_entries|goal_phases|saved_foods|saved_food_portions|saved_meals|saved_meal_items|target_recommendations|activity_daily|training_distribution_settings|training_days|ai_actions|change_log|weekly_reviews|diet_native_devices)/i,'P20 must not delete Diet user data.');

assert.match(sw,/diet-copilot-prod-v2-p17-1/);
assert.match(aliasSw,/diet-copilot-v2-alias-p17-1/);
assert.match(pwa,/version:'2\.0\.3-p17'/);

console.log('Diet Copilot P20 schema-drift/release-governance contract passed.');
