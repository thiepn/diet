'use strict';

// V6.5 — Weekly Intelligence & Adaptive Coaching 2.0.
// The dashboard remains read-only. This layer interprets data already logged
// through ChatGPT and never introduces a nutrition-entry workflow.

function v65DateShift(date,days){
  const d=new Date(`${date}T12:00:00`); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);
}
function v65Mean(values){const a=values.filter(v=>Number.isFinite(v));return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;}
function v65Regression(points){
  if(points.length<2)return null;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),mx=v65Mean(xs),my=v65Mean(ys);
  const den=xs.reduce((s,x)=>s+(x-mx)**2,0); if(!den)return null;
  const slope=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/den;
  const ssTot=ys.reduce((s,y)=>s+(y-my)**2,0),ssRes=points.reduce((s,p)=>s+(p.y-(my+slope*(p.x-mx)))**2,0);
  return {slope,r2:ssTot>0?Math.max(0,1-ssRes/ssTot):null};
}
function v65DayNumber(date){return Date.parse(`${date}T00:00:00Z`)/86400000;}
function v65ExactMeal(m){return ['nutrition_label','weighed','manual_exact','saved_food','saved_meal','saved_recipe'].includes(String(m.source||''));}

function v65WeekMetrics(endDate){
  const start=v65DateShift(endDate,-6), dates=[...new Set((dashboard.meals||[]).filter(m=>m.date>=start&&m.date<=endDate).map(m=>m.date))].sort();
  const days=dates.map(date=>{
    const meals=mealsFor(date),totals=totalsFor(date),targets=targetsFor(date),fiber=typeof v5MacroForDate==='function'?v5MacroForDate(date,'fiber'):{value:0,known:0,unknown:0,complete:false};
    const width=meals.reduce((s,m)=>s+Math.max(0,Number(m.caloriesHigh??m.calories??0)-Number(m.caloriesLow??m.calories??0)),0);
    return {date,meals,calories:Number(totals.calories||0),protein:Number(totals.protein||0),fiber:fiber.hasAny?Number(fiber.value||0):null,fiberComplete:Boolean(fiber.complete),calorieTarget:Number(targets.calories||0),proteinTarget:Number(targets.protein||0),exact:meals.filter(v65ExactMeal).length,width};
  });
  const mealCount=days.reduce((s,d)=>s+d.meals.length,0),exact=days.reduce((s,d)=>s+d.exact,0),fiberDays=days.filter(d=>d.fiber!=null);
  const weights=(dashboard.weights||[]).filter(w=>w.date>=start&&w.date<=endDate).sort((a,b)=>a.date.localeCompare(b.date));
  return {
    start,end:endDate,loggedDays:days.length,days,mealCount,exact,
    avgCalories:v65Mean(days.map(d=>d.calories)),avgTarget:v65Mean(days.map(d=>d.calorieTarget)),calorieHitRate:days.length?100*days.filter(d=>Math.abs(d.calories-d.calorieTarget)<=150).length/days.length:null,
    avgProtein:v65Mean(days.map(d=>d.protein)),proteinHitRate:days.length?100*days.filter(d=>d.protein>=d.proteinTarget).length/days.length:null,
    avgFiber:v65Mean(fiberDays.map(d=>d.fiber)),fiberDays:fiberDays.length,fiberFullDays:fiberDays.filter(d=>d.fiberComplete).length,
    exactRate:mealCount?100*exact/mealCount:null,avgUncertainty:v65Mean(days.map(d=>d.width)),weights,
    weightChange:weights.length>1?Number(weights.at(-1).weight)-Number(weights[0].weight):null
  };
}

function v65Trend(endDate=localDateKey(),days=28){
  const start=v65DateShift(endDate,-days+1);
  const weights=(dashboard.weights||[]).filter(w=>w.date>=start&&w.date<=endDate).sort((a,b)=>a.date.localeCompare(b.date));
  const span=weights.length?Math.max(0,v65DayNumber(weights.at(-1).date)-v65DayNumber(weights[0].date)):0;
  const points=weights.map(w=>({x:v65DayNumber(w.date),y:Number(w.weight)}));
  const reg=v65Regression(points),weekly=reg?reg.slope*7:null;
  const slopeFor=n=>{const s=v65DateShift(endDate,-n+1),a=weights.filter(w=>w.date>=s),r=v65Regression(a.map(w=>({x:v65DayNumber(w.date),y:Number(w.weight)})));return a.length>=4&&a.length&&v65DayNumber(a.at(-1).date)-v65DayNumber(a[0].date)>=7&&r?r.slope*7:null;};
  const s14=slopeFor(14),s21=slopeFor(21),s28=slopeFor(28);
  let confidence='building_baseline';
  if(weights.length>=4&&span>=7&&weekly!=null){
    if(span<14)confidence='emerging';
    else if(span>=21&&weights.length>=7&&(reg?.r2??0)>=.35&&(s14==null||s28==null||Math.abs(s14-s28)<=.2))confidence='established';
    else if(span>=21&&s21!=null&&s28!=null&&Math.abs(s21)<=.1&&Math.abs(s28)<=.1)confidence='possible_plateau';
    else if((reg?.r2??0)<.15)confidence='noisy';
    else confidence='emerging';
  }
  return {weights,span,weekly,r2:reg?.r2??null,s14,s21,s28,confidence};
}

function v65LatestServerPlan(){return dashboard.v65Plan?.decisionPayload||null;}
function v65GoalForecast(trend){
  const goal=dashboard.profile?.goalWeight;
  const recent=[...(dashboard.weights||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
  const trendWeight=v65Mean(recent.map(w=>Number(w.weight)));
  const desired=dashboard.profile?.desiredWeeklyWeightChange;
  if(goal==null||trendWeight==null)return {goal,trendWeight,remaining:null,eta:null,source:'unavailable',confidence:'building_baseline'};
  const remaining=Math.abs(trendWeight-Number(goal));
  const towardObserved=trend.weekly!=null&&(Number(goal)-trendWeight)*trend.weekly>0&&Math.abs(trend.weekly)>=.05;
  const towardPlanned=desired!=null&&(Number(goal)-trendWeight)*Number(desired)>0&&Math.abs(Number(desired))>=.05;
  if(towardObserved&&['established','emerging'].includes(trend.confidence))return {goal:Number(goal),trendWeight,remaining,eta:Math.ceil(remaining/Math.abs(trend.weekly)),source:'observed',confidence:trend.confidence};
  if(towardPlanned)return {goal:Number(goal),trendWeight,remaining,eta:Math.ceil(remaining/Math.abs(Number(desired))),source:'planned',confidence:'planned'};
  return {goal:Number(goal),trendWeight,remaining,eta:null,source:'unavailable',confidence:trend.confidence};
}

function v65Plan(current,trend){
  const server=v65LatestServerPlan(); if(server)return server;
  const desired=dashboard.profile?.desiredWeeklyWeightChange;
  const minimum=Math.max(14,Number(dashboard.profile?.adaptiveMinCompleteDays||14));
  if(current.loggedDays<Math.min(7,minimum))return {decision:'need_more_data',reason:`${current.loggedDays} logged day${current.loggedDays===1?'':'s'} so far. More intake history is needed before changing calories.`,current_target:Number(dashboard.profile?.calorieTarget||0)};
  if(trend.weights.length<4||trend.span<14||trend.weekly==null)return {decision:'need_more_data',reason:'The weight baseline is still too short for a calorie adjustment.',current_target:Number(dashboard.profile?.calorieTarget||0)};
  if(desired!=null&&Math.abs(trend.weekly-Number(desired))<=.15)return {decision:'keep_target',reason:'Observed weight pace is close enough to plan. Keep the current calorie target.',current_target:Number(dashboard.profile?.calorieTarget||0),observed_weekly_pace:trend.weekly,desired_weekly_pace:Number(desired)};
  return {decision:'observe_another_week',reason:'Keep collecting data before making a target change.',current_target:Number(dashboard.profile?.calorieTarget||0),observed_weekly_pace:trend.weekly,desired_weekly_pace:desired};
}

function v65Associations(endDate=localDateKey()){
  const start=v65DateShift(endDate,-27), dates=[...new Set((dashboard.meals||[]).filter(m=>m.date>=start&&m.date<=endDate).map(m=>m.date))];
  const rows=dates.map(date=>{const meals=mealsFor(date),t=totalsFor(date),target=targetsFor(date);return {date,cal:Number(t.calories||0),protein:Number(t.protein||0),delta:Math.abs(Number(t.calories||0)-Number(target.calories||0)),allExact:meals.length>0&&meals.every(v65ExactMeal),weekend:[0,6].includes(new Date(`${date}T12:00:00`).getDay())};});
  const out=[],exact=rows.filter(r=>r.allExact),est=rows.filter(r=>!r.allExact);
  if(exact.length>=2&&est.length>=2){const a=v65Mean(exact.map(r=>r.delta)),b=v65Mean(est.map(r=>r.delta));if(a!=null&&b!=null&&Math.abs(a-b)>=75)out.push(a<b?`Exact/reused days were about ${fmt(b-a)} kcal closer to target on average.`:`Estimated days were about ${fmt(a-b)} kcal closer to target on average.`);}
  const we=rows.filter(r=>r.weekend),wd=rows.filter(r=>!r.weekend); if(we.length>=2&&wd.length>=2){const a=v65Mean(we.map(r=>r.cal)),b=v65Mean(wd.map(r=>r.cal));if(a!=null&&b!=null&&Math.abs(a-b)>=150)out.push(`Weekend logged intake averaged about ${fmt(Math.abs(a-b))} kcal ${a>b?'higher':'lower'} than weekdays.`);}
  return out.slice(0,2);
}

function v65Verdict(cur,trend,plan,forecast){
  if(cur.loggedDays<3)return {kind:'building',title:'Building a reliable baseline',copy:'There is not enough logged data this week for a strong conclusion yet.'};
  if(['transition_maintenance','prepare_maintenance'].includes(plan.decision))return {kind:'transition',title:'Start thinking about maintenance',copy:plan.reason};
  if(plan.decision==='keep_target')return {kind:'stable',title:'Stay with the current plan',copy:plan.reason};
  if(['consider_increase','consider_decrease'].includes(plan.decision))return {kind:'adjust',title:'A small adjustment may be justified',copy:plan.reason};
  if(plan.decision==='observe_another_week')return {kind:'observe',title:'Hold steady and observe',copy:plan.reason};
  if(forecast.remaining!=null&&forecast.remaining<=1.5)return {kind:'transition',title:'Goal is getting close',copy:'Avoid aggressive changes this close to the goal; the maintenance transition matters more.'};
  return {kind:'building',title:'Keep building the evidence',copy:plan.reason||'More data is needed before changing the plan.'};
}

function v65Delta(value,unit='',digits=0){if(value==null||!Number.isFinite(Number(value)))return '—';const n=Number(value),sign=n>0?'+':'';return `${sign}${fmt(n,digits)}${unit}`;}
function v65PlanLabel(plan){const map={keep_target:'Keep target',need_more_data:'Need more data',observe_another_week:'Observe another week',consider_increase:'Consider increasing calories',consider_decrease:'Consider decreasing calories',prepare_maintenance:'Prepare maintenance',transition_maintenance:'Transition to maintenance',disabled:'Adaptive coaching off'};return map[plan?.decision]||'Current plan';}
function v65ConfidenceLabel(value){return String(value||'building_baseline').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}

function v65WeeklyMarkup(){
  const end=localDateKey(),cur=v65WeekMetrics(end),prev=v65WeekMetrics(v65DateShift(end,-7)),trend=v65Trend(end,28),plan=v65Plan(cur,trend),forecast=v65GoalForecast(trend),verdict=v65Verdict(cur,trend,plan,forecast),associations=v65Associations(end);
  const changes={cal:cur.avgCalories!=null&&prev.avgCalories!=null?cur.avgCalories-prev.avgCalories:null,pro:cur.avgProtein!=null&&prev.avgProtein!=null?cur.avgProtein-prev.avgProtein:null,fib:cur.avgFiber!=null&&prev.avgFiber!=null?cur.avgFiber-prev.avgFiber:null};
  const planTarget=Number(plan.recommended_target??plan.recommendedTarget??plan.current_target??dashboard.profile?.calorieTarget||0),currentTarget=Number(plan.current_target??dashboard.profile?.calorieTarget||0);
  const uncertainty=cur.avgUncertainty!=null&&cur.avgUncertainty>=150;
  return `<section class="v65-weekly ${esc(verdict.kind)}">
    <div class="v6-section-head"><div><span>Weekly intelligence</span><h3>Adaptive coaching 2.0</h3></div><small>${cur.loggedDays}/7 logged days</small></div>
    <div class="v65-verdict"><div><span>${esc(v65PlanLabel(plan))}</span><strong>${esc(verdict.title)}</strong><p>${esc(verdict.copy)}</p></div><div class="v65-confidence"><span>Trend confidence</span><b>${esc(v65ConfidenceLabel(trend.confidence))}</b>${trend.weekly==null?'':`<small>${v52Sign(trend.weekly,2,' kg/week')}</small>`}</div></div>
    <div class="v65-kpis">
      <div><span>Calories</span><strong>${cur.avgCalories==null?'—':`${fmt(cur.avgCalories)} kcal`}</strong><small>${prev.avgCalories==null?'This week':`${v65Delta(changes.cal,' kcal')} vs prior`}</small></div>
      <div><span>Protein</span><strong>${cur.avgProtein==null?'—':`${fmt(cur.avgProtein,1)} g`}</strong><small>${prev.avgProtein==null?'This week':`${v65Delta(changes.pro,' g',1)} vs prior`}</small></div>
      <div><span>Fiber</span><strong>${cur.avgFiber==null?'—':`${fmt(cur.avgFiber,1)} g`}</strong><small>${prev.avgFiber==null?'Known values':`${v65Delta(changes.fib,' g',1)} vs prior`}</small></div>
      <div><span>Goal forecast</span><strong>${forecast.eta==null?'Building baseline':`~${forecast.eta} wk`}</strong><small>${forecast.remaining==null?'No goal data':`${fmt(forecast.remaining,1)} kg remaining · ${forecast.source}`}</small></div>
    </div>
    <div class="v65-plan"><div><span>Plan decision</span><strong>${esc(v65PlanLabel(plan))}</strong><p>${esc(plan.reason||'No target change is supported yet.')}</p></div>${currentTarget&&planTarget&&planTarget!==currentTarget?`<div class="v65-target-change"><small>Current</small><b>${fmt(currentTarget)}</b><span>→</span><small>Suggested</small><b>${fmt(planTarget)}</b><em>kcal</em></div>`:`<div class="v65-target-stay"><b>${fmt(currentTarget||dashboard.profile?.calorieTarget||0)}</b><small>kcal target</small></div>`}</div>
    ${uncertainty?`<div class="v65-evidence-note"><strong>Intake uncertainty is material</strong><span>Stored calorie ranges average about ${fmt(cur.avgUncertainty)} kcal wide per logged day. Small apparent differences should not trigger a target change.</span></div>`:''}
    ${associations.length?`<div class="v65-associations"><span>Patterns worth noticing</span>${associations.map(x=>`<p>${esc(x)} <small>Association only, not proof of cause.</small></p>`).join('')}</div>`:''}
  </section>`;
}

async function v65LoadPlan(){
  if(!cloud.client||!cloud.user)return;
  try{
    const {data,error}=await cloud.client.from('target_recommendations').select('id,generated_on,status,current_target,recommended_target,rationale,decision_payload,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    dashboard.v65Plan=data?{id:data.id,generatedOn:data.generated_on,status:data.status,currentTarget:data.current_target==null?null:Number(data.current_target),recommendedTarget:data.recommended_target==null?null:Number(data.recommended_target),rationale:data.rationale||'',decisionPayload:data.decision_payload||null,createdAt:data.created_at}:null;
    saveDashboardCache();
  }catch(error){console.warn('V6.5 plan read failed',error);}
}

const v65RenderInsightsBase=renderInsights;
renderInsights=function renderInsightsV65(){
  const result=v65RenderInsightsBase();
  const root=app.querySelector('.p3-insights-view'); if(!root)return result;
  root.querySelector('.v65-weekly')?.remove();
  const coach=root.querySelector('.v6-coach');
  if(coach)coach.insertAdjacentHTML('afterend',v65WeeklyMarkup()); else root.insertAdjacentHTML('afterbegin',v65WeeklyMarkup());
  return result;
};

const v65RefreshBase=refreshData;
refreshData=async function refreshDataV65(options={}){
  await v65RefreshBase(options);
  if(!cloud.user)return;
  await v65LoadPlan();
  render();
};

// Preserve the core product boundary: Today stays status/guidance only.
const v65RenderTodayBase=renderToday;
renderToday=function renderTodayV65(){const result=v65RenderTodayBase();app.querySelector('.today-v2 .v6-capture-card')?.remove();return result;};

queueMicrotask(()=>{
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  if(cloud.user)v65LoadPlan().then(()=>render()).catch(()=>{});
});
