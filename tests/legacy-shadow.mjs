import assert from 'node:assert/strict';
import { mapLegacyDietData, mapLegacyDay, deriveLegacyInitialTdee, legacyPhaseToGoalMode } from '../src/engine/legacy-data-adapter.mjs';
import { runAdaptiveNutritionEngine } from '../src/engine/adaptive-nutrition.mjs';
import { buildShadowComparison, shadowGate } from '../src/engine/shadow-validation.mjs';

assert.equal(legacyPhaseToGoalMode('cut',-0.5),'lose');
assert.equal(legacyPhaseToGoalMode('gain',0.25),'gain');
assert.equal(legacyPhaseToGoalMode(null,0),'maintain');

{
  const x=deriveLegacyInitialTdee({currentTarget:2000,desiredWeeklyWeightChange:-0.5});
  assert.equal(Math.round(x.value),2550);
  assert.equal(x.source,'implied_by_current_target_and_goal_rate');
}

{
  const open=mapLegacyDay({date:'2026-09-20',status:'open',calories:2100,meals:4},{asOfDate:'2026-09-29'});
  const partial=mapLegacyDay({date:'2026-09-21',status:'partial',calories:2200,meals:5},{asOfDate:'2026-09-29'});
  const complete=mapLegacyDay({date:'2026-09-22',status:'complete',calories:2150,meals:4},{asOfDate:'2026-09-29'});
  assert.equal(open.coverage,'');
  assert.equal(partial.coverage,'','legacy partial must not be treated as explicit P1 incomplete');
  assert.equal(complete.coverage,'complete');
  assert.equal(open.dayClosed,true);
}

const snapshot={
  profile:{calorie_target:2000,goal_weight:75,desired_weekly_weight_change:-0.5},
  phase:{phase_type:'cut',calorie_target:2000,goal_weight:75,desired_weekly_weight_change:-0.5},
  daily:[],
  weights:[]
};
for(let i=0;i<30;i++){
  const date=new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10);
  snapshot.daily.push({date,status:'open',calories:2050+(i%3)*40,meals:4,uncertainty_kcal:40});
  if(i%2===0) snapshot.weights.push({date,weight:84-(0.35/7)*i+[0,.12,-.08][i%3]});
}
snapshot.daily[10]={...snapshot.daily[10],status:'partial',calories:900,meals:1,uncertainty_kcal:300};
snapshot.daily[12]={...snapshot.daily[12],status:'complete'};

const mapped=mapLegacyDietData(snapshot,{asOfDate:'2026-09-30'});
assert.equal(mapped.engineInput.goalMode,'lose');
assert.equal(mapped.engineInput.currentTarget,2000);
assert.equal(Math.round(mapped.engineInput.initialTdee),2550);
assert.equal(mapped.meta.legacyDailyRows,30);
assert.equal(mapped.engineInput.intakeDays[10].coverage,'');
assert.equal(mapped.engineInput.intakeDays[12].coverage,'complete');

const p1=runAdaptiveNutritionEngine(mapped.engineInput);
assert.ok(p1.estimate.assessedIntake.some(d=>d.coverage==='likely_complete'));
assert.equal(p1.estimate.assessedIntake.find(d=>d.date===snapshot.daily[10].date).reliability,0,'one-meal implausible legacy partial day must not feed TDEE');
assert.ok(p1.estimate.current);

const v1={
  decision:'need_more_data',
  recommended_target:2000,
  estimated_maintenance:2050,
  trend_weight:82.9,
  observed_weekly_pace:0.05,
  trend_confidence:{weight:{confidence:'noisy'}}
};
const report=buildShadowComparison({legacyV1:v1,p1Result:p1,adapterMeta:mapped.meta});
assert.equal(shadowGate(report).pass,true);
assert.equal(report.v1.recommendedTarget,2000);
assert.ok(report.p1.estimatedTdee>0);

{
  const low={
    estimate:{current:{expenditure:2600,weeklyWeightRate:-0.2},trend:[{trendWeight:82}],confidence:{level:'low',score:.4,reliableIntakeDays:12,spanDays:20}},
    calorieRecommendation:{decision:'decrease',recommendedTarget:1900,appliedStep:-100}
  };
  const unsafe=buildShadowComparison({legacyV1:v1,p1Result:low,adapterMeta:mapped.meta});
  assert.equal(shadowGate(unsafe).pass,false);
  assert.ok(shadowGate(unsafe).failures.includes('low_confidence_adjustment'));
}

console.log('Diet Copilot 2.0 P1.5 legacy adapter and shadow validation tests passed.');
