import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=JSON.parse(read('.well-known/thiepn-app.json'));
const backend=JSON.parse(read('supabase/backend.json'));
const account=JSON.parse(read('.well-known/thiepn-account-release.json'));
const migration=read('supabase/migrations/20260929203937_diet_p18_integrity_watchdog_and_constraints.sql');
const browser=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>read('v2/'+p))
  .join('\n');

assert.equal(app.release,'2.0.3');
assert.equal(app.webRelease,'2.0.3');
assert.equal(account.consumerRelease,'2.0.3');
assert.ok(['P18.0','P19.0','P20.0','P21.0','P22.0','P23.0','P25.0'].includes(app.operationsVersion),'P18 integrity controls must remain valid through P25.');
assert.equal(app.integrityRelease,'P18');
assert.equal(app.integrityModel,'db-constraints-scheduled-invariant-audit-v1');
assert.equal(app.securityRelease,'P14');
assert.equal(app.resilienceRelease,'P15');
assert.equal(app.performanceRelease,'P16');
assert.equal(app.privacyRelease,'P17');

assert.equal(app.health?.databaseNutritionIntegrityConstraints,true);
assert.equal(app.health?.databaseIntegrityConstraintCount,9);
assert.equal(app.health?.integrityWatchdog,true);
assert.equal(app.health?.integrityCheckCount,17);
assert.equal(app.health?.integrityAutoRepair,false);
assert.equal(app.health?.integrityAuditCronUtc,'03:17');
assert.equal(app.health?.integrityAuditRetentionDays,180);
assert.equal(app.health?.integrityReportServiceOnly,true);

assert.equal(backend.integrity_policy?.release,'P18');
assert.deepEqual(backend.integrity_policy?.migration_versions,['20260929203937']);
assert.equal(backend.integrity_policy?.database_constraint_count,9);
assert.equal(backend.integrity_policy?.audit_check_count,17);
assert.equal(backend.integrity_policy?.release_audit_status,'clean');
assert.equal(backend.integrity_policy?.release_audit_failure_count,0);
assert.equal(backend.integrity_policy?.auto_repair,false);
assert.equal(backend.integrity_policy?.audit_ledger?.retention_days,180);
assert.equal(backend.integrity_policy?.audit_ledger?.browser_access,false);
assert.equal(backend.integrity_policy?.watchdog?.service_only,true);
assert.equal(backend.integrity_policy?.false_positive_guards?.meal_date_uses_daily_log_not_utc_timestamp,true);
assert.equal(backend.integrity_policy?.false_positive_guards?.same_day_goal_phase_boundary_not_flagged_as_overlap,true);

const constraints=[
  'meals_nutrition_integrity_p18',
  'meal_items_nutrition_integrity_p18',
  'saved_foods_nutrition_integrity_p18',
  'saved_meals_nutrition_integrity_p18',
  'saved_meal_items_nutrition_integrity_p18',
  'profiles_targets_integrity_p18',
  'daily_logs_targets_integrity_p18',
  'goal_phases_targets_integrity_p18',
  'target_recommendations_integrity_p18'
];
for(const name of constraints){
  assert.match(migration,new RegExp(name));
  assert.match(migration,new RegExp('validate constraint '+name,'i'));
}
assert.equal(backend.integrity_policy?.hard_constraints?.length,9);

assert.match(migration,/create table if not exists private\.diet_integrity_audits/i);
assert.match(migration,/alter table private\.diet_integrity_audits enable row level security/i);
assert.match(migration,/create policy diet_p18_integrity_audits_deny/i);
assert.match(migration,/as restrictive[\s\S]*for all[\s\S]*to authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);
assert.match(migration,/revoke all on table private\.diet_integrity_audits from public,anon,authenticated/i);

assert.match(migration,/create or replace function private\.diet_p18_integrity_report\(\)/i);
assert.match(migration,/create or replace function public\.diet_p18_integrity_report\(\)/i);
assert.match(migration,/security invoker/i);
assert.match(migration,/revoke all on function public\.diet_p18_integrity_report\(\) from public,anon,authenticated/i);
assert.match(migration,/grant execute on function public\.diet_p18_integrity_report\(\) to service_role/i);
assert.match(migration,/create or replace function private\.diet_p18_run_integrity_audit\(p_source text default 'manual'\)/i);
assert.match(migration,/audited_at < clock_timestamp\(\)-interval '180 days'/i);
assert.match(migration,/diet-p18-integrity-daily/);
assert.match(migration,/17 3 \* \* \*/);
assert.match(migration,/autoRepair',false/i);

for(const check of [
  'owner_meals_daily_logs',
  'owner_meal_items_meals',
  'owner_meal_items_saved_foods',
  'owner_saved_meal_items_meals',
  'owner_saved_meal_items_foods',
  'owner_recommendations_phases',
  'meal_calorie_aggregate',
  'meal_protein_aggregate',
  'saved_meal_calorie_aggregate',
  'saved_meal_protein_aggregate',
  'multiple_active_goal_phases',
  'blank_saved_food_names',
  'blank_saved_meal_names',
  'recommendation_resolution_state',
  'invalid_nutrition_numeric_state',
  'auth_user_cascade_contract',
  'recovery_snapshot_cascade_contract'
]) assert.match(migration,new RegExp(check));

assert.doesNotMatch(browser,/diet_p18_integrity_report/,'P18 global integrity report must not be browser-callable.');
assert.doesNotMatch(browser,/diet_p18_run_integrity_audit/,'P18 audit runner must not be browser-callable.');
assert.doesNotMatch(migration,/update\s+public\.(?:meals|meal_items|saved_foods|saved_meals|saved_meal_items|profiles|daily_logs|goal_phases|target_recommendations)/i,'P18 must not auto-repair Diet records.');
assert.doesNotMatch(migration,/delete\s+from\s+public\.(?:meals|meal_items|saved_foods|saved_meals|saved_meal_items|profiles|daily_logs|goal_phases|target_recommendations)/i,'P18 must not auto-delete Diet records.');

console.log('Diet Copilot P18 data-integrity contract passed.');
