import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDietV2ReadModel, normalizeDietV1Rows } from '../v2/read-model.mjs';

const DAY=86400000;
function dateAt(i){return new Date(Date.UTC(2026,7,20+i)).toISOString().slice(0,10)}

const raw={
  profile:{
    calorie_target:2300,
    protein_target:160,
    goal_weight:80,
    desired_weekly_weight_change:-0.3,
    adaptive_target_enabled:true,
    adaptive_min_complete_days:14
  },
  dailyLogs:[],
  meals:[],
  mealItems:[],
  weights:[],
  goalPhases:[
    {phase_type:'maintain',start_date:'2026-07-01',end_date:'2026-08-19',calorie_target:2700,protein_target:150,goal_weight:84,desired_weekly_weight_change:0,active:false},
    {phase_type:'cut',start_date:'2026-08-20',end_date:null,calorie_target:2300,protein_target:160,goal_weight:80,desired_weekly_weight_change:-0.3,active:true}
  ]
};

let weight=84;
for(let i=0;i<40;i++){
  const date=dateAt(i);
  raw.dailyLogs.push({id:`d${i}`,log_date:date,calorie_target:2300,protein_target:160,status:i===39?'open':'complete'});
  raw.meals.push({
    id:`m${i}`,
    daily_log_id:`d${i}`,
    meal_type:'Daily',
    title:`Meal ${i}`,
    calories:2300,
    protein:165,
    calories_low:2275,
    calories_high:2325,
    confidence:'high',
    source:'manual_exact',
    eaten_at:`${date}T12:00:00Z`,
    created_at:`${date}T12:00:00Z`,
    updated_at:`${date}T12:00:00Z`
  });
  raw.mealItems.push({id:`i${i}`,meal_id:`m${i}`,name:'Test food',quantity_text:'1 serving',calories:2300,protein:165,sort_order:0,confidence:'high',source:'manual_exact'});
  weight += (2300-2800)/7700;
  if(i%2===0) raw.weights.push({id:`w${i}`,entry_date:date,weight:weight+[0,.08,-.06][i%3]});
}

const asOf=dateAt(39);
const normalized=normalizeDietV1Rows(raw,asOf);
assert.equal(normalized.phase.phase_type,'cut');
assert.equal(normalized.normalizedMeals.length,40);
assert.equal(normalized.normalizedMeals[0].items.length,1);
assert.equal(normalized.normalizedMeals[0].items[0].name,'Test food');

const model=buildDietV2ReadModel(raw,{asOfDate:asOf});
assert.equal(model.today.calories,2300);
assert.equal(model.today.protein,165);
assert.equal(model.today.calorieTarget,2300);
assert.equal(model.today.proteinTarget,160);
assert.equal(model.today.meals.length,1);
assert.equal(model.strategy.goalMode,'lose');
assert.equal(model.strategy.goalWeight,80);
assert.equal(model.strategy.currentTarget,2300);
assert.ok(model.today.trendWeight>0);
assert.ok(model.progress.trendWeights.length>0);
assert.ok(model.progress.rawWeights.length>0);
assert.ok(model.progress.intake.length===40);
assert.ok(model.meta.engineVersion);
assert.deepEqual(buildDietV2ReadModel(raw,{asOfDate:asOf}),buildDietV2ReadModel(raw,{asOfDate:asOf}),'Read model must be deterministic.');

raw.dailyLogs.push({id:'future-day',log_date:'2027-01-01',calorie_target:9999,protein_target:999,status:'complete'});
raw.meals.push({id:'future-meal',daily_log_id:'future-day',meal_type:'Future',title:'Future',calories:9999,protein:999,eaten_at:'2027-01-01T12:00:00Z'});
const noFuture=buildDietV2ReadModel(raw,{asOfDate:asOf});
assert.equal(noFuture.today.calorieTarget,2300);
assert.equal(noFuture.food.recentMeals.some(m=>m.id==='future-meal'),false,'Future rows must not leak into current read model.');

const dataJs=fs.readFileSync('v2/data.js','utf8');
const authStorage=fs.readFileSync('v2/auth-storage.mjs','utf8');
const html=fs.readFileSync('v2/index.html','utf8');

for(const forbidden of [/\.insert\s*\(/,/\.update\s*\(/,/\.upsert\s*\(/,/\.delete\s*\(/,/\.rpc\s*\(/,/service_role/i]){
  assert.doesNotMatch(dataJs,forbidden,'P2.5 data layer must remain SELECT-only.');
}
for(const table of ['profiles','daily_logs','meals','meal_items','weight_entries','goal_phases']){
  assert.match(dataJs,new RegExp(`from\\('${table}'\\)\\.select`),`Missing owner-scoped read for ${table}`);
}
assert.match(dataJs,/auth\.getUser\(\)/,'Online identity must be verified with Supabase Auth before loading private data.');
assert.match(dataJs,/ownerId===ownerId|cached\?\.ownerId===ownerId/,'Offline cache must be owner scoped.');
assert.match(dataJs,/auth\.getSession\(\)/,'Existing THIEPN session must be reused.');
assert.match(dataJs,/detectSessionInUrl:false/,'P2.5 must not create a second OAuth callback handler.');
assert.match(authStorage,/sb-hycegznamzjhwinegaai-auth-token/,'V2 must reuse the canonical V1 auth storage key.');
assert.match(authStorage,/diet-auth-v2-/,'V2 must understand the V1 resilient cookie fallback.');

assert.match(html,/vendor\/supabase-2\.116\.0\.js/,'Pinned Supabase browser SDK must be loaded.');
assert.match(html,/type="module" src="\.\/data\.js"/,'Read-only data integration module must be loaded.');
for(const id of [
  'dataStatus','todayCaloriesValue','todayProteinValue','todayTrendWeightValue','todayExpenditureValue',
  'todayMeals','foodTimeline','progressWeightChart','progressExpenditureChart','progressIntakeChart',
  'strategyGoalMode','strategyTdee','strategyCurrentTarget','strategyConfidence','strategyDecisionTitle',
  'v2AccountDialog'
]){
  assert.match(html,new RegExp(`id="${id}"`),`Missing P2.5 UI binding: ${id}`);
}

console.log('Diet Copilot 2.0 P2.5 read-only data integration tests passed.');
