'use strict';

let v52StatsRange = 28;

function v52DaysBack(days) {
  const end = localDateKey();
  const start = offsetDateKey(-(days-1));
  const logged = Object.keys(dashboard.dailyLogs || {}).filter(d => d >= start && d <= end).sort();
  const complete = logged.filter(d => dayLog(d).status === 'complete');
  return { start, end, logged, complete };
}

function v52TrendWeight() {
  const weights = [...(dashboard.weights || [])].sort((a,b)=>a.date.localeCompare(b.date));
  const recent = weights.slice(-7);
  return recent.length ? average(recent.map(w=>Number(w.weight))) : null;
}

function v52PhaseBaselineWeight() {
  const phase = v5CurrentPhase?.();
  const weights = [...(dashboard.weights || [])].sort((a,b)=>a.date.localeCompare(b.date));
  if (!phase || !weights.length) return weights[0]?.weight ?? null;
  const target = new Date(`${phase.startDate}T12:00:00`).getTime();
  return [...weights].sort((a,b)=>Math.abs(new Date(`${a.date}T12:00:00`).getTime()-target)-Math.abs(new Date(`${b.date}T12:00:00`).getTime()-target))[0]?.weight ?? null;
}

function v52Metrics(days=v52StatsRange) {
  v5EnsureDashboardShape();
  const {start,end,logged,complete} = v52DaysBack(days);
  const profile = dashboard.profile || {};
  const calorieValues = complete.map(d=>totalsFor(d).calories);
  const calorieTargets = complete.map(d=>targetsFor(d).calories);
  const proteinValues = complete.map(d=>totalsFor(d).protein);
  const calorieHits = complete.filter(d=>Math.abs(totalsFor(d).calories-targetsFor(d).calories)<=150).length;
  const proteinHits = complete.filter(d=>totalsFor(d).protein>=targetsFor(d).protein).length;
  const calorieAbsDelta = complete.map(d=>Math.abs(totalsFor(d).calories-targetsFor(d).calories));

  const fiberDays = complete.map(d=>({date:d, ...v5MacroForDate(d,'fiber')})).filter(x=>x.complete);
  const fiberHits = fiberDays.filter(x=>x.value>=Number(profile.fiberTarget||30)).length;

  const rangeMeals = (dashboard.meals||[]).filter(m=>m.date>=start&&m.date<=end);
  const exactMeals = rangeMeals.filter(m=>sourceQuality(m)==='exact').length;
  const estimatedMeals = rangeMeals.length-exactMeals;

  const weights = (dashboard.weights||[]).filter(w=>w.date>=start&&w.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
  const weightSpan = weights.length>1 ? Math.round((new Date(`${weights.at(-1).date}T12:00:00`)-new Date(`${weights[0].date}T12:00:00`))/86400000) : 0;
  const pace = weights.length>=4&&weightSpan>=7 ? weeklyWeightPace(days) : null;
  const desired = profile.desiredWeeklyWeightChange==null?null:Number(profile.desiredWeeklyWeightChange);
  const trendWeight = v52TrendWeight();
  const weightChange = weights.length>1 ? Number(weights.at(-1).weight)-Number(weights[0].weight) : null;

  const startWeight = v52PhaseBaselineWeight();
  const goal = profile.goalWeight==null?null:Number(profile.goalWeight);
  let goalProgress = null, remaining = null;
  if (goal!=null&&trendWeight!=null) remaining=Math.abs(trendWeight-goal);
  if (goal!=null&&trendWeight!=null&&startWeight!=null&&Math.abs(startWeight-goal)>.05) {
    goalProgress=Math.max(0,Math.min(100,(Math.abs(startWeight-goal)-Math.abs(trendWeight-goal))/Math.abs(startWeight-goal)*100));
  }

  let etaWeeks = null, etaSource = null;
  if (goal!=null&&trendWeight!=null&&pace!=null&&Math.abs(pace)>=.05&&(goal-trendWeight)*pace>0) {
    etaWeeks=Math.ceil(Math.abs(goal-trendWeight)/Math.abs(pace)); etaSource='observed';
  } else if (goal!=null&&trendWeight!=null&&desired!=null&&Math.abs(desired)>=.05&&(goal-trendWeight)*desired>0) {
    etaWeeks=Math.ceil(Math.abs(goal-trendWeight)/Math.abs(desired)); etaSource='planned';
  }

  const avgCalories=complete.length?average(calorieValues):null;
  const avgCalTarget=complete.length?average(calorieTargets):null;
  const avgProtein=complete.length?average(proteinValues):null;
  const avgFiber=fiberDays.length?average(fiberDays.map(x=>x.value)):null;
  const calorieHitRate=complete.length?Math.round(calorieHits/complete.length*100):null;
  const proteinHitRate=complete.length?Math.round(proteinHits/complete.length*100):null;
  const fiberHitRate=fiberDays.length?Math.round(fiberHits/fiberDays.length*100):null;
  const completionRate=logged.length?Math.round(complete.length/logged.length*100):null;
  const exactRate=rangeMeals.length?Math.round(exactMeals/rangeMeals.length*100):null;

  let adherenceScore=null;
  if (complete.length) {
    let weighted=(calorieHits/complete.length)*45+(proteinHits/complete.length)*35, denom=80;
    if(fiberDays.length){weighted+=(fiberHits/fiberDays.length)*20;denom=100;}
    adherenceScore=Math.round(weighted/denom*100);
  }

  const maintenanceEstimate=(complete.length>=14&&pace!=null&&avgCalories!=null)?Math.round((avgCalories-(pace*7700/7))/25)*25:null;

  let headline='Building baseline', tone='baseline', headlineCopy='Complete days and regular weigh-ins will make the statistics more useful.';
  if(complete.length>=7){
    if(adherenceScore>=80&&(pace==null||desired==null||Math.abs(pace-desired)<=.15)){headline='On track';tone='good';headlineCopy='Your recent adherence and available trend data are broadly aligned with the plan.';}
    else if(adherenceScore<60){headline='Adherence needs attention';tone='warn';headlineCopy='The biggest opportunity is consistency with calories, protein and complete-day logging.';}
    else {headline='Mixed but usable';tone='baseline';headlineCopy='There is enough data to see patterns, but one or more targets are inconsistent.';}
  }

  return {
    days,start,end,loggedDays:logged.length,completeDays:complete.length,completionRate,
    avgCalories,avgCalTarget,avgAbsCalorieDelta:complete.length?average(calorieAbsDelta):null,calorieHits,calorieHitRate,
    avgProtein,proteinTarget:Number(profile.proteinTarget||0),proteinHits,proteinHitRate,
    avgFiber,fiberTarget:Number(profile.fiberTarget||30),fiberCoveredDays:fiberDays.length,fiberHits,fiberHitRate,
    meals:rangeMeals.length,exactMeals,estimatedMeals,exactRate,
    weighIns:weights.length,trendWeight,weightChange,pace,desired,
    startWeight,goal,goalProgress,remaining,etaWeeks,etaSource,maintenanceEstimate,
    adherenceScore,headline,tone,headlineCopy
  };
}

function v52Pct(value){ return value==null?0:Math.max(0,Math.min(100,Number(value))); }
function v52Sign(value,digits=0,suffix=''){ if(value==null)return '—'; return `${value>0?'+':''}${fmt(value,digits)}${suffix}`; }

function v52MetricCard(cls,label,value,copy,pct=null,foot='') {
  return `<article class="v52-stat-card ${cls}"><div class="v52-stat-label">${esc(label)}</div><strong>${esc(value)}</strong><p>${esc(copy)}</p>${pct==null?'':`<div class="v52-stat-track" aria-hidden="true"><span style="width:${v52Pct(pct)}%"></span></div>`}${foot?`<small>${esc(foot)}</small>`:''}</article>`;
}

function v52StatsMarkup(m){
  const caloriesValue=m.avgCalories==null?'—':`${fmt(m.avgCalories)} kcal`;
  const caloriesCopy=m.avgCalories==null?'Complete days are required for a reliable calorie average.':`${m.calorieHitRate}% of complete days were within ±150 kcal of target.`;
  const caloriesFoot=m.avgAbsCalorieDelta==null?'':`Typical miss: ${fmt(m.avgAbsCalorieDelta)} kcal · target avg ${fmt(m.avgCalTarget)} kcal`;

  const proteinValue=m.avgProtein==null?'—':`${fmt(m.avgProtein,1)} g`;
  const proteinCopy=m.avgProtein==null?'Protein statistics use Complete days only.':`${m.proteinHitRate}% of complete days reached at least ${fmt(m.proteinTarget)} g.`;

  const fiberValue=m.avgFiber==null?'—':`${fmt(m.avgFiber,1)} g`;
  const fiberCopy=m.avgFiber==null?'Fiber is only scored when every meal on that day has fiber data.':`${m.fiberHitRate}% of ${m.fiberCoveredDays} fully-covered day${m.fiberCoveredDays===1?'':'s'} reached ${fmt(m.fiberTarget)} g.`;

  const weightValue=m.trendWeight==null?'—':`${fmt(m.trendWeight,1)} kg`;
  let weightCopy='Add regular weigh-ins to establish a weight trend.';
  if(m.pace!=null) weightCopy=`${v52Sign(m.pace,2,' kg/week')} observed vs ${m.desired==null?'no pace target':v52Sign(m.desired,2,' kg/week planned')}.`;
  else if(m.weighIns) weightCopy=`${m.weighIns} weigh-in${m.weighIns===1?'':'s'} in this range · more are needed for pace.`;
  const weightFoot=m.weightChange==null?'':`Raw range change ${v52Sign(m.weightChange,1,' kg')}`;

  const goalValue=m.goalProgress==null?'—':`${fmt(m.goalProgress)}%`;
  let goalCopy=m.goal==null?'Set a goal weight to track progress.':`${m.remaining==null?'—':`${fmt(m.remaining,1)} kg`} remaining to ${fmt(m.goal,1)} kg.`;
  if(m.etaWeeks!=null) goalCopy+=` ETA ~${m.etaWeeks} weeks (${m.etaSource} pace).`;
  const goalFoot=(m.startWeight!=null&&m.goal!=null)?`Phase baseline ${fmt(m.startWeight,1)} kg → goal ${fmt(m.goal,1)} kg`:'';

  const loggingValue=m.loggedDays?`${m.completeDays}/${m.loggedDays}`:'—';
  const loggingCopy=m.loggedDays?`${m.completionRate}% of logged days are finalized. Only finalized days feed adherence averages.`:'No logged days in this range.';
  const loggingFoot=m.meals?`${m.meals} meals · ${m.exactRate}% exact/reused · ${m.estimatedMeals} estimated`:'';

  const adherenceValue=m.adherenceScore==null?'—':`${m.adherenceScore}%`;
  const adherenceCopy=m.adherenceScore==null?'A combined score appears once Complete days exist.':'45% calories · 35% protein · 20% fiber when fiber coverage is available.';
  const maintenance=m.maintenanceEstimate==null?'':`Rough maintenance estimate: ~${fmt(m.maintenanceEstimate)} kcal/day`;

  return `<section class="v52-stats"><div class="v52-stats-head"><div><h3>Key stats</h3><p>Useful numbers only. Averages use Complete days so missing meals cannot look like successful dieting.</p></div><div class="v52-range" role="group" aria-label="Stats range">${[7,28,90].map(d=>`<button type="button" class="${v52StatsRange===d?'active':''}" data-v52-range="${d}">${d}D</button>`).join('')}</div></div>
    <div class="v52-overview ${m.tone}"><div><span>${m.days}-day status</span><strong>${esc(m.headline)}</strong><p>${esc(m.headlineCopy)}</p></div><div class="v52-score"><span>Adherence</span><strong>${m.adherenceScore==null?'—':`${m.adherenceScore}%`}</strong></div></div>
    <div class="v52-stats-grid">
      ${v52MetricCard('calories','Calories',caloriesValue,caloriesCopy,m.calorieHitRate,caloriesFoot)}
      ${v52MetricCard('protein','Protein',proteinValue,proteinCopy,m.proteinHitRate)}
      ${v52MetricCard('fiber','Fiber',fiberValue,fiberCopy,m.fiberHitRate)}
      ${v52MetricCard('weight','Trend weight',weightValue,weightCopy,null,weightFoot)}
      ${v52MetricCard('goal','Goal progress',goalValue,goalCopy,m.goalProgress,goalFoot)}
      ${v52MetricCard('logging','Data quality',loggingValue,loggingCopy,m.completionRate,loggingFoot)}
      ${v52MetricCard('adherence','Plan adherence',adherenceValue,adherenceCopy,m.adherenceScore,maintenance)}
    </div>
  </section>`;
}

const v52RenderInsightsBase = renderInsights;
renderInsights = function renderInsightsV52(){
  const result=v52RenderInsightsBase();
  const root=app.querySelector('.p3-insights-view');
  if(!root)return result;
  root.querySelector('.v52-stats')?.remove();
  const header=root.querySelector('.p3-page-head');
  header?.insertAdjacentHTML('afterend',v52StatsMarkup(v52Metrics()));

  const legacy=root.querySelector('.p3-insights-grid');
  if(legacy&&!legacy.closest('.v52-more-details')){
    const wrap=document.createElement('details');
    wrap.className='v52-more-details';
    wrap.innerHTML='<summary><span>Additional diagnostic details</span><small>Estimate quality, logging notes and supporting metrics</small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary>';
    legacy.before(wrap); wrap.appendChild(legacy);
  }

  root.querySelectorAll('[data-v52-range]').forEach(button=>button.addEventListener('click',()=>{v52StatsRange=Number(button.dataset.v52Range);renderInsights();}));
  return result;
};

const v52RenderTodayBase = renderToday;
renderToday = function renderTodayV52(){
  const result=v52RenderTodayBase();
  const root=app.querySelector('.today-v2');
  if(!root)return result;
  const m=v52Metrics(28);
  const goalStrip=root.querySelector('.v5-goal-strip');
  if(goalStrip&&m.goal!=null&&m.trendWeight!=null&&!root.querySelector('.v52-goal-progress')){
    const pct=m.goalProgress==null?0:m.goalProgress;
    goalStrip.insertAdjacentHTML('afterend',`<div class="v52-goal-progress"><div><span>Progress to ${fmt(m.goal,1)} kg</span><strong>${m.goalProgress==null?'Building baseline':`${fmt(m.goalProgress)}% · ${fmt(m.remaining,1)} kg remaining`}</strong></div><div class="v52-goal-track" aria-hidden="true"><span style="width:${v52Pct(pct)}%"></span></div></div>`);
  }
  return result;
};
