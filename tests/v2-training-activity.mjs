import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDietV2ReadModel } from '../v2/read-model.mjs';
import { buildTrainingNutritionPlan } from '../src/engine/training-nutrition.mjs';
import {
  DietWriteRPC,saveTrainingDistribution,upsertTrainingDay,deleteTrainingDay
} from '../v2/write-api.mjs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const dataJs=fs.readFileSync('v2/data.js','utf8');
const trainingJs=fs.readFileSync('v2/training-actions.js','utf8');
const writeJs=fs.readFileSync('v2/write-api.mjs','utf8');
const engine=fs.readFileSync('src/engine/training-nutrition.mjs','utf8');
const browserAdaptive=fs.readFileSync('v2/engine/adaptive-nutrition.mjs','utf8');
const browserLegacy=fs.readFileSync('v2/engine/legacy-data-adapter.mjs','utf8');
const browserTraining=fs.readFileSync('v2/engine/training-nutrition.mjs','utf8');
assert.equal(browserAdaptive,fs.readFileSync('src/engine/adaptive-nutrition.mjs','utf8'),'Deployed P1 engine copy drifted from canonical source.');
assert.equal(browserLegacy,fs.readFileSync('src/engine/legacy-data-adapter.mjs','utf8'),'Deployed legacy adapter copy drifted from canonical source.');
assert.equal(browserTraining,engine,'Deployed P6 engine copy drifted from canonical source.');
const sql=fs.readFileSync('supabase/p6-training-activity.sql','utf8');

for(const id of [
  'trainingDistributionEnabled','trainingHardShift','trainingModerateShift','trainingLightShift',
  'trainingWeekPlanner','trainingWeeklyBase','trainingWeeklyDistributed','trainingWeeklyDifference',
  'trainingSaveDistribution','activitySteps','activityCalories','activityExercise','activityRelativeLoad',
  'v2HealthConnectState','v2HealthConnectConnect','v2HealthConnectSync',
  'todayTrainingOverrideType','todayTrainingOverrideStatus','todayTrainingDuration',
  'todayTrainingTitle','todayTrainingSave','todayTrainingClear'
]) assert.match(html,new RegExp('id="'+id+'"'),'Missing P6 UI target '+id);

assert.match(html,/type="module" src="\.\/training-actions\.js"/,'P6 action module must be loaded.');
for(const cls of [
  '.dc-training-week','.dc-training-day','.dc-activity-grid',
  '.dc-training-policy','.dc-training-today-form'
]) assert.ok(css.includes(cls),'Missing P6 style '+cls);

const expected=[
  'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
  'diet_app_repeat_meal','diet_app_delete_meal',
  'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
  'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
  'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal',
  'diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review',
  'diet_app_save_training_distribution','diet_app_upsert_training_day','diet_app_delete_training_day'
].sort();
assert.deepEqual(Object.values(DietWriteRPC).sort(),expected,'P6 browser mutation surface must stay exactly allowlisted.');

assert.doesNotMatch(trainingJs,/\.from\s*\(/,'P6 UI must never mutate tables directly.');
assert.doesNotMatch(trainingJs,/service_role|sb_secret_/i,'P6 UI must not contain privileged keys.');
assert.doesNotMatch(writeJs,/service_role|sb_secret_/i,'Write client must not contain privileged keys.');
assert.match(trainingJs,/syncDailyActivity\(\{days:21\}\)/,'Health Connect sync should use a bounded foreground history window.');
assert.match(trainingJs,/v2HealthConnectSync'\)\?\.addEventListener\('click',syncHealth\)/,'Health sync must require an explicit foreground action.');
assert.doesNotMatch(trainingJs,/setInterval\([^)]*syncDailyActivity|requestIdleCallback\([^)]*syncDailyActivity/,'P6 must not create an automatic exercise-calorie polling loop.');

for(const name of ['diet_app_save_training_distribution','diet_app_upsert_training_day','diet_app_delete_training_day']){
  assert.match(sql,new RegExp('function public\\.'+name+'\\('),'Missing P6 SQL façade '+name);
}
assert.match(sql,/alter table public\.training_distribution_settings enable row level security/);
assert.match(sql,/alter table public\.training_days enable row level security/);
assert.match(sql,/grant select on table public\.training_distribution_settings to authenticated/);
assert.match(sql,/grant select on table public\.training_days to authenticated/);
assert.doesNotMatch(sql,/grant\s+(insert|update|delete|all).*on\s+(table\s+)?public\.(training_distribution_settings|training_days|activity_daily)/i,'P6 must not grant direct training/activity table writes.');

assert.match(engine,/weeklyEnergyInvariant:'preserve_base_weekly_energy'/);
assert.match(engine,/activityCaloriePolicy:'context_only_no_eat_back'/);
assert.match(engine,/macroShiftPolicy:'hold_protein_and_fat_shift_carbs'/);

assert.match(dataJs,/client\.from\('activity_daily'\)/,'P6 must read activity context.');
assert.match(dataJs,/client\.from\('training_distribution_settings'\)/,'P6 must read training distribution settings.');
assert.match(dataJs,/client\.from\('training_days'\)/,'P6 must read training-day overrides.');

{
  const raw={
    profile:{calorie_target:2000,protein_target:150,goal_weight:75,desired_weekly_weight_change:-0.5},
    dailyLogs:[],meals:[],mealItems:[],
    weights:[
      {entry_date:'2026-09-15',weight:80},
      {entry_date:'2026-09-22',weight:79.6},
      {entry_date:'2026-09-29',weight:79.2}
    ],
    goalPhases:[{phase_type:'cut',start_date:'2026-09-01',calorie_target:2000,protein_target:150,goal_weight:75,desired_weekly_weight_change:-0.5,active:true}],
    savedFoods:[],savedMeals:[],targetRecommendations:[],
    trainingDistribution:{
      enabled:true,
      weekly_template:{mon:'rest',tue:'hard',wed:'rest',thu:'moderate',fri:'rest',sat:'hard',sun:'rest'},
      hard_extra_kcal:150,moderate_extra_kcal:75,light_extra_kcal:25
    },
    trainingDays:[],
    activityDaily:[
      {activity_date:'2026-09-28',steps:8000,active_calories:400,exercise_minutes:35,source:'health_connect',synced_at:'2026-09-29T07:00:00Z'},
      {activity_date:'2026-09-29',steps:9000,active_calories:500,exercise_minutes:55,source:'health_connect',synced_at:'2026-09-29T10:00:00Z'}
    ]
  };
  const model=buildDietV2ReadModel(raw,{asOfDate:'2026-09-29'});
  assert.equal(model.strategy.trainingNutrition.enabled,true);
  assert.equal(model.strategy.trainingNutrition.zeroSum,true);
  assert.equal(model.strategy.trainingNutrition.week.length,7);
  assert.equal(model.today.trainingDayType,'hard');
  assert.ok(model.today.calorieTarget>model.today.baseCalorieTarget);
  assert.equal(model.strategy.trainingNutrition.policy.activityCaloriePolicy,'context_only_no_eat_back');
}

{
  const base=buildTrainingNutritionPlan({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{enabled:false},activity:[]
  });
  const active=buildTrainingNutritionPlan({
    asOfDate:'2026-09-29',baseCalories:2000,protein:150,fat:65,
    settings:{enabled:false},
    activity:[{activity_date:'2026-09-29',steps:25000,active_calories:1400,exercise_minutes:120}]
  });
  assert.equal(base.today.targetCalories,active.today.targetCalories,'Activity must never be directly eaten back.');
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{enabled:true},error:null};}};
  await saveTrainingDistribution(client,{
    enabled:true,
    weeklyTemplate:{mon:'hard',tue:'rest',wed:'hard',thu:'rest',fri:'hard',sat:'rest',sun:'rest'},
    hardExtraKcal:150,moderateExtraKcal:75,lightExtraKcal:25
  });
  assert.equal(calls[0].name,'diet_app_save_training_distribution');
  assert.equal(calls[0].args.p_hard_extra_kcal,150);
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{id:'t1'},error:null};}};
  await upsertTrainingDay(client,{date:'2026-09-29',dayType:'hard',status:'completed',title:'Leg day',durationMinutes:80});
  assert.equal(calls[0].name,'diet_app_upsert_training_day');
  assert.equal(calls[0].args.p_day_type,'hard');
  assert.equal(calls[0].args.p_duration_minutes,80);
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{deleted:true},error:null};}};
  await deleteTrainingDay(client,{trainingDayId:'t1',expectedUpdatedAt:'2026-09-29T10:00:00Z'});
  assert.equal(calls[0].name,'diet_app_delete_training_day');
  assert.equal(calls[0].args.p_training_day_id,'t1');
}

console.log('Diet Copilot 2.0 P6 training-day nutrition and activity integration tests passed.');
