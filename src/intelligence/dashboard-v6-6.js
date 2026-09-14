'use strict';

// V6.6 — Product Consolidation & Intelligent UX.
// Final web intelligence layer: one coherent read-only dashboard, consistent
// provenance/confidence, and a single refresh/realtime path. Food logging stays
// a direct ChatGPT conversation; no dashboard capture or nutrition-entry UI.

const V66_VERSION = '6.6';
const V66_EXACT_SOURCES = new Set(['nutrition_label','weighed','manual_exact','saved_food','saved_meal','saved_recipe']);
let v66HistoryFilter = localStorage.getItem('diet-v66-history-filter') || 'all';
let v66RealtimeTimer = null;
let v66RefreshPromise = null;

function v66ExactMeal(meal){
  return V66_EXACT_SOURCES.has(String(meal?.source||''));
}
function v66RangeStart(days){
  if(!Number.isFinite(days)) return '0000-01-01';
  const d=new Date(`${localDateKey()}T12:00:00`); d.setDate(d.getDate()-Math.max(1,days)+1); return d.toISOString().slice(0,10);
}
function v66MealRange(meal){
  const low=meal?.caloriesLow==null?null:Number(meal.caloriesLow), high=meal?.caloriesHigh==null?null:Number(meal.caloriesHigh);
  return low!=null&&high!=null&&Math.abs(high-low)>=1 ? {low,high,width:Math.max(0,high-low)} : null;
}
function v66ConfidenceForRange(days=28){
  const start=v66RangeStart(days), end=localDateKey();
  const meals=(dashboard.meals||[]).filter(m=>m.date>=start&&m.date<=end);
  const logged=[...new Set(meals.map(m=>m.date))];
  const exact=meals.filter(v66ExactMeal).length;
  const exactRate=meals.length?Math.round(exact/meals.length*100):null;
  const widths=logged.map(date=>mealsFor(date).reduce((sum,m)=>sum+(v66MealRange(m)?.width||0),0));
  const avgWidth=widths.length?average(widths):null;
  let level='building', label='Building';
  if(meals.length>=4){
    if((exactRate??0)>=80&&(avgWidth??0)<=120){level='high';label='High';}
    else if((exactRate??0)>=50&&(avgWidth??0)<=350){level='moderate';label='Moderate';}
    else {level='low';label='Low';}
  }
  return {level,label,meals:meals.length,loggedDays:logged.length,exact,estimated:Math.max(0,meals.length-exact),exactRate,avgWidth};
}
function v66WeightConfidence(days=28){
  const trend=typeof v65Trend==='function'?v65Trend(localDateKey(),days):{weights:[],span:0,weekly:null,confidence:'building_baseline'};
  const map={established:['high','High'],emerging:['moderate','Moderate'],possible_plateau:['moderate','Moderate'],noisy:['low','Low'],building_baseline:['building','Building']};
  const [level,label]=map[trend.confidence]||map.building_baseline;
  return {level,label,trend};
}
function v66ConfidencePill(label,level){
  return `<span class="v66-confidence ${esc(level)}"><i aria-hidden="true"></i>${esc(label)} confidence</span>`;
}

function v66Provenance(metric,days=28){
  const m=typeof v52Metrics==='function'?v52Metrics(days):null;
  const nutrition=v66ConfidenceForRange(days), weight=v66WeightConfidence(days);
  if(!m)return {title:'Data provenance',copy:'Metrics are calculated from the canonical Diet Copilot dataset.',rows:[]};
  const common=[
    ['Window',`${days} days`],
    ['Logged intake days',String(m.loggedDays||0)],
    ['Meals',String(m.meals||0)],
    ['Exact / reused',m.exactRate==null?'—':`${m.exactRate}%`],
    ['Day status','Coverage metadata only']
  ];
  if(metric==='calories')return {title:'How calorie metrics are calculated',copy:'Every day with logged food contributes. Open, Partial and Complete status never excludes valid intake.',confidence:nutrition,rows:[...common,['Average',m.avgCalories==null?'—':`${fmt(m.avgCalories)} kcal`],['Target average',m.avgCalTarget==null?'—':`${fmt(m.avgCalTarget)} kcal`],['On-target rule','Within ±150 kcal']]};
  if(metric==='protein')return {title:'How protein metrics are calculated',copy:'Protein averages and target-hit rates use every logged intake day.',confidence:nutrition,rows:[...common,['Average',m.avgProtein==null?'—':`${fmt(m.avgProtein,1)} g`],['Target',`${fmt(m.proteinTarget)} g`],['Target hits',`${m.proteinHits||0}/${m.loggedDays||0}`]]};
  if(metric==='fiber')return {title:'How fiber metrics are calculated',copy:'Known fiber values count. Missing fiber remains unknown rather than becoming zero; full coverage is reported separately.',confidence:nutrition,rows:[...common,['Known-fiber days',String(m.fiberCoveredDays||0)],['Full-coverage days',String(m.fiberFullDays||0)],['Known average',m.avgFiber==null?'—':`${fmt(m.avgFiber,1)} g`],['Target hits',`${m.fiberHits||0}/${m.fiberCoveredDays||0}`]]};
  if(metric==='weight')return {title:'How the weight trend is calculated',copy:'Individual weigh-ins remain visible, but pace coaching waits for enough observations and time span.',confidence:weight,rows:[['Window',`${days} days`],['Weigh-ins',String(m.weighIns||0)],['Trend weight',m.trendWeight==null?'—':`${fmt(m.trendWeight,1)} kg`],['Observed pace',m.pace==null?'Building baseline':v52Sign(m.pace,2,' kg/week')],['Trend confidence',weight.label]]};
  if(metric==='goal')return {title:'How goal progress is calculated',copy:'Goal progress uses the active phase baseline and trend weight. ETA uses observed pace only when it is trustworthy; otherwise planned pace is shown.',confidence:weight,rows:[['Phase baseline',m.startWeight==null?'—':`${fmt(m.startWeight,1)} kg`],['Trend weight',m.trendWeight==null?'—':`${fmt(m.trendWeight,1)} kg`],['Goal',m.goal==null?'Not set':`${fmt(m.goal,1)} kg`],['Remaining',m.remaining==null?'—':`${fmt(m.remaining,1)} kg`],['ETA source',m.etaSource||'Building baseline']]};
  return {title:'How plan adherence is calculated',copy:'The score weights calorie consistency 45%, protein 35%, and known fiber 20% when fiber data exists. Day status does not change inclusion.',confidence:nutrition,rows:[...common,['Adherence',m.adherenceScore==null?'—':`${m.adherenceScore}%`],['Calorie weight','45%'],['Protein weight','35%'],['Known fiber weight','20%']]};
}
function v66ProvenanceMarkup(metric,days=28){
  const p=v66Provenance(metric,days);
  return `<section class="v66-provenance"><div class="v66-provenance-head"><div><h3>${esc(p.title)}</h3><p>${esc(p.copy)}</p></div>${p.confidence?v66ConfidencePill(p.confidence.label,p.confidence.level):''}</div><div class="v66-provenance-grid">${p.rows.map(([a,b])=>`<div><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}</div></section>`;
}
function v66OpenExplanation(metric,trigger){
  if(typeof v53EnsureDetailDialog!=='function')return;
  const dialog=v53EnsureDetailDialog();
  dialog._v53Trigger=trigger||document.activeElement;
  const title=dialog.querySelector('#v53DetailTitle'), eyebrow=dialog.querySelector('#v53DetailEyebrow'), body=dialog.querySelector('#v53DetailBody');
  if(eyebrow)eyebrow.textContent='Metric provenance';
  if(title)title.textContent='How this number is built';
  if(body)body.innerHTML=v66ProvenanceMarkup(metric,typeof v52StatsRange==='number'?v52StatsRange:28);
  document.body.classList.add('v53-detail-open');
  if(!dialog.open)dialog.showModal();
}

function v66PatchDetail(fnName,metric,replacements=[]){
  const base=globalThis[fnName];
  if(typeof base!=='function')return;
  globalThis[fnName]=function v66PatchedDetail(data){
    let html=base(data);
    for(const [from,to] of replacements)html=html.replaceAll(from,to);
    return `${html}${v66ProvenanceMarkup(metric,28)}`;
  };
}
v66PatchDetail('v53CaloriesDetail','calories',[
  ['Complete days only, so missing meals do not distort averages','All logged intake days are included; day status is coverage metadata only'],
  ['Complete days','Logged days'],
  ['Finalized day','Logged data'],
  ['Live day','Logged data']
]);
v66PatchDetail('v53ProteinDetail','protein',[
  ['Complete days only','All logged intake days'],
  ['Days hit','Logged-day hits']
]);
v66PatchDetail('v53FiberDetail','fiber',[
  ['Only days with complete fiber coverage are scored','Known fiber values are used; full coverage is shown separately']
]);
v66PatchDetail('v53WeightDetail','weight');
v66PatchDetail('v53GoalDetail','goal');
v66PatchDetail('v53ProgressDetail','adherence');

function v66PlanState(){
  const end=localDateKey(),cur=typeof v65Week==='function'?v65Week(end):null,trend=typeof v65Trend==='function'?v65Trend(end,28):null;
  const plan=dashboard.v65Plan?.decisionPayload || (cur&&trend&&typeof v65Plan==='function'?v65Plan(cur,trend):null) || {};
  const label=typeof v65PlanLabel==='function'?v65PlanLabel(plan):String(plan.decision||'Current plan').replaceAll('_',' ');
  const title=plan.decision==='keep_target'?'Stay with the current plan':plan.decision==='observe_another_week'?'Hold steady and observe':plan.decision==='consider_increase'||plan.decision==='consider_decrease'?'A small adjustment may be justified':plan.decision==='prepare_maintenance'||plan.decision==='transition_maintenance'?'Maintenance transition is approaching':'Keep building the evidence';
  return {plan,label,title,trend,cur};
}
function v66WeeklyOverviewMarkup(){
  const {plan,label,title,trend,cur}=v66PlanState();
  const confidence=v66WeightConfidence(28), nutrition=v66ConfidenceForRange(28);
  const current=Number((plan.current_target??dashboard.profile?.calorieTarget)||0), suggested=plan.recommended_target==null?null:Number(plan.recommended_target);
  return `<section class="v66-panel v66-weekly"><div class="v66-section-head"><div><span>This week</span><h3>${esc(title)}</h3></div>${v66ConfidencePill(confidence.label,confidence.level)}</div><p class="v66-lead">${esc(plan.reason||'Diet Copilot is still building enough evidence for a plan-level decision.')}</p><div class="v66-week-grid"><div><span>Plan</span><strong>${esc(label)}</strong><small>${suggested!=null&&suggested!==current?`${fmt(current)} → ${fmt(suggested)} kcal`:`${fmt(current)} kcal target`}</small></div><div><span>Logged days</span><strong>${cur?.logged??0}/7</strong><small>Every logged day counts</small></div><div><span>Nutrition confidence</span><strong>${esc(nutrition.label)}</strong><small>${nutrition.exactRate==null?'No meals yet':`${nutrition.exactRate}% exact / reused`}</small></div><div><span>Weight evidence</span><strong>${esc(confidence.label)}</strong><small>${trend?.weekly==null?'Building baseline':v52Sign(trend.weekly,2,' kg/week')}</small></div></div></section>`;
}
function v66NutritionMarkup(){
  const m=v52Metrics(typeof v52StatsRange==='number'?v52StatsRange:28), range=typeof v52StatsRange==='number'?v52StatsRange:28;
  const cards=[
    ['calories','Calories',m.avgCalories==null?'—':`${fmt(m.avgCalories)} kcal`,m.calorieHitRate==null?'No intake yet':`${m.calorieHitRate}% within ±150 kcal`,m.calorieHitRate],
    ['protein','Protein',m.avgProtein==null?'—':`${fmt(m.avgProtein,1)} g`,m.proteinHitRate==null?'No intake yet':`${m.proteinHitRate}% hit target`,m.proteinHitRate],
    ['fiber','Fiber',m.avgFiber==null?'—':`${fmt(m.avgFiber,1)} g`,m.fiberCoveredDays?`${m.fiberCoveredDays} days with known fiber`:'Fiber not known yet',m.fiberHitRate]
  ];
  return `<section class="v66-panel v66-nutrition"><div class="v66-section-head"><div><span>Nutrition</span><h3>What the logged data says</h3></div><div class="v52-range v66-range" role="group" aria-label="Insights range">${[7,28,90].map(d=>`<button type="button" class="${range===d?'active':''}" data-v66-range="${d}">${d}D</button>`).join('')}</div></div><div class="v66-card-grid">${cards.map(([key,label,value,copy,pct])=>`<button type="button" class="v66-metric-card ${key}" data-v66-explain="${key}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(copy)}</small>${pct==null?'':`<i aria-hidden="true"><b style="width:${Math.max(0,Math.min(100,Number(pct)||0))}%"></b></i>`}<em>How calculated</em></button>`).join('')}</div></section>`;
}
function v66WeightGoalMarkup(){
  const m=v52Metrics(28), trend=v66WeightConfidence(28), phase=typeof v5CurrentPhase==='function'?v5CurrentPhase():null;
  return `<section class="v66-panel v66-weight-goal"><div class="v66-section-head"><div><span>Weight & goal</span><h3>Progress without daily-scale overreaction</h3></div>${v66ConfidencePill(trend.label,trend.level)}</div><div class="v66-card-grid v66-two"><button type="button" class="v66-metric-card weight" data-v66-explain="weight"><span>Trend weight</span><strong>${m.trendWeight==null?'—':`${fmt(m.trendWeight,1)} kg`}</strong><small>${m.pace==null?'Building baseline':`${v52Sign(m.pace,2,' kg/week')} observed pace`}</small><em>How calculated</em></button><button type="button" class="v66-metric-card goal" data-v66-explain="goal"><span>${esc(phase?.name||'Goal')}</span><strong>${m.goalProgress==null?'Building baseline':`${fmt(m.goalProgress)}%`}</strong><small>${m.remaining==null?'Set a goal weight to track progress':`${fmt(m.remaining,1)} kg remaining${m.etaWeeks!=null?` · ~${m.etaWeeks} weeks`:''}`}</small><em>How calculated</em></button></div></section>`;
}
function v66FoodMemoryMarkup(){
  const stats=typeof v63MemoryStats==='function'?v63MemoryStats():{foods:dashboard.savedFoods||[],aliases:0,barcodes:0,learnedFoods:0,patterns:[],pairings:[]};
  const top=[...(stats.foods||[])].sort((a,b)=>Number(b.useCount||0)-Number(a.useCount||0)||String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||''))).slice(0,3);
  const patterns=[...(stats.patterns||[]).slice(0,2),...(stats.pairings||[]).slice(0,1)];
  return `<section class="v66-panel v66-memory"><div class="v66-section-head"><div><span>Food intelligence</span><h3>Memory that reduces re-estimation</h3></div><small>${stats.foods?.length||0} saved foods</small></div><div class="v66-memory-grid"><div><span>Remembered foods</span>${top.length?top.map(food=>{const portion=typeof v63UsualPortion==='function'?v63UsualPortion(food.id):null;const q=portion?.quantity||food.quantity||'';return `<div class="v66-memory-row"><div><strong>${esc(food.name)}</strong><small>${q?`usual ${esc(q)}`:'portion still learning'}</small></div><b>${fmt(food.protein,1)} g</b></div>`}).join(''):'<p class="v66-empty">Exact foods will appear here automatically after normal ChatGPT logging.</p>'}</div><div><span>Recognized routines</span>${patterns.length?patterns.map(p=>`<div class="v66-memory-row"><div><strong>${esc(p.name||`${p.nameA||'Food'} + ${p.nameB||'Food'}`)}</strong><small>${esc(p.mealType||'Repeated pattern')}</small></div><b>${p.uses||0}×</b></div>`).join(''):'<p class="v66-empty">No repeated pattern is strong enough yet.</p>'}</div></div></section>`;
}
function v66QualityActivityMarkup(){
  const n=v66ConfidenceForRange(28), latest=[...(dashboard.activityDays||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
  return `<section class="v66-panel v66-quality"><div class="v66-section-head"><div><span>Data quality</span><h3>Coverage & supporting context</h3></div>${v66ConfidencePill(n.label,n.level)}</div><div class="v66-quality-grid"><button type="button" data-v66-explain="adherence"><span>Nutrition evidence</span><strong>${n.meals} meals · ${n.loggedDays} days</strong><small>${n.exactRate==null?'No source mix yet':`${n.exactRate}% exact/reused · ${n.estimated} estimated`}</small><em>How calculated</em></button><div><span>Activity</span><strong>${latest?.steps!=null?`${fmt(latest.steps)} steps`:'No activity synced'}</strong><small>${latest?`${prettyDate(latest.date,{day:'numeric',month:'short'})}${latest.exerciseMinutes!=null?` · ${fmt(latest.exerciseMinutes)} exercise min`:''}`:'Activity stays separate from food calories and is never automatically eaten back.'}</small></div></div></section>`;
}

renderInsights=function renderInsightsV66(){
  if(typeof p3GateView==='function'&&p3GateView())return;
  app.innerHTML=`<div class="p3-view p3-insights-view v66-insights">${p3PageHeader('Insights','One concise view of the week, nutrition, weight, food memory and data quality.')}<div class="v66-insights-stack">${v66WeeklyOverviewMarkup()}${v66NutritionMarkup()}${v66WeightGoalMarkup()}${v66FoodMemoryMarkup()}${v66QualityActivityMarkup()}</div></div>`;
  app.querySelectorAll('[data-v66-range]').forEach(button=>button.addEventListener('click',()=>{v52StatsRange=Number(button.dataset.v66Range);renderInsights()}));
  app.querySelectorAll('[data-v66-explain]').forEach(button=>button.addEventListener('click',()=>v66OpenExplanation(button.dataset.v66Explain,button)));
};

function v66HistoryMealRow(meal){
  const source=typeof p2SourceMeta==='function'?p2SourceMeta(meal):{label:meal.source||'Recorded',cls:''};
  const range=v66MealRange(meal), exact=v66ExactMeal(meal), confidence=String(meal.confidence||'medium');
  return `<div class="p3-history-meal v66-history-meal ${exact?'exact':'estimated'}"><div class="p3-history-meal-main"><div class="p3-history-meal-kicker"><span class="p3-meal-dot" aria-hidden="true"></span><span>${esc(meal.type||'Meal')}</span><span class="v66-source ${esc(source.cls||'')}">${esc(source.label)}</span></div><strong>${esc(meal.title||'Meal')}</strong><small><span class="protein-text">${fmt(meal.protein,1)} g protein</span>${meal.fiber==null?'':` · ${fmt(meal.fiber,1)} g fiber`} · ${esc(confidence)} confidence${range?` · likely ${fmt(range.low)}–${fmt(range.high)} kcal`:''}</small></div><div class="p3-history-meal-kcal">${fmt(meal.calories)}<small>kcal</small></div></div>`;
}
function v66HistoryMatches(meal){return v66HistoryFilter==='all'||(v66HistoryFilter==='exact'?v66ExactMeal(meal):!v66ExactMeal(meal));}
function v66HistoryDay(date){
  const all=mealsFor(date),shown=all.filter(v66HistoryMatches),total=totalsFor(date),target=targetsFor(date),weight=weightFor(date),status=p3StatusLabel(date),pct=target.calories?Math.max(0,Math.min(100,total.calories/target.calories*100)):0;
  return `<details class="p3-history-day v66-history-day"><summary><div class="p3-history-date-block"><strong>${prettyDate(date,{weekday:'short',day:'numeric',month:'short'})}</strong><span class="p3-day-status ${status.cls}">${status.label}</span></div><div class="p3-history-metrics"><div class="p3-history-metric calories"><strong>${fmt(total.calories)}</strong><span>kcal</span></div><div class="p3-history-metric protein"><strong>${fmt(total.protein,1)}</strong><span>g protein</span></div><div class="p3-history-metric weight"><strong>${weight?fmt(weight.weight,1):'—'}</strong><span>kg</span></div></div><div class="p3-history-progress" aria-hidden="true"><span style="width:${pct}%"></span></div><svg class="p3-history-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><div class="p3-history-body">${shown.length?shown.map(v66HistoryMealRow).join(''):`<div class="p3-history-no-meals">No ${v66HistoryFilter==='all'?'meals':v66HistoryFilter} meals in this day.</div>`}<div class="p3-history-day-footer"><span>Day total always includes all logged meals</span><span>Target ${fmt(target.calories)} kcal · ${fmt(target.protein)} g protein</span></div></div></details>`;
}
renderHistory=function renderHistoryV66(){
  if(typeof p3GateView==='function'&&p3GateView())return;
  const dates=datesInRange(historyRange).sort().reverse().filter(date=>v66HistoryFilter==='all'||mealsFor(date).some(v66HistoryMatches));
  app.innerHTML=`<div class="p3-view p3-history-view v66-history">${p3PageHeader('History','Browse logged days with clearer source, confidence and uncertainty information.')}<div class="v66-history-controls">${p3RangeBar(historyRange,'history',[[3,'3D'],[7,'7D'],[14,'14D'],[30,'30D'],[90,'90D'],[Infinity,'All']])}<div class="v66-filter" role="group" aria-label="Meal source quality"><button type="button" class="${v66HistoryFilter==='all'?'active':''}" data-v66-history-filter="all">All</button><button type="button" class="${v66HistoryFilter==='exact'?'active':''}" data-v66-history-filter="exact">Exact</button><button type="button" class="${v66HistoryFilter==='estimated'?'active':''}" data-v66-history-filter="estimated">Estimated</button></div></div><p class="v66-history-note">Filters change the meal list only. Day totals always remain the full logged total.</p><div class="p3-history-list">${dates.length?dates.map(v66HistoryDay).join(''):`<div class="p3-empty"><strong>No matching history</strong><span>Try another range or source filter.</span></div>`}</div></div>`;
  app.querySelectorAll('[data-history-range]').forEach(button=>button.addEventListener('click',()=>{historyRange=button.dataset.historyRange==='all'?Infinity:Number(button.dataset.historyRange);renderHistory()}));
  app.querySelectorAll('[data-v66-history-filter]').forEach(button=>button.addEventListener('click',()=>{v66HistoryFilter=button.dataset.v66HistoryFilter;localStorage.setItem('diet-v66-history-filter',v66HistoryFilter);renderHistory()}));
};

try{
  const savedMetric=localStorage.getItem('diet-v66-trend-metric');
  if(['weight','calories','protein','fiber'].includes(savedMetric))p3TrendMetric=savedMetric;
  const savedRange=localStorage.getItem('diet-v66-trend-range');
  if(savedRange)trendRange=savedRange==='all'?Infinity:Number(savedRange)||trendRange;
}catch{}
const v66RenderTrendsBase=renderTrends;
renderTrends=function renderTrendsV66(){
  const result=v66RenderTrendsBase();
  const root=app.querySelector('.p3-trends-view'); if(!root)return result;
  root.querySelector('.v66-trend-state')?.remove();
  let title='Early dataset',copy='More logged days are needed before this chart should be treated as a stable pattern.',level='building';
  if(p3TrendMetric==='weight'){
    const w=v66WeightConfidence(Number.isFinite(trendRange)?trendRange:180); level=w.level; title=`${w.label} weight evidence`; copy=w.trend?.weekly==null?`${w.trend?.weights?.length||0} weigh-ins so far. Pace remains a building baseline.`:`Observed pace ${v52Sign(w.trend.weekly,2,' kg/week')} across ${Math.round(w.trend.span||0)} days.`;
  }else{
    const n=v66ConfidenceForRange(Number.isFinite(trendRange)?trendRange:180); level=n.level; title=`${n.label} nutrition evidence`; copy=`${n.loggedDays} logged days · ${n.meals} meals${n.exactRate==null?'':` · ${n.exactRate}% exact/reused`}.`;
  }
  const head=root.querySelector('.p3-page-head'); if(head)head.insertAdjacentHTML('afterend',`<div class="v66-trend-state ${esc(level)}"><div><strong>${esc(title)}</strong><span>${esc(copy)}</span></div>${v66ConfidencePill(level==='building'?'Building':level[0].toUpperCase()+level.slice(1),level)}</div>`);
  root.querySelectorAll('[data-trend-metric]').forEach(button=>button.addEventListener('click',()=>localStorage.setItem('diet-v66-trend-metric',button.dataset.trendMetric)));
  root.querySelectorAll('[data-trend-range]').forEach(button=>button.addEventListener('click',()=>localStorage.setItem('diet-v66-trend-range',button.dataset.trendRange)));
  return result;
};

const v66RenderTodayBase=renderToday;
renderToday=function renderTodayV66(){
  const result=v66RenderTodayBase();
  const root=app.querySelector('.today-v2');
  root?.querySelector('.v6-capture-card')?.remove();
  root?.querySelector('.v6-activity')?.remove();
  root?.querySelector('.v51-closeout-hint')?.remove();
  document.getElementById('v6CaptureDialog')?.remove();
  return result;
};

refreshData=async function refreshDataV66({silent=false}={}){
  if(v66RefreshPromise)return v66RefreshPromise;
  if(!cloud.client||!cloud.user){if(!silent&&typeof openConnection==='function')openConnection();return;}
  if(navigator.onLine===false){if(!silent)showToast('Offline — showing the last cached snapshot');return;}
  v66RefreshPromise=(async()=>{
    cloud.status='syncing'; updateStatus();
    try{
      const [p,d,m,mi,w,sf,sm,smi,gp,tr,wr,act,port]=await Promise.all([
        cloud.client.from('profiles').select('calorie_target,protein_target,fiber_target,goal_weight,desired_weekly_weight_change,adaptive_target_enabled,adaptive_min_complete_days,show_optional_macros,show_meal_photos,weigh_in_reminder_enabled,weigh_in_reminder_time,day_close_reminder_enabled,day_close_reminder_time,weekly_review_reminder_enabled,weekly_review_day,weekly_review_time,reminder_timezone,updated_at').maybeSingle(),
        cloud.client.from('daily_logs').select('id,log_date,calorie_target,protein_target,status,notes,updated_at').order('log_date'),
        cloud.client.from('meals').select('id,daily_log_id,meal_type,title,calories,protein,carbs,fat,fiber,confidence,source,original_input,notes,calories_low,calories_high,photo_url,photo_alt,eaten_at,created_at,updated_at').order('eaten_at'),
        cloud.client.from('meal_items').select('id,meal_id,saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber,calories_low,calories_high,confidence,source,sort_order,updated_at').order('sort_order'),
        cloud.client.from('weight_entries').select('id,entry_date,weight,notes,created_at,updated_at').order('entry_date'),
        cloud.client.from('saved_foods').select('id,name,brand,barcode,quantity_text,calories,protein,carbs,fat,fiber,aliases,source,confidence,favorite,use_count,last_used_at,photo_url,verified_at,updated_at').order('use_count',{ascending:false}).limit(100),
        cloud.client.from('saved_meals').select('id,name,meal_type,calories,protein,carbs,fat,fiber,aliases,favorite,use_count,last_used_at,photo_url,is_recipe,servings,serving_text,recipe_notes,updated_at').order('use_count',{ascending:false}).limit(100),
        cloud.client.from('saved_meal_items').select('id,saved_meal_id,saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber,confidence,source,sort_order').order('sort_order'),
        cloud.client.from('goal_phases').select('id,phase_type,name,start_date,end_date,calorie_target,protein_target,fiber_target,goal_weight,desired_weekly_weight_change,active,notes,created_at,updated_at').order('start_date',{ascending:false}),
        cloud.client.from('target_recommendations').select('id,generated_on,lookback_days,complete_days,logged_days,weigh_in_count,avg_calories,weekly_weight_change,estimated_maintenance,desired_weekly_weight_change,current_target,raw_recommended_target,recommended_target,rationale,status,decision_payload,created_at,resolved_at').order('created_at',{ascending:false}).limit(20),
        cloud.client.from('weekly_reviews').select('id,week_end,payload,created_at').order('week_end',{ascending:false}).limit(20),
        cloud.client.from('activity_daily').select('activity_date,steps,active_calories,exercise_minutes,distance_km,resting_heart_rate,source,synced_at,updated_at').order('activity_date'),
        cloud.client.from('saved_food_portions').select('id,saved_food_id,multiplier,quantity_text,use_count,last_used_at,updated_at').order('use_count',{ascending:false})
      ]);
      for(const r of [p,d,m,mi,w,sf,sm,smi,gp,tr,wr,act,port])if(r.error)throw r.error;
      const dailyLogs={},dateById={},itemsByMeal={},savedItemsByMeal={};
      (d.data||[]).forEach(x=>{dailyLogs[x.log_date]={id:x.id,status:x.status,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),notes:x.notes||'',updatedAt:x.updated_at};dateById[x.id]=x.log_date;});
      (mi.data||[]).forEach(x=>{(itemsByMeal[x.meal_id]||=[]).push({id:x.id,savedFoodId:x.saved_food_id,name:x.name,quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),caloriesLow:x.calories_low==null?null:Number(x.calories_low),caloriesHigh:x.calories_high==null?null:Number(x.calories_high),confidence:x.confidence,source:x.source,updatedAt:x.updated_at});});
      (smi.data||[]).forEach(x=>{(savedItemsByMeal[x.saved_meal_id]||=[]).push({id:x.id,savedFoodId:x.saved_food_id,name:x.name,quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),confidence:x.confidence,source:x.source,sortOrder:Number(x.sort_order||0)});});
      const recommendations=(tr.data||[]).map(x=>({id:x.id,generatedOn:x.generated_on,lookbackDays:Number(x.lookback_days),completeDays:Number(x.complete_days),loggedDays:Number(x.logged_days||0),weighInCount:Number(x.weigh_in_count),avgCalories:x.avg_calories==null?null:Number(x.avg_calories),weeklyWeightChange:x.weekly_weight_change==null?null:Number(x.weekly_weight_change),estimatedMaintenance:x.estimated_maintenance==null?null:Number(x.estimated_maintenance),desiredWeeklyWeightChange:x.desired_weekly_weight_change==null?null:Number(x.desired_weekly_weight_change),currentTarget:Number(x.current_target),rawRecommendedTarget:x.raw_recommended_target==null?null:Number(x.raw_recommended_target),recommendedTarget:x.recommended_target==null?null:Number(x.recommended_target),rationale:x.rationale||'',decisionPayload:x.decision_payload||null,status:x.status,createdAt:x.created_at,resolvedAt:x.resolved_at}));
      dashboard={
        profile:{calorieTarget:Number(p.data?.calorie_target??2300),proteinTarget:Number(p.data?.protein_target??160),fiberTarget:Number(p.data?.fiber_target??30),goalWeight:p.data?.goal_weight==null?null:Number(p.data.goal_weight),desiredWeeklyWeightChange:p.data?.desired_weekly_weight_change==null?null:Number(p.data.desired_weekly_weight_change),adaptiveTargetEnabled:p.data?.adaptive_target_enabled!==false,adaptiveMinCompleteDays:Number(p.data?.adaptive_min_complete_days??14),showOptionalMacros:Boolean(p.data?.show_optional_macros),showMealPhotos:p.data?.show_meal_photos!==false,weighInReminderEnabled:Boolean(p.data?.weigh_in_reminder_enabled),weighInReminderTime:p.data?.weigh_in_reminder_time||null,dayCloseReminderEnabled:Boolean(p.data?.day_close_reminder_enabled),dayCloseReminderTime:p.data?.day_close_reminder_time||null,weeklyReviewReminderEnabled:Boolean(p.data?.weekly_review_reminder_enabled),weeklyReviewDay:p.data?.weekly_review_day,weeklyReviewTime:p.data?.weekly_review_time||null,reminderTimezone:p.data?.reminder_timezone||null},
        dailyLogs,
        meals:(m.data||[]).map(x=>({id:x.id,date:dateById[x.daily_log_id]||String(x.eaten_at||'').slice(0,10),type:x.meal_type||'Other',title:x.title||'Meal',calories:Number(x.calories||0),protein:Number(x.protein||0),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),confidence:x.confidence||'medium',source:x.source||'text_estimate',originalInput:x.original_input||'',notes:x.notes||'',caloriesLow:x.calories_low==null?null:Number(x.calories_low),caloriesHigh:x.calories_high==null?null:Number(x.calories_high),photoUrl:x.photo_url||null,photoAlt:x.photo_alt||'',eatenAt:x.eaten_at,updatedAt:x.updated_at,items:itemsByMeal[x.id]||[]})),
        weights:(w.data||[]).map(x=>({id:x.id,date:x.entry_date,weight:Number(x.weight),notes:x.notes||'',updatedAt:x.updated_at||x.created_at})),
        savedFoods:(sf.data||[]).map(x=>({id:x.id,name:x.name,brand:x.brand||'',barcode:x.barcode||'',quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],source:x.source,confidence:x.confidence,favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,verifiedAt:x.verified_at,updatedAt:x.updated_at})),
        savedMeals:(sm.data||[]).map(x=>({id:x.id,name:x.name,mealType:x.meal_type,calories:x.calories==null?null:Number(x.calories),protein:x.protein==null?null:Number(x.protein),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,isRecipe:Boolean(x.is_recipe),servings:x.servings==null?null:Number(x.servings),servingText:x.serving_text||'',recipeNotes:x.recipe_notes||'',items:savedItemsByMeal[x.id]||[],updatedAt:x.updated_at})),
        recipeItems:savedItemsByMeal,
        goalPhases:(gp.data||[]).map(x=>({id:x.id,phaseType:x.phase_type,name:x.name,startDate:x.start_date,endDate:x.end_date,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),fiberTarget:Number(x.fiber_target),goalWeight:x.goal_weight==null?null:Number(x.goal_weight),desiredWeeklyWeightChange:x.desired_weekly_weight_change==null?null:Number(x.desired_weekly_weight_change),active:Boolean(x.active),notes:x.notes||'',createdAt:x.created_at,updatedAt:x.updated_at})),
        recommendations,
        v65Plan:recommendations[0]?{decisionPayload:recommendations[0].decisionPayload}:null,
        weeklyReviews:(wr.data||[]).map(x=>({id:x.id,weekEnd:x.week_end,payload:x.payload||{},createdAt:x.created_at})),
        activityDays:(act.data||[]).map(x=>({date:x.activity_date,steps:x.steps==null?null:Number(x.steps),activeCalories:x.active_calories==null?null:Number(x.active_calories),exerciseMinutes:x.exercise_minutes==null?null:Number(x.exercise_minutes),distanceKm:x.distance_km==null?null:Number(x.distance_km),restingHeartRate:x.resting_heart_rate==null?null:Number(x.resting_heart_rate),source:x.source,syncedAt:x.synced_at,updatedAt:x.updated_at})),
        foodPortions:(port.data||[]).map(x=>({id:x.id,savedFoodId:x.saved_food_id,multiplier:Number(x.multiplier||1),quantity:x.quantity_text||'',useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,updatedAt:x.updated_at})),
        fetchedAt:new Date().toISOString(),source:'cloud'
      };
      if(typeof v5EnsureDashboardShape==='function')v5EnsureDashboardShape();
      if(typeof v6EnsureShape==='function')v6EnsureShape();
      saveDashboardCache(); cloud.status='online'; cloud.error=null;
      try{const {data:health,error}=await cloud.client.rpc('diet_copilot_healthcheck');if(!error&&health){cloud.bridgeReady=Boolean(health.capabilities?.log_meal_from_ai&&health.capabilities?.log_weight_from_ai);cloud.schemaVersion=health.schema_version;}}catch{}
      render(); if(!silent)showToast('Dashboard refreshed');
    }catch(error){cloud.status='error';cloud.error=error.message||String(error);updateStatus();if(!silent)showToast(`Refresh failed: ${typeof p5FriendlyError==='function'?p5FriendlyError(cloud.error):cloud.error}`);if(connectionDialog?.open&&typeof renderConnection==='function')renderConnection();}
    finally{v66RefreshPromise=null;}
  })();
  return v66RefreshPromise;
};

subscribeRealtime=async function subscribeRealtimeV66(){
  if(!cloud.client||!cloud.user)return;
  clearTimeout(v66RealtimeTimer);
  if(cloud.v6ActivityChannel){try{await cloud.client.removeChannel(cloud.v6ActivityChannel)}catch{} cloud.v6ActivityChannel=null;}
  if(cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{} cloud.channel=null;}
  let channel=cloud.client.channel(`diet-dashboard-v66-${cloud.user.id}`);
  for(const table of ['profiles','daily_logs','meals','meal_items','weight_entries','saved_foods','saved_meals','saved_meal_items','saved_food_portions','goal_phases','target_recommendations','weekly_reviews','activity_daily']){
    channel=channel.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(v66RealtimeTimer);v66RealtimeTimer=setTimeout(()=>refreshData({silent:true}),300);});
  }
  cloud.channel=channel.subscribe();
};

if(typeof disposeCloud==='function'){
  const v66DisposeBase=disposeCloud;
  disposeCloud=async function disposeCloudV66(){clearTimeout(v66RealtimeTimer);return v66DisposeBase();};
}

queueMicrotask(()=>{
  document.getElementById('v6CaptureDialog')?.remove();
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  app.querySelector('.today-v2 .v6-activity')?.remove();
  if(cloud?.user){subscribeRealtime().catch(error=>console.warn('V6.6 realtime consolidation failed',error));}
  if(typeof render==='function')render();
});
