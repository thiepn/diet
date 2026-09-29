import assert from 'node:assert/strict';
import {
  buildTrendWeights, assessIntakeCoverage, estimateExpenditure,
  recommendCalories, computeMacroTargets, projectGoal, runAdaptiveNutritionEngine
} from '../src/engine/adaptive-nutrition.mjs';

const DAY=86400000;
function dateAt(start,i){return new Date(Date.parse(start+'T00:00:00Z')+i*DAY).toISOString().slice(0,10)}
function scenario({start='2026-08-01',days=42,startWeight=84,tdee=2800,intake=2800,spikeDay=null,missingWeights=[],partialIntakeDay=null,tdeeShiftDay=null,tdeeAfter=null}){
  const weights=[], intakeDays=[];
  let w=startWeight;
  for(let i=0;i<days;i++){
    const currentTdee=tdeeShiftDay!=null&&i>=tdeeShiftDay?tdeeAfter:tdee;
    const c=typeof intake==='function'?intake(i):intake;
    if(i>0) w += (c-currentTdee)/7700;
    const noise=[0,0.18,-0.12,0.08,-0.05,0.10,-0.08][i%7];
    const spike=i===spikeDay?1.8:0;
    if(!missingWeights.includes(i))weights.push({date:dateAt(start,i),weight:w+noise+spike});
    let calories=c, status='complete', meals=4;
    if(i===partialIntakeDay){calories=900;status='open';meals=1;}
    intakeDays.push({date:dateAt(start,i),calories,meals,status,dayClosed:true});
  }
  return {weights,intakeDays};
}

{
  const s=scenario({spikeDay:25});
  const t=buildTrendWeights(s.weights);
  const before=t.find(x=>x.date===dateAt('2026-08-01',24)).trendWeight;
  const during=t.find(x=>x.date===dateAt('2026-08-01',25)).trendWeight;
  assert.ok(during-before<0.55,`water spike moved trend ${during-before}`);
}

{
  const s=scenario({partialIntakeDay:30});
  const d=assessIntakeCoverage(s.intakeDays).find(x=>x.date===dateAt('2026-08-01',30));
  assert.equal(d.coverage,'partial');
  assert.equal(d.reliability,0);
}

{
  const e=estimateExpenditure({...scenario({tdee:2800,intake:2800}),initialTdee:2700});
  assert.ok(e.current);
  assert.ok(Math.abs(e.current.expenditure-2800)<=90,JSON.stringify(e.current));
  assert.ok(['medium','high'].includes(e.confidence.level),JSON.stringify(e.confidence));
}

{
  const e=estimateExpenditure({...scenario({tdee:2850,intake:2450}),initialTdee:2750});
  assert.ok(Math.abs(e.current.expenditure-2850)<=100,JSON.stringify(e.current));
  assert.ok(e.current.weeklyWeightRate < -0.25);
}

{
  const e=estimateExpenditure({...scenario({tdee:3000,intake:2200}),initialTdee:2900});
  assert.ok(Math.abs(e.current.expenditure-3000)<=140,JSON.stringify(e.current));
  assert.ok(e.current.weeklyWeightRate < -0.5);
}

{
  const e=estimateExpenditure({...scenario({tdee:2750,intake:3050}),initialTdee:2700});
  assert.ok(Math.abs(e.current.expenditure-2750)<=100,JSON.stringify(e.current));
  assert.ok(e.current.weeklyWeightRate > 0.15);
}

{
  const missing=Array.from({length:42},(_,i)=>i).filter(i=>i%3!==0);
  const e=estimateExpenditure({...scenario({tdee:2800,intake:2800,missingWeights:missing}),initialTdee:2750});
  assert.ok(e.current);
  assert.ok(Math.abs(e.current.expenditure-2800)<=120,JSON.stringify(e.current));
}

{
  const clean=estimateExpenditure({...scenario({tdee:2800,intake:2500}),initialTdee:2800});
  const spiky=estimateExpenditure({...scenario({tdee:2800,intake:2500,spikeDay:28}),initialTdee:2800});
  assert.ok(Math.abs(clean.current.expenditure-spiky.current.expenditure)<=90,`${clean.current.expenditure} vs ${spiky.current.expenditure}`);
}

{
  const clean=estimateExpenditure({...scenario({tdee:2800,intake:2600}),initialTdee:2800});
  const partial=estimateExpenditure({...scenario({tdee:2800,intake:2600,partialIntakeDay:30}),initialTdee:2800});
  assert.ok(Math.abs(clean.current.expenditure-partial.current.expenditure)<=50,`${clean.current.expenditure} vs ${partial.current.expenditure}`);
}

{
  const e=estimateExpenditure({...scenario({days:56,tdee:2700,intake:2700,tdeeShiftDay:28,tdeeAfter:3100}),initialTdee:2700});
  assert.ok(e.series.every(x=>Math.abs(x.updateStep)<=50.0001));
  assert.ok(e.current.expenditure>2750,JSON.stringify(e.current));
  assert.ok(e.current.expenditure<3150,JSON.stringify(e.current));
}

{
  const e=estimateExpenditure({...scenario({days:56,tdee:3100,intake:2800,tdeeShiftDay:28,tdeeAfter:2600}),initialTdee:3100});
  assert.ok(e.series.every(x=>Math.abs(x.updateStep)<=50.0001));
  assert.ok(e.current.expenditure<3050,JSON.stringify(e.current));
  assert.ok(e.current.expenditure>2500,JSON.stringify(e.current));
}

{
  const low=recommendCalories({expenditure:2900,currentTarget:2400,goalMode:'lose',targetRateKgPerWeek:-0.3,confidence:{score:.5,level:'low'}});
  assert.equal(low.decision,'hold_for_confidence');
  assert.equal(low.recommendedTarget,2400);
  const high=recommendCalories({expenditure:2900,currentTarget:2400,goalMode:'lose',targetRateKgPerWeek:-0.3,confidence:{score:.9,level:'high'}});
  assert.equal(high.decision,'increase');
  assert.ok(high.appliedStep<=150);
}

{
  const e=estimateExpenditure({...scenario({days:49,tdee:2400,intake:2400}),initialTdee:2600});
  const r=recommendCalories({expenditure:e.current.expenditure,currentTarget:2400,goalMode:'lose',targetRateKgPerWeek:-0.3,confidence:{score:.9,level:'high'}});
  assert.equal(r.decision,'decrease');
  assert.ok(r.recommendedTarget<2400);
}

{
  const cut=recommendCalories({expenditure:2800,currentTarget:2500,goalMode:'lose',targetRateKgPerWeek:-0.3,confidence:{score:.9,level:'high'}});
  const maintain=recommendCalories({expenditure:2800,currentTarget:2500,goalMode:'maintain',targetRateKgPerWeek:-0.3,confidence:{score:.9,level:'high'}});
  assert.ok(cut.rawTarget<maintain.rawTarget);
  assert.equal(maintain.rawTarget,2800);
}

{
  const r=recommendCalories({expenditure:2800,currentTarget:2400,goalMode:'lose',targetRateKgPerWeek:-0.3,currentTrendWeight:80.15,goalWeight:80,confidence:{score:.9,level:'high'}});
  assert.equal(r.decision,'transition_maintenance');
  assert.equal(r.recommendedTarget,2800);
}

{
  const e=estimateExpenditure({...scenario({tdee:2800,intake:2800}),initialTdee:2700});
  assert.ok(e.confidence.uncertaintyKcal>=50);
  assert.equal(e.current.rangeLow,e.current.expenditure-e.confidence.uncertaintyKcal);
  assert.equal(e.current.rangeHigh,e.current.expenditure+e.confidence.uncertaintyKcal);
}

{
  const m=computeMacroTargets({calories:2600,bodyWeightKg:80});
  const total=m.proteinGrams*4+m.fatGrams*9+m.carbGrams*4;
  assert.ok(Math.abs(total-2600)<=10,JSON.stringify(m));
}

{
  const p=projectGoal({currentTrendWeight:84,goalWeight:80,targetRateKgPerWeek:-0.4,startDate:'2026-09-29'});
  assert.equal(p.weeks,10);
  assert.ok(p.projectedDate>'2026-09-29');
  assert.equal(projectGoal({currentTrendWeight:84,goalWeight:80,targetRateKgPerWeek:0.4,startDate:'2026-09-29'}),null);
}

{
  const s=scenario({tdee:2850,intake:2500});
  const input={...s,initialTdee:2800,currentTarget:2500,goalMode:'lose',targetRateKgPerWeek:-0.3,goalWeight:80,endDate:dateAt('2026-08-01',41)};
  assert.deepEqual(runAdaptiveNutritionEngine(input),runAdaptiveNutritionEngine(input));
  assert.ok(runAdaptiveNutritionEngine(input).estimate.current);
  assert.ok(runAdaptiveNutritionEngine(input).macros);
}


{
  const e=estimateExpenditure({...scenario({tdee:2800,intake:2800})});
  assert.ok(e.current);
  assert.ok(e.current.expenditure>2500,'missing initial TDEE must not become zero');
}

{
  const r=recommendCalories({expenditure:2800,currentTarget:null,goalMode:'maintain',confidence:{score:.9,level:'high'}});
  assert.equal(r.decision,'set_initial_target');
  assert.equal(r.recommendedTarget,2800);
  assert.equal(recommendCalories({expenditure:null,currentTarget:null}).recommendedTarget,null);
}

{
  assert.equal(computeMacroTargets({calories:null,bodyWeightKg:80}),null);
  assert.equal(computeMacroTargets({calories:2600,bodyWeightKg:null}),null);
  assert.equal(projectGoal({currentTrendWeight:null,goalWeight:80,targetRateKgPerWeek:-0.3,startDate:'2026-09-29'}),null);
}


{
  const s=scenario({days:35,tdee:2800,intake:2600});
  const noisy=s.intakeDays.map((d,i)=>({...d,status:'open',dayClosed:true,meals:4,uncertaintyKcal:i%2?450:300}));
  const e=estimateExpenditure({weights:s.weights,intakeDays:noisy,initialTdee:2800});
  assert.ok(e.current,'many plausible low-quality days should yield a tentative TDEE');
  assert.equal(e.confidence.level,'low','limited effective intake must cap adjustment confidence');
  const r=recommendCalories({expenditure:e.current.expenditure,currentTarget:2400,goalMode:'lose',targetRateKgPerWeek:-0.3,confidence:e.confidence});
  assert.equal(r.decision,'hold_for_confidence');
  assert.equal(r.recommendedTarget,2400);
}

console.log('Diet Copilot 2.0 P1 adaptive nutrition engine tests passed.');
