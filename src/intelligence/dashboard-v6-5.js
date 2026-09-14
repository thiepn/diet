'use strict';

// V6.5 — Weekly Intelligence & Adaptive Coaching 2.0.
// V6.6 owns final rendering, refresh and realtime. This file now exposes the
// reusable weekly/trend/plan intelligence only.

function v65Shift(date,days){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function v65Mean(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
function v65Exact(m){return ['nutrition_label','weighed','manual_exact','saved_food','saved_meal','saved_recipe'].includes(String(m.source||''))}
function v65DayNumber(date){return Date.parse(`${date}T00:00:00Z`)/86400000}

function v65Week(end){
  const start=v65Shift(end,-6);
  const dates=[...new Set((dashboard.meals||[]).filter(m=>m.date>=start&&m.date<=end).map(m=>m.date))];
  const days=dates.map(date=>{
    const meals=mealsFor(date),tot=totalsFor(date),tar=targetsFor(date),fib=typeof v5MacroForDate==='function'?v5MacroForDate(date,'fiber'):null;
    return {date,cal:Number(tot.calories||0),pro:Number(tot.protein||0),fib:fib?.hasAny?Number(fib.value||0):null,target:Number(tar.calories||0),proteinTarget:Number(tar.protein||0),width:meals.reduce((s,m)=>s+Math.max(0,Number(m.caloriesHigh??m.calories??0)-Number(m.caloriesLow??m.calories??0)),0),meals,exact:meals.filter(v65Exact).length};
  });
  const meals=days.reduce((n,d)=>n+d.meals.length,0),fiberDays=days.filter(d=>d.fib!=null);
  return {start,end,logged:days.length,days,avgCal:v65Mean(days.map(d=>d.cal)),avgPro:v65Mean(days.map(d=>d.pro)),avgFib:v65Mean(fiberDays.map(d=>d.fib)),calHit:days.length?100*days.filter(d=>Math.abs(d.cal-d.target)<=150).length/days.length:null,proHit:days.length?100*days.filter(d=>d.pro>=d.proteinTarget).length/days.length:null,exactRate:meals?100*days.reduce((n,d)=>n+d.exact,0)/meals:null,uncertainty:v65Mean(days.map(d=>d.width))};
}

function v65Trend(end=localDateKey(),days=28){
  const start=v65Shift(end,-days+1),weights=(dashboard.weights||[]).filter(w=>w.date>=start&&w.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
  if(weights.length<2)return {weights,span:0,weekly:null,r2:null,confidence:'building_baseline'};
  const xs=weights.map(w=>v65DayNumber(w.date)),ys=weights.map(w=>Number(w.weight)),mx=v65Mean(xs),my=v65Mean(ys),den=xs.reduce((s,x)=>s+(x-mx)**2,0);
  if(!den)return {weights,span:0,weekly:null,r2:null,confidence:'building_baseline'};
  const slope=weights.reduce((s,w,i)=>s+(xs[i]-mx)*(ys[i]-my),0)/den,pred=xs.map(x=>my+slope*(x-mx)),tot=ys.reduce((s,y)=>s+(y-my)**2,0),res=ys.reduce((s,y,i)=>s+(y-pred[i])**2,0),r2=tot?Math.max(0,1-res/tot):null,span=xs.at(-1)-xs[0],weekly=slope*7;
  let confidence='building_baseline';
  if(weights.length>=4&&span>=7){if(span<14)confidence='emerging';else if(span>=21&&weights.length>=7&&(r2??0)>=.35)confidence='established';else if(span>=21&&Math.abs(weekly)<=.1)confidence='possible_plateau';else if((r2??0)<.15)confidence='noisy';else confidence='emerging'}
  return {weights,span,weekly,r2,confidence};
}

function v65GoalForecast(trend){
  const goal=dashboard.profile?.goalWeight,recent=[...(dashboard.weights||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7),weight=v65Mean(recent.map(w=>Number(w.weight))),desired=dashboard.profile?.desiredWeeklyWeightChange;
  if(goal==null||weight==null)return {remaining:null,eta:null,source:'unavailable'};
  const remaining=Math.abs(weight-Number(goal));
  if(trend.weekly!=null&&['established','emerging'].includes(trend.confidence)&&(Number(goal)-weight)*trend.weekly>0&&Math.abs(trend.weekly)>=.05)return {remaining,eta:Math.ceil(remaining/Math.abs(trend.weekly)),source:'observed'};
  if(desired!=null&&(Number(goal)-weight)*Number(desired)>0&&Math.abs(Number(desired))>=.05)return {remaining,eta:Math.ceil(remaining/Math.abs(Number(desired))),source:'planned'};
  return {remaining,eta:null,source:'unavailable'};
}

function v65Plan(cur,trend){
  const server=dashboard.v65Plan?.decisionPayload;if(server)return server;
  const target=Number(dashboard.profile?.calorieTarget||0),desired=dashboard.profile?.desiredWeeklyWeightChange;
  if(cur.logged<7)return {decision:'need_more_data',reason:`${cur.logged} logged day${cur.logged===1?'':'s'} so far. More intake history is needed before changing calories.`,current_target:target};
  if(trend.weights.length<4||trend.span<14||trend.weekly==null)return {decision:'need_more_data',reason:'The weight baseline is still too short for a calorie adjustment.',current_target:target};
  if(desired!=null&&Math.abs(trend.weekly-Number(desired))<=.15)return {decision:'keep_target',reason:'Observed weight pace is close enough to plan. Keep the current calorie target.',current_target:target};
  return {decision:'observe_another_week',reason:'Hold the target and collect another week before making a change.',current_target:target};
}

function v65PlanLabel(plan){return ({keep_target:'Keep target',need_more_data:'Need more data',observe_another_week:'Observe another week',consider_increase:'Consider increasing calories',consider_decrease:'Consider decreasing calories',prepare_maintenance:'Prepare maintenance',transition_maintenance:'Transition to maintenance',disabled:'Adaptive coaching off'})[plan?.decision]||'Current plan'}
function v65Confidence(value){return String(value||'building_baseline').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function v65Delta(a,b,unit,digits=0){if(a==null||b==null)return 'No prior week';const d=a-b;return `${d>0?'+':''}${fmt(d,digits)}${unit} vs prior`}

function v65WeeklyMarkup(){
  const end=localDateKey(),cur=v65Week(end),prev=v65Week(v65Shift(end,-7)),trend=v65Trend(end),plan=v65Plan(cur,trend),forecast=v65GoalForecast(trend),decision=plan.decision;
  const title=cur.logged<3?'Building a reliable baseline':decision==='keep_target'?'Stay with the current plan':['prepare_maintenance','transition_maintenance'].includes(decision)?'Start thinking about maintenance':['consider_increase','consider_decrease'].includes(decision)?'A small adjustment may be justified':'Hold steady and observe';
  const currentTarget=Number((plan.current_target??dashboard.profile?.calorieTarget) || 0),suggested=Number((plan.recommended_target??currentTarget) || 0),uncertain=cur.uncertainty!=null&&cur.uncertainty>=150;
  return `<section class="v65-weekly">
    <div class="v6-section-head"><div><span>Weekly intelligence</span><h3>Adaptive coaching 2.0</h3></div><small>${cur.logged}/7 logged days</small></div>
    <div class="v65-verdict"><div><span>${esc(v65PlanLabel(plan))}</span><strong>${esc(title)}</strong><p>${esc(plan.reason||'More data is needed before changing the plan.')}</p></div><div class="v65-confidence"><span>Trend confidence</span><b>${esc(v65Confidence(trend.confidence))}</b>${trend.weekly==null?'':`<small>${v52Sign(trend.weekly,2,' kg/week')}</small>`}</div></div>
    <div class="v65-kpis">
      <div><span>Calories</span><strong>${cur.avgCal==null?'—':`${fmt(cur.avgCal)} kcal`}</strong><small>${v65Delta(cur.avgCal,prev.avgCal,' kcal')}</small></div>
      <div><span>Protein</span><strong>${cur.avgPro==null?'—':`${fmt(cur.avgPro,1)} g`}</strong><small>${v65Delta(cur.avgPro,prev.avgPro,' g',1)}</small></div>
      <div><span>Fiber</span><strong>${cur.avgFib==null?'—':`${fmt(cur.avgFib,1)} g`}</strong><small>${v65Delta(cur.avgFib,prev.avgFib,' g',1)}</small></div>
      <div><span>Goal forecast</span><strong>${forecast.eta==null?'Building baseline':`~${forecast.eta} wk`}</strong><small>${forecast.remaining==null?'No goal data':`${fmt(forecast.remaining,1)} kg remaining · ${forecast.source}`}</small></div>
    </div>
    <div class="v65-plan"><div><span>Plan decision</span><strong>${esc(v65PlanLabel(plan))}</strong><p>${esc(plan.reason||'No target change is supported yet.')}</p></div>${suggested!==currentTarget?`<div class="v65-target-change"><small>Current</small><b>${fmt(currentTarget)}</b><span>→</span><small>Suggested</small><b>${fmt(suggested)}</b><em>kcal</em></div>`:`<div class="v65-target-stay"><b>${fmt(currentTarget)}</b><small>kcal target</small></div>`}</div>
    ${uncertain?`<div class="v65-evidence-note"><strong>Intake uncertainty is material</strong><span>Stored calorie ranges average about ${fmt(cur.uncertainty)} kcal wide per logged day. Small apparent differences should not trigger a target change.</span></div>`:''}
  </section>`;
}
