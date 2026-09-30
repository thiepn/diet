import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration1=fs.readFileSync('supabase/migrations/20260929190638_diet_p14_security_authorization_hardening.sql','utf8');
const migration2=fs.readFileSync('supabase/migrations/20260929190758_diet_p14_advisor_performance_hardening.sql','utf8');
const backend=JSON.parse(fs.readFileSync('supabase/backend.json','utf8'));
const app=JSON.parse(fs.readFileSync('.well-known/thiepn-app.json','utf8'));
const data=fs.readFileSync('v2/data.js','utf8');
const writes=fs.readFileSync('v2/write-api.mjs','utf8');
const allV2=fs.readdirSync('v2',{recursive:true})
  .filter(p=>/\.(?:js|mjs)$/.test(String(p)))
  .map(p=>fs.readFileSync('v2/'+p,'utf8'))
  .join('\n');

assert.match(migration1,/diet_p14_enforce_session_owner/);
assert.match(migration1,/Anonymous Diet access is not permitted/);
assert.match(migration1,/Diet row ownership mismatch/);
assert.match(migration1,/as restrictive for all to authenticated/);
assert.match(migration1,/revoke all privileges on table public\.%I from anon/i);
assert.match(migration1,/revoke insert, update, delete, truncate, references, trigger/i);
assert.match(migration1,/where n\.nspname='public' and p\.proname like 'diet_app_%'/);
assert.match(migration1,/revoke all on function %s from public, anon/);
assert.match(migration1,/alter function %s set search_path = ''/);
assert.match(migration1,/meals_daily_log_owner_fkey_p14/);
assert.match(migration1,/meal_items_meal_owner_fkey_p14/);
assert.match(migration1,/saved_food_portions_food_owner_fkey_p14/);
assert.match(migration1,/saved_meal_items_meal_owner_fkey_p14/);
assert.match(migration1,/meal_items_saved_food_owner_fkey_p14/);
assert.match(migration1,/target_recommendations_phase_owner_fkey_p14/);

assert.match(migration2,/\(select auth\.jwt\(\)\)/);
for(const name of [
  'meals_daily_log_owner_idx_p14',
  'meal_items_meal_owner_idx_p14',
  'meal_items_saved_food_owner_idx_p14',
  'saved_food_portions_food_owner_idx_p14',
  'saved_meal_items_meal_owner_idx_p14',
  'saved_meal_items_saved_food_owner_idx_p14',
  'target_recommendations_phase_owner_idx_p14'
])assert.match(migration2,new RegExp(name));
assert.match(migration2,/diet_p14_operator_owner_deny/);

assert.ok(['P14.0','P15.0','P16.0','P17.0','P18.0','P19.0','P20.0','P21.0','P22.0','P23.0'].includes(app.operationsVersion),'P14 security controls must remain valid through P23.');
assert.equal(app.securityRelease,'P14');
assert.equal(app.health?.databaseOwnerGuard,true);
assert.equal(app.health?.directTableWrites,false);
assert.equal(app.health?.anonymousDietAccess,false);
assert.equal(backend.security_policy?.release,'P14');
assert.equal(backend.security_policy?.direct_table_mutation,'denied_to_anon_and_authenticated');
assert.equal(backend.security_policy?.anonymous_diet_access,false);
assert.equal(backend.security_policy?.table_session_owner_guard,true);
assert.equal(backend.security_policy?.cross_owner_foreign_keys,true);

assert.match(data,/sb_publishable_/);
assert.doesNotMatch(allV2,/sb_secret_[A-Za-z0-9_-]+/i,'No Supabase secret key may appear in browser source.');
assert.doesNotMatch(allV2,/(?:const|let|var)\\s+\\w*service[_-]?role\\w*\\s*=/i,'No service-role credential variable may appear in browser source.');
assert.doesNotMatch(allV2,/service_role\\s*:\\s*['"`][^'"`]{12,}/i,'No service-role credential value may appear in browser source.');
assert.match(writes,/diet_app_log_meal/);
assert.doesNotMatch(allV2,/\.from\([^\n]+\)\.(?:insert|update|delete|upsert)\(/);

const rpcNames=[...writes.matchAll(/(?:manual|savedFood|savedMeal|repeatMeal|deleteMeal|updateMeal|saveMealFromHistory|saveFood|setSavedFoodFavorite|deleteSavedFood|setSavedMealFavorite|deleteSavedMeal|stageStrategyReview|resolveStrategyReview|revertStrategyReview|saveTrainingDistribution|upsertTrainingDay|deleteTrainingDay):'([^']+)'/g)].map(m=>m[1]);
assert.ok(rpcNames.length>=17,'Expected the Diet write RPC registry.');
assert.ok(rpcNames.every(name=>name.startsWith('diet_app_')),'Browser writes must remain inside the diet_app_* RPC boundary.');

console.log('Diet Copilot P14 static security contract passed.');
