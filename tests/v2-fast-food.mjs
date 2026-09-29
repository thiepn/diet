import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDietV2ReadModel } from '../v2/read-model.mjs';
import { logManualMeal, DietWriteRPC } from '../v2/write-api.mjs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const foodJs=fs.readFileSync('v2/food.js','utf8');
const writeJs=fs.readFileSync('v2/write-api.mjs','utf8');
const dataJs=fs.readFileSync('v2/data.js','utf8');
const sql=fs.readFileSync('supabase/p3-app-write-api.sql','utf8');

for(const id of [
  'foodSearchInput','foodSearchResults','foodQuickAddForm','foodQuickFoods',
  'foodSavedMeals','foodRecentMeals','foodWriteStatus'
]){
  assert.match(html,new RegExp(`id="${id}"`),`Missing P3 food UI target ${id}`);
}
for(const type of ['Breakfast','Lunch','Dinner','Snack']){
  assert.match(html,new RegExp(`data-food-meal-type="${type}"`),`Missing meal type ${type}`);
}
assert.match(html,/type="module" src="\.\/food\.js"/,'Food interaction module must be loaded.');
assert.match(css,/\.dc-food-meal-types/,'Fast meal-type selector styles are required.');
assert.match(css,/\.dc-log-option/,'One-tap option styles are required.');
assert.match(css,/\.dc-quick-add-form/,'Quick-add form styles are required.');

assert.doesNotMatch(foodJs,/\.from\s*\(/,'Food interaction layer must not mutate tables directly.');
assert.doesNotMatch(foodJs,/service_role|sb_secret_/i,'Food interaction layer must not contain privileged keys.');
assert.doesNotMatch(writeJs,/\.from\s*\(/,'Write API module must only use RPC façades.');
assert.doesNotMatch(writeJs,/service_role|sb_secret_/i,'Write API module must not contain privileged keys.');

const allowed=[
  'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
  'diet_app_repeat_meal','diet_app_delete_meal'
];
for(const name of allowed) assert.ok(Object.values(DietWriteRPC).includes(name),`P3 RPC disappeared: ${name}`);
for(const name of allowed){
  assert.match(writeJs,new RegExp(`['"]${name}['"]`),`Missing allowlisted RPC ${name}`);
  assert.match(sql,new RegExp(`function public\\.${name}\\(`),`Missing database façade ${name}`);
}
assert.match(sql,/security definer/gi);
assert.match(sql,/v_uid uuid := auth\.uid\(\)/,'Every app façade must derive browser ownership from auth.uid().');
assert.match(sql,/revoke all on function public\.diet_app_log_meal[\s\S]*grant execute on function public\.diet_app_log_meal[\s\S]*to authenticated/i,'App RPC grants must be explicit.');
assert.doesNotMatch(sql,/grant\s+(insert|update|delete|all).*on\s+(table\s+)?public\.(meals|meal_items|daily_logs|saved_foods|saved_meals)/i,'P3 must not grant direct table writes.');

assert.match(dataJs,/from\('saved_foods'\)\.select/,'Saved foods must be owner-scoped reads.');
assert.match(dataJs,/from\('saved_meals'\)\.select/,'Saved meals must be owner-scoped reads.');
assert.match(dataJs,/diet-v2-data-updated/,'Food workspace must update after canonical refresh.');

{
  const raw={
    profile:{calorie_target:2200,protein_target:150,goal_weight:80,desired_weekly_weight_change:-0.2},
    dailyLogs:[],meals:[],mealItems:[],weights:[],goalPhases:[],
    savedFoods:[
      {id:'f1',name:'Frequent',quantity_text:'100 g',calories:100,protein:10,favorite:false,use_count:20,last_used_at:'2026-09-20T12:00:00Z'},
      {id:'f2',name:'Favorite',quantity_text:'1 cup',calories:150,protein:15,favorite:true,use_count:2,last_used_at:'2026-09-01T12:00:00Z'}
    ],
    savedMeals:[
      {id:'sm1',name:'Breakfast bowl',meal_type:'Breakfast',calories:500,protein:35,favorite:true,use_count:5,is_recipe:false}
    ]
  };
  const model=buildDietV2ReadModel(raw,{asOfDate:'2026-09-29'});
  assert.equal(model.food.savedFoods.length,2);
  assert.equal(model.food.quickFoods[0].id,'f2','Favorites should win the one-tap ordering.');
  assert.equal(model.food.savedMeals[0].id,'sm1');
  assert.equal(model.meta.legacyRows.savedFoods,2);
}

{
  const calls=[];
  const client={
    async rpc(name,args){
      calls.push({name,args});
      if(calls.length===1)return {data:null,error:{status:503,code:'PGRST000',message:'temporary'}};
      return {data:{meal_id:'meal-1',updated_at:'2026-09-29T10:00:00Z'},error:null};
    }
  };
  const result=await logManualMeal(client,{
    date:'2026-09-29',mealType:'Lunch',title:'Test food',
    items:[{name:'Test food',calories:300,protein:25}]
  });
  assert.equal(calls.length,2,'Transient failure should retry once.');
  assert.equal(calls[0].name,'diet_app_log_meal');
  assert.equal(calls[1].name,'diet_app_log_meal');
  assert.equal(calls[0].args.p_request_id,calls[1].args.p_request_id,'Retry must reuse the idempotency key.');
  assert.equal(result.data.meal_id,'meal-1');
}

console.log('Diet Copilot 2.0 P3 fast food logging tests passed.');
