import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDietV2ReadModel } from '../v2/read-model.mjs';
import {
  DietWriteRPC, stageStrategyReview, resolveStrategyReview, revertStrategyReview
} from '../v2/write-api.mjs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const strategyJs=fs.readFileSync('v2/strategy-actions.js','utf8');
const writeJs=fs.readFileSync('v2/write-api.mjs','utf8');
const sql=fs.readFileSync('supabase/p5-strategy-actions.sql','utf8');
const engine=fs.readFileSync('src/engine/adaptive-nutrition.mjs','utf8');

for(const id of [
  'strategyReviewCurrent','strategyRecommendedTarget','strategyTargetDelta',
  'strategyEvidenceTdee','strategyObservedRate','strategyReliableDays',
  'strategyEngineVersion','strategyMacroProtein','strategyMacroFat','strategyMacroCarbs',
  'strategyStageReview','strategyKeepCurrent','strategyAccept','strategyEffectiveDate',
  'strategyReviewState','strategyHistory','strategyHistoryCount'
]){
  assert.match(html,new RegExp('id="'+id+'"'),'Missing P5 strategy UI target '+id);
}
assert.match(html,/type="module" src="\.\/strategy-actions\.js"/,'P5 strategy module must be loaded.');
for(const cls of ['.dc-strategy-targets','.dc-strategy-evidence','.dc-strategy-actions','.dc-strategy-history-row']){
  assert.ok(css.includes(cls),'Missing P5 strategy style '+cls);
}

const expected=[
  'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
  'diet_app_repeat_meal','diet_app_delete_meal',
  'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
  'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
  'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal',
  'diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review'
].sort();
for(const name of expected) assert.ok(Object.values(DietWriteRPC).includes(name),'P5 RPC disappeared: '+name);

assert.doesNotMatch(strategyJs,/\.from\s*\(/,'Strategy UI must never mutate tables directly.');
assert.doesNotMatch(strategyJs,/service_role|sb_secret_/i,'Strategy UI must not contain privileged keys.');
assert.doesNotMatch(writeJs,/service_role|sb_secret_/i,'Write client must not contain privileged keys.');
assert.match(strategyJs,/strategyAccept'\)\?\.addEventListener\('click',\(\)=>resolveReview\('accept'\)\)/,'Accept must require an explicit click.');
assert.doesNotMatch(strategyJs,/setInterval|requestIdleCallback\([^)]*resolveStrategyReview/,'Strategy resolution must not be automatic.');

for(const name of ['diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review']){
  assert.match(sql,new RegExp('function public\\.'+name+'\\('),'Missing P5 SQL façade '+name);
}
assert.match(sql,/engine_version text/,'P5 history must store engine version.');
assert.match(sql,/confidence_score numeric/,'P5 history must store confidence score.');
assert.match(sql,/status = any\(array\[[\s\S]*'reverted'/,'P5 status history must preserve reverted decisions.');
assert.doesNotMatch(sql,/grant\s+(insert|update|delete|all).*on\s+(table\s+)?public\.(profiles|daily_logs|goal_phases|target_recommendations)/i,'P5 must not grant direct table writes.');

assert.match(engine,/export const ENGINE_VERSION = '1\.0\.0-p1'/,'P5 must preserve the versioned P1 engine source.');

{
  const raw={
    profile:{calorie_target:2200,protein_target:150,goal_weight:80,desired_weekly_weight_change:-0.25},
    dailyLogs:[],meals:[],mealItems:[],weights:[],goalPhases:[],savedFoods:[],savedMeals:[],
    targetRecommendations:[{
      id:'r1',generated_on:'2026-09-29',lookback_days:28,complete_days:16,logged_days:18,
      weigh_in_count:10,avg_calories:2200,weekly_weight_change:-0.25,estimated_maintenance:2500,
      desired_weekly_weight_change:-0.25,current_target:2200,raw_recommended_target:2220,
      recommended_target:2200,rationale:'Keep target',status:'dismissed',
      decision_payload:{decision:'keep_target'},engine_version:'1.0.0-p1',
      confidence_level:'high',confidence_score:0.9,recommended_protein:150,
      recommended_fat:65,recommended_carbs:250,created_at:'2026-09-29T10:00:00Z',
      resolved_at:'2026-09-29T10:05:00Z',resolution:'kept_current',resolved_target:2200
    }]
  };
  const model=buildDietV2ReadModel(raw,{asOfDate:'2026-09-29'});
  assert.equal(model.strategy.reviewHistory.length,1);
  assert.equal(model.strategy.reviewHistory[0].engineVersion,'1.0.0-p1');
  assert.equal(model.strategy.reviewHistory[0].resolution,'kept_current');
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{recommendation_id:'r1'},error:null};}};
  await stageStrategyReview(client,{
    engineVersion:'1.0.0-p1',generatedOn:'2026-09-29',lookbackDays:28,decision:'increase',
    currentTarget:2200,recommendedTarget:2300,rawTarget:2320,estimatedExpenditure:2700,
    confidenceLevel:'high',confidenceScore:0.9,reason:'Gradual adjustment supported.',
    recommendedProtein:150,recommendedFat:65,recommendedCarbs:260,
    payload:{confidence:{reliableIntakeDays:16,weighIns:10}}
  });
  assert.equal(calls[0].name,'diet_app_stage_strategy_review');
  assert.equal(calls[0].args.p_engine_version,'1.0.0-p1');
  assert.equal(calls[0].args.p_recommended_target,2300);
  assert.equal(calls[0].args.p_request_id.startsWith('app:strategy-stage:'),true);
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{resolution:'accepted'},error:null};}};
  await resolveStrategyReview(client,{recommendationId:'r1',resolution:'accept',effectiveDate:'2026-09-29'});
  assert.equal(calls[0].name,'diet_app_resolve_strategy_review');
  assert.equal(calls[0].args.p_resolution,'accept');
  assert.equal(calls[0].args.p_effective_date,'2026-09-29');
}

{
  const calls=[];
  const client={async rpc(name,args){calls.push({name,args});return {data:{resolution:'reverted'},error:null};}};
  await revertStrategyReview(client,{recommendationId:'r1'});
  assert.equal(calls[0].name,'diet_app_revert_strategy_review');
  assert.equal(calls[0].args.p_recommendation_id,'r1');
}

console.log('Diet Copilot 2.0 P5 adaptive coaching and strategy action tests passed.');
