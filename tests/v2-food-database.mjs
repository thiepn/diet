import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDietV2ReadModel } from '../v2/read-model.mjs';
import { DietWriteRPC, updateMeal, saveFood } from '../v2/write-api.mjs';
import { scaleOpenFoodFactsProduct } from '../v2/open-food-facts.mjs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const dataJs=fs.readFileSync('v2/data.js','utf8');
const mealEditor=fs.readFileSync('v2/meal-editor.js','utf8');
const foodManagement=fs.readFileSync('v2/food-management.js','utf8');
const off=fs.readFileSync('v2/open-food-facts.mjs','utf8');
const sql=fs.readFileSync('supabase/p4-food-library-write-api.sql','utf8');

for(const id of [
  'mealEditorDialog','mealEditorForm','mealEditorItems','mealCopyDate',
  'foodLibraryDialog','foodLibraryFoods','foodLibraryMeals','foodEditorDialog',
  'foodShortcutOnline','foodOnlineResults'
]) assert.match(html,new RegExp('id="'+id+'"'),'Missing P4 UI target '+id);

for(const script of ['./meal-editor.js','./food-management.js'])
  assert.match(html,new RegExp('src="'+script.replace('.','\\.')+'"'),'Missing P4 module '+script);

for(const cls of ['.dc-modal','.dc-editor-item','.dc-library-row','.dc-external-card'])
  assert.ok(css.includes(cls),'Missing P4 style '+cls);

const expected=[
  'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
  'diet_app_repeat_meal','diet_app_delete_meal',
  'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
  'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
  'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal'
].sort();
assert.deepEqual(Object.values(DietWriteRPC).sort(),expected,'P4 browser mutation surface must stay explicitly allowlisted.');

for(const src of [mealEditor,foodManagement]){
  assert.doesNotMatch(src,/\.from\s*\(/,'P4 UI modules must never mutate tables directly.');
  assert.doesNotMatch(src,/service_role|sb_secret_/i,'P4 UI modules must not contain privileged keys.');
}
assert.match(foodManagement,/searchOpenFoodFacts/,'Online discovery must stay behind the dedicated adapter.');
assert.match(foodManagement,/foodShortcutOnline/,'Online search must require an explicit action.');
assert.match(off,/SEARCH_MIN_INTERVAL=6500/,'Open Food Facts search must be client rate-limited.');
assert.match(off,/\/cgi\/search\.pl/,'Full-text OFF search uses the documented legacy endpoint explicitly.');
assert.match(off,/\/api\/v2\/product\//,'Barcode lookup must use the product endpoint.');

const p4=[
  'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
  'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
  'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal'
];
for(const name of p4){
  assert.match(sql,new RegExp('function public\\.'+name+'\\('),'Missing P4 SQL façade '+name);
}
assert.doesNotMatch(sql,/grant\s+(insert|update|delete|all).*on\s+(table\s+)?public\.(meals|meal_items|saved_foods|saved_meals|daily_logs)/i,'P4 must not add direct Diet table writes.');

assert.match(dataJs,/saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber/,'Editable meal items must retain linked-food and macro fields.');
assert.match(dataJs,/verified_at,source,photo_url,updated_at/,'Saved-food reads must retain source and concurrency metadata.');

{
  const raw={
    profile:{calorie_target:2200,protein_target:150},
    dailyLogs:[{id:'d1',log_date:'2026-09-29',calorie_target:2200,protein_target:150,status:'open'}],
    meals:[{id:'m1',daily_log_id:'d1',meal_type:'Lunch',title:'Editable',calories:300,protein:25,eaten_at:'2026-09-29T12:00:00Z',updated_at:'2026-09-29T12:01:00Z'}],
    mealItems:[{id:'i1',meal_id:'m1',saved_food_id:'f1',name:'Food',quantity_text:'100 g',calories:300,protein:25,carbs:30,fat:8,fiber:4,sort_order:0}],
    weights:[],goalPhases:[],
    savedFoods:[{id:'f1',name:'Food',calories:300,protein:25,carbs:30,fat:8,fiber:4,source:'manual_exact',updated_at:'2026-09-29T10:00:00Z'}],
    savedMeals:[{id:'sm1',name:'Meal',meal_type:'Lunch',calories:300,protein:25,updated_at:'2026-09-29T10:00:00Z'}]
  };
  const model=buildDietV2ReadModel(raw,{asOfDate:'2026-09-29'});
  assert.equal(model.food.todayMeals[0].items[0].savedFoodId,'f1');
  assert.equal(model.food.todayMeals[0].items[0].fiber,4);
  assert.equal(model.food.savedFoods[0].updatedAt,'2026-09-29T10:00:00Z');
  assert.equal(model.food.savedMeals[0].updatedAt,'2026-09-29T10:00:00Z');
}

{
  const scaled=scaleOpenFoodFactsProduct({
    code:'12345678',name:'Example',brand:'Brand',imageUrl:'',
    per100:{calories:400,protein:20,carbs:50,fat:10,fiber:6}
  },75);
  assert.equal(scaled.calories,300);
  assert.equal(scaled.protein,15);
  assert.equal(scaled.quantityText,'75 g');
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{meal_id:'m1',updated_at:'x'},error:null};}};
  await updateMeal(client,{mealId:'m1',date:'2026-09-29',mealType:'Lunch',title:'Edited',items:[{name:'Food',calories:300,protein:25}],expectedUpdatedAt:'old'});
  assert.equal(calls[0].name,'diet_app_update_meal');
  assert.equal(calls[0].args.p_expected_updated_at,'old');
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{saved_food_id:'f1'},error:null};}};
  await saveFood(client,{name:'Imported',quantityText:'100 g',calories:120,protein:8,brand:'Brand',barcode:'12345678',source:'open_food_facts'});
  assert.equal(calls[0].name,'diet_app_save_food');
  assert.equal(calls[0].args.p_source,'open_food_facts');
  assert.equal(calls[0].args.p_barcode,'12345678');
}

console.log('Diet Copilot 2.0 P4 food database and editing tests passed.');
