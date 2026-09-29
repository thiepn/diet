import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDietV2ReadModel } from '../v2/read-model.mjs';
import { DietWriteRPC } from '../v2/write-api.mjs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const dataJs=fs.readFileSync('v2/data.js','utf8');
const src=fs.readFileSync('src/engine/personal-intelligence.mjs','utf8');
const browser=fs.readFileSync('v2/engine/personal-intelligence.mjs','utf8');

assert.equal(browser,src,'Deployed P7 engine copy drifted from canonical source.');

for(const id of [
  'intelligenceVersion','intelligenceReliableDays','intelligenceProteinAdherence',
  'intelligenceCalorieAdherence','intelligenceWeightRate','intelligenceWeekendDelta',
  'intelligenceActivityShift','personalInsights'
]) assert.match(html,new RegExp('id="'+id+'"'),'Missing P7 UI target '+id);

for(const cls of [
  '.dc-intelligence-panel','.dc-intelligence-summary','.dc-intelligence-insights',
  '.dc-insight-card','.dc-intelligence-policy'
]) assert.ok(css.includes(cls),'Missing P7 style '+cls);

assert.match(dataJs,/personalInsights/,'P7 UI renderer missing.');
assert.match(src,/association_not_causation/,'P7 engine must preserve non-causal association framing.');

const expected=[
  'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
  'diet_app_repeat_meal','diet_app_delete_meal',
  'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
  'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
  'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal',
  'diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review',
  'diet_app_save_training_distribution','diet_app_upsert_training_day','diet_app_delete_training_day'
].sort();
assert.deepEqual(Object.values(DietWriteRPC).sort(),expected,'P7 must not expand the browser mutation allowlist.');

{
  const dailyLogs=[],meals=[],mealItems=[],weights=[],activityDaily=[];
  const start=new Date('2026-09-02T12:00:00Z');
  for(let i=0;i<28;i++){
    const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);
    const date=d.toISOString().slice(0,10);
    const logId='d'+i,mealId='m'+i;
    dailyLogs.push({id:logId,log_date:date,calorie_target:2100,protein_target:150,status:'complete'});
    meals.push({id:mealId,daily_log_id:logId,meal_type:'Dinner',title:'Daily meal',calories:2100,protein:150,eaten_at:date+'T18:00:00Z'});
    mealItems.push({
      id:'i'+i,meal_id:mealId,name:'Daily food',quantity_text:'1 day',
      calories:2100,protein:150,carbs:(i%2?280:220),fat:65,fiber:30,sort_order:0
    });
    weights.push({entry_date:date,weight:80-i*0.03});
    activityDaily.push({activity_date:date,steps:i>=21?12000:8000,active_calories:450,exercise_minutes:45});
  }
  const model=buildDietV2ReadModel({
    profile:{calorie_target:2100,protein_target:150,goal_weight:76,desired_weekly_weight_change:-0.25},
    dailyLogs,meals,mealItems,weights,
    goalPhases:[{phase_type:'cut',start_date:'2026-09-01',calorie_target:2100,protein_target:150,goal_weight:76,desired_weekly_weight_change:-0.25,active:true}],
    savedFoods:[],savedMeals:[],targetRecommendations:[],
    trainingDistribution:{enabled:false,weekly_template:{mon:'rest',tue:'hard',wed:'rest',thu:'hard',fri:'rest',sat:'hard',sun:'rest'}},
    trainingDays:[],activityDaily
  },{asOfDate:'2026-09-29'});
  assert.equal(model.progress.intelligence.version,'1.0.0-p7');
  assert.ok(model.progress.intelligence.quality.observedReliableDays>=20);
  assert.equal(model.meta.intelligenceVersion,'1.0.0-p7');
  assert.equal(model.progress.intelligence.policy.calculation,'deterministic_only');
}

{
  const raw={
    profile:{calorie_target:2000,protein_target:140},
    dailyLogs:[{id:'d1',log_date:'2026-09-29',calorie_target:2000,protein_target:140,status:'complete'}],
    meals:[{id:'m1',daily_log_id:'d1',meal_type:'Dinner',title:'Macros',calories:1000,protein:80,eaten_at:'2026-09-29T18:00:00Z'}],
    mealItems:[
      {id:'i1',meal_id:'m1',name:'A',calories:500,protein:40,carbs:60,fat:15,fiber:8,sort_order:0},
      {id:'i2',meal_id:'m1',name:'B',calories:500,protein:40,carbs:50,fat:20,fiber:7,sort_order:1}
    ],
    weights:[],goalPhases:[],savedFoods:[],savedMeals:[],targetRecommendations:[],activityDaily:[],trainingDays:[]
  };
  const model=buildDietV2ReadModel(raw,{asOfDate:'2026-09-29'});
  assert.equal(model.progress.intelligence.quality.observedReliableDays,1);
}

console.log('Diet Copilot 2.0 P7 personal intelligence integration tests passed.');
