// Final Diet Copilot policy layer.
// Logged nutrition always counts. Day status is coverage metadata only and must
// never exclude calories, protein, fiber, weight or trend data.
function dietV54LoggedDates(days) {
  return datesInRange(days).filter(date => mealsFor(date).length > 0).sort();
}

if (typeof v52DaysBack === 'function') {
  v52DaysBack = function dietV54DaysBack(days) {
    const end = localDateKey();
    const start = offsetDateKey(-(days-1));
    const logged = allDates().filter(d => d >= start && d <= end && mealsFor(d).length > 0).sort();
    const complete = logged.filter(d => dayLog(d).status === 'complete');
    return { start, end, logged, complete };
  };
}

if (typeof v52Metrics === 'function') {
  v52Metrics = function dietV54Metrics(days=v52StatsRange) {
    v5EnsureDashboardShape();
    const {start,end,logged,complete} = v52DaysBack(days);
    const profile = dashboard.profile || {};
    const calorieValues = logged.map(d=>totalsFor(d).calories);
    const calorieTargets = logged.map(d=>targetsFor(d).calories);
    const proteinValues = logged.map(d=>totalsFor(d).protein);
    const calorieHits = logged.filter(d=>Math.abs(totalsFor(d).calories-targetsFor(d).calories)<=150).length;
    const proteinHits = logged.filter(d=>totalsFor(d).protein>=targetsFor(d).protein).length;
    const calorieAbsDelta = logged.map(d=>Math.abs(totalsFor(d).calories-targetsFor(d).calories));

    const fiberRows = logged.map(d=>({date:d, ...v5MacroForDate(d,'fiber')}));
    const fiberDays = fiberRows.filter(x=>x.hasAny);
    const fiberFullDays = fiberRows.filter(x=>x.complete).length;
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

    const avgCalories=logged.length?average(calorieValues):null;
    const avgCalTarget=logged.length?average(calorieTargets):null;
    const avgProtein=logged.length?average(proteinValues):null;
    const avgFiber=fiberDays.length?average(fiberDays.map(x=>x.value)):null;
    const calorieHitRate=logged.length?Math.round(calorieHits/logged.length*100):null;
    const proteinHitRate=logged.length?Math.round(proteinHits/logged.length*100):null;
    const fiberHitRate=fiberDays.length?Math.round(fiberHits/fiberDays.length*100):null;
    const completionRate=logged.length?Math.round(complete.length/logged.length*100):null;
    const exactRate=rangeMeals.length?Math.round(exactMeals/rangeMeals.length*100):null;

    let adherenceScore=null;
    if (logged.length) {
      let weighted=(calorieHits/logged.length)*45+(proteinHits/logged.length)*35, denom=80;
      if(fiberDays.length){weighted+=(fiberHits/fiberDays.length)*20;denom=100;}
      adherenceScore=Math.round(weighted/denom*100);
    }

    const maintenanceEstimate=(logged.length>=14&&pace!=null&&avgCalories!=null)?Math.round((avgCalories-(pace*7700/7))/25)*25:null;

    let headline='Building baseline', tone='baseline', headlineCopy='Keep logging intake and weigh-ins; all available data already contributes to the statistics.';
    if(logged.length>=7){
      if(adherenceScore>=80&&(pace==null||desired==null||Math.abs(pace-desired)<=.15)){headline='On track';tone='good';headlineCopy='Recent logged intake and available trend data are broadly aligned with the plan.';}
      else if(adherenceScore<60){headline='Adherence needs attention';tone='warn';headlineCopy='The biggest opportunity is consistency with calories, protein and fiber.';}
      else {headline='Mixed but usable';tone='baseline';headlineCopy='There is enough logged data to see patterns, but one or more targets are inconsistent.';}
    }

    return {
      days,start,end,loggedDays:logged.length,completeDays:complete.length,statusCompleteDays:complete.length,completionRate,
      avgCalories,avgCalTarget,avgAbsCalorieDelta:logged.length?average(calorieAbsDelta):null,calorieHits,calorieHitRate,
      avgProtein,proteinTarget:Number(profile.proteinTarget||0),proteinHits,proteinHitRate,
      avgFiber,fiberTarget:Number(profile.fiberTarget||30),fiberCoveredDays:fiberDays.length,fiberFullDays,fiberHits,fiberHitRate,
      meals:rangeMeals.length,exactMeals,estimatedMeals,exactRate,
      weighIns:weights.length,trendWeight,weightChange,pace,desired,
      startWeight,goal,goalProgress,remaining,etaWeeks,etaSource,maintenanceEstimate,
      adherenceScore,headline,tone,headlineCopy
    };
  };
}

if (typeof v52StatsMarkup === 'function') {
  v52StatsMarkup = function dietV54StatsMarkup(m) {
    const caloriesValue=m.avgCalories==null?'—':`${fmt(m.avgCalories)} kcal`;
    const caloriesCopy=m.avgCalories==null?'Log intake to build a calorie average.':`${m.calorieHitRate}% of logged days were within ±150 kcal of target.`;
    const caloriesFoot=m.avgAbsCalorieDelta==null?'':`Typical miss: ${fmt(m.avgAbsCalorieDelta)} kcal · target avg ${fmt(m.avgCalTarget)} kcal`;
    const proteinValue=m.avgProtein==null?'—':`${fmt(m.avgProtein,1)} g`;
    const proteinCopy=m.avgProtein==null?'Log intake to build a protein average.':`${m.proteinHitRate}% of logged days reached at least ${fmt(m.proteinTarget)} g.`;
    const fiberValue=m.avgFiber==null?'—':`${fmt(m.avgFiber,1)} g`;
    const fiberCopy=m.avgFiber==null?'Fiber remains unknown where meals have no fiber value.':`${m.fiberHitRate}% of ${m.fiberCoveredDays} day${m.fiberCoveredDays===1?'':'s'} with known fiber reached ${fmt(m.fiberTarget)} g.`;
    const fiberFoot=m.fiberCoveredDays?`${m.fiberFullDays} day${m.fiberFullDays===1?'':'s'} had full fiber coverage`:'';
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
    const loggingCopy=m.loggedDays?`${m.completionRate}% status-complete. This is coverage metadata only; every logged day is included in nutrition statistics.`:'No logged intake days in this range.';
    const loggingFoot=m.meals?`${m.meals} meals · ${m.exactRate}% exact/reused · ${m.estimatedMeals} estimated`:'';
    const adherenceValue=m.adherenceScore==null?'—':`${m.adherenceScore}%`;
    const adherenceCopy=m.adherenceScore==null?'A combined score appears once intake is logged.':'45% calories · 35% protein · 20% known fiber. Day status does not exclude data.';
    const maintenance=m.maintenanceEstimate==null?'':`Rough maintenance estimate: ~${fmt(m.maintenanceEstimate)} kcal/day`;

    return `<section class="v52-stats"><div class="v52-stats-head"><div><h3>Key stats</h3><p>All logged intake counts. Data coverage is shown separately instead of excluding open or partial days.</p></div><div class="v52-range" role="group" aria-label="Stats range">${[7,28,90].map(d=>`<button type="button" class="${v52StatsRange===d?'active':''}" data-v52-range="${d}">${d}D</button>`).join('')}</div></div>
      <div class="v52-overview ${m.tone}"><div><span>${m.days}-day status</span><strong>${esc(m.headline)}</strong><p>${esc(m.headlineCopy)}</p></div><div class="v52-score"><span>Adherence</span><strong>${m.adherenceScore==null?'—':`${m.adherenceScore}%`}</strong></div></div>
      <div class="v52-stats-grid">
        ${v52MetricCard('calories','Calories',caloriesValue,caloriesCopy,m.calorieHitRate,caloriesFoot)}
        ${v52MetricCard('protein','Protein',proteinValue,proteinCopy,m.proteinHitRate)}
        ${v52MetricCard('fiber','Fiber',fiberValue,fiberCopy,m.fiberHitRate,fiberFoot)}
        ${v52MetricCard('weight','Trend weight',weightValue,weightCopy,null,weightFoot)}
        ${v52MetricCard('goal','Goal progress',goalValue,goalCopy,m.goalProgress,goalFoot)}
        ${v52MetricCard('logging','Status coverage',loggingValue,loggingCopy,m.completionRate,loggingFoot)}
        ${v52MetricCard('adherence','Plan adherence',adherenceValue,adherenceCopy,m.adherenceScore,maintenance)}
      </div>
    </section>`;
  };
}

if (typeof v51CoachAnalysis === 'function') {
  v51CoachAnalysis = function dietV54CoachAnalysis() {
    v5EnsureDashboardShape();
    const profile = dashboard.profile || {};
    const logged = dietV54LoggedDates(28);
    const complete = logged.filter(d=>dayLog(d).status==='complete');
    const calorieHits = logged.filter(d => Math.abs(totalsFor(d).calories - targetsFor(d).calories) <= 150).length;
    const proteinHits = logged.filter(d => totalsFor(d).protein >= targetsFor(d).protein).length;
    const fiberRows = logged.map(d => ({date:d, fiber:v5MacroForDate(d,'fiber')}));
    const fiberDays = fiberRows.filter(x => x.fiber.hasAny);
    const fiberFullDays = fiberRows.filter(x => x.fiber.complete).length;
    const fiberHits = fiberDays.filter(x => x.fiber.value >= Number(profile.fiberTarget || 30)).length;

    let adherenceScore = null;
    if (logged.length) {
      let weighted = (calorieHits / logged.length) * 45 + (proteinHits / logged.length) * 35;
      let totalWeight = 80;
      if (fiberDays.length) { weighted += (fiberHits / fiberDays.length) * 20; totalWeight = 100; }
      adherenceScore = Math.round(weighted / totalWeight * 100);
    }

    const start = rangeStart(28);
    const weights = dashboard.weights.filter(w => w.date >= start).sort((a,b)=>a.date.localeCompare(b.date));
    const allWeights = [...dashboard.weights].sort((a,b)=>a.date.localeCompare(b.date));
    const lastSeven = allWeights.slice(-7);
    const trendWeight = lastSeven.length ? average(lastSeven.map(w=>w.weight)) : null;
    const weightSpan = weights.length > 1 ? Math.round((new Date(`${weights.at(-1).date}T12:00:00`) - new Date(`${weights[0].date}T12:00:00`))/86400000) : 0;
    const observedPace = weights.length >= 4 && weightSpan >= 7 ? weeklyWeightPace(28) : null;
    const desiredPace = profile.desiredWeeklyWeightChange == null ? null : Number(profile.desiredWeeklyWeightChange);

    let paceStatus = 'building_baseline';
    if (desiredPace == null) paceStatus = 'target_not_set';
    else if (observedPace == null) paceStatus = 'building_baseline';
    else if (Math.abs(desiredPace) < .05) paceStatus = Math.abs(observedPace) <= .15 ? 'on_pace' : observedPace > 0 ? 'gaining' : 'losing';
    else if (desiredPace < 0) {
      if (weightSpan >= 14 && observedPace >= -.10) paceStatus = 'possible_plateau';
      else if (observedPace > desiredPace + .15) paceStatus = 'slower_than_planned';
      else if (observedPace < desiredPace - .15) paceStatus = 'faster_than_planned';
      else paceStatus = 'on_pace';
    } else {
      if (weightSpan >= 14 && observedPace <= .10) paceStatus = 'possible_plateau';
      else if (observedPace < desiredPace - .15) paceStatus = 'slower_than_planned';
      else if (observedPace > desiredPace + .15) paceStatus = 'faster_than_planned';
      else paceStatus = 'on_pace';
    }

    const goal = profile.goalWeight == null ? null : Number(profile.goalWeight);
    let plannedWeeks = null, actualWeeks = null;
    if (goal != null && trendWeight != null && desiredPace != null && Math.abs(desiredPace) >= .05 && (goal-trendWeight)*desiredPace > 0) plannedWeeks = Math.ceil(Math.abs(goal-trendWeight)/Math.abs(desiredPace));
    if (goal != null && trendWeight != null && observedPace != null && Math.abs(observedPace) >= .05 && (goal-trendWeight)*observedPace > 0) actualWeeks = Math.ceil(Math.abs(goal-trendWeight)/Math.abs(observedPace));

    const phase = v5CurrentPhase();
    let maintenanceStatus = 'not_applicable', remaining = null;
    if (goal != null && trendWeight != null && phase?.phaseType === 'cut') { remaining = trendWeight - goal; maintenanceStatus = remaining <= .3 ? 'transition_now' : remaining <= 1.5 ? 'prepare_transition' : 'continue_cut'; }
    else if (goal != null && trendWeight != null && phase?.phaseType === 'gain') { remaining = goal - trendWeight; maintenanceStatus = remaining <= .3 ? 'transition_now' : remaining <= 1.5 ? 'prepare_transition' : 'continue_gain'; }

    return {
      loggedDays:logged.length,completeDays:complete.length,calorieHits,proteinHits,fiberCoveredDays:fiberDays.length,fiberFullDays,fiberHits,adherenceScore,
      weighIns:weights.length,weightSpan,trendWeight,observedPace,desiredPace,paceStatus,
      goal,plannedWeeks,actualWeeks,plannedDate:v51DateFromWeeks(plannedWeeks),actualDate:v51DateFromWeeks(actualWeeks),
      phase,maintenanceStatus,remaining
    };
  };
}

if (typeof v51AdherenceMeta === 'function') {
  v51AdherenceMeta = function dietV54AdherenceMeta(a) {
    if (!a.loggedDays) return ['Not enough data','Log intake to build adherence statistics.','baseline'];
    const pieces=[`${a.calorieHits}/${a.loggedDays} calories`,`${a.proteinHits}/${a.loggedDays} protein`];
    if (a.fiberCoveredDays) pieces.push(`${a.fiberHits}/${a.fiberCoveredDays} known-fiber`);
    const cls=a.adherenceScore>=80?'good':a.adherenceScore>=60?'baseline':'warn';
    return [`${a.adherenceScore}%`,`${pieces.join(' · ')}. Status-complete: ${a.completeDays}/${a.loggedDays}; status does not exclude logged data.` ,cls];
  };
}

if (typeof p4WeekSnapshotMarkup === 'function') {
  p4WeekSnapshotMarkup = function dietV54WeekSnapshotMarkup() {
    const logged=dietV54LoggedDates(7);
    const complete=logged.filter(d=>dayLog(d).status==='complete');
    const avgCalories=logged.length?average(logged.map(d=>totalsFor(d).calories)):null;
    const avgProtein=logged.length?average(logged.map(d=>totalsFor(d).protein)):null;
    const fiberDays=logged.map(d=>v5MacroForDate(d,'fiber')).filter(x=>x.hasAny);
    const avgFiber=fiberDays.length?average(fiberDays.map(x=>x.value)):null;
    const weights=dashboard.weights.filter(w=>w.date>=rangeStart(7)).sort((a,b)=>a.date.localeCompare(b.date));
    const weightChange=weights.length>1?Number(weights.at(-1).weight)-Number(weights[0].weight):null, latest=latestWeight();
    return `<aside class="p4-week-card" aria-label="Seven day snapshot"><div class="p4-week-card-head"><div><strong>7-day snapshot</strong><span>All logged intake counts · status coverage separate</span></div></div><div class="p4-week-grid v5-week-grid">
      <div class="p4-week-stat calories"><span>Avg calories</span><strong>${avgCalories==null?'—':`${fmt(avgCalories)} kcal`}</strong></div>
      <div class="p4-week-stat protein"><span>Avg protein</span><strong>${avgProtein==null?'—':`${fmt(avgProtein,1)} g`}</strong></div>
      <div class="p4-week-stat v5-fiber"><span>Avg known fiber</span><strong>${avgFiber==null?'—':`${fmt(avgFiber,1)} g`}</strong></div>
      <div class="p4-week-stat weight"><span>Weight change</span><strong>${weightChange==null?(latest?`${fmt(latest.weight,1)} kg`:'—'):`${weightChange>0?'+':''}${fmt(weightChange,1)} kg`}</strong></div>
      <div class="p4-week-stat complete"><span>Status complete</span><strong>${complete.length}/${logged.length||0}</strong></div>
    </div><div class="p4-week-note">Open or partial status never removes logged calories, protein, fiber or weigh-ins from statistics.</div></aside>`;
  };
}

if (typeof v5WeeklySummary === 'function') {
  v5WeeklySummary = function dietV54WeeklySummary() {
    const dates=Array.from({length:7},(_,i)=>offsetDateKey(i-6));
    const logged=dates.filter(d=>mealsFor(d).length>0);
    const statusComplete=logged.filter(d=>dayLog(d).status==='complete');
    const avgCalories=logged.length?average(logged.map(d=>totalsFor(d).calories)):null;
    const avgProtein=logged.length?average(logged.map(d=>totalsFor(d).protein)):null;
    const weights=dashboard.weights.filter(w=>w.date>=dates[0]&&w.date<=dates.at(-1)).sort((a,b)=>a.date.localeCompare(b.date));
    const change=weights.length>1?weights.at(-1).weight-weights[0].weight:null;
    return {complete:logged.length,logged:logged.length,statusComplete:statusComplete.length,avgCalories,avgProtein,weightChange:change};
  };
}

if (typeof p3TrendCalories === 'function') {
  p3TrendCalories = function dietV54TrendCalories() {
    const dates=p3TrendDates().filter(d=>mealsFor(d).length>0);
    const avg=dates.length?average(dates.map(d=>totalsFor(d).calories)):null;
    const avgTarget=dates.length?average(dates.map(d=>targetsFor(d).calories)):null;
    const delta=avg==null||avgTarget==null?null:avg-avgTarget;
    return `<div class="p3-trend-summary calories"><div class="p3-trend-primary"><span>Average calories</span><strong>${avg==null?'—':`${fmt(avg)} kcal`}</strong><small>${dates.length?`${dates.length} logged day${dates.length===1?'':'s'}`:'No logged intake in this range'}</small></div><div class="p3-trend-secondary"><div><span>Average target</span><strong>${avgTarget==null?'—':`${fmt(avgTarget)} kcal`}</strong></div><div><span>Vs target</span><strong>${delta==null?'—':`${delta>0?'+':''}${fmt(delta)} kcal`}</strong></div></div></div>${p3BarChart('calories',dates)}`;
  };
}

if (typeof p3TrendProtein === 'function') {
  p3TrendProtein = function dietV54TrendProtein() {
    const dates=p3TrendDates().filter(d=>mealsFor(d).length>0);
    const avg=dates.length?average(dates.map(d=>totalsFor(d).protein)):null;
    const avgTarget=dates.length?average(dates.map(d=>targetsFor(d).protein)):null;
    const hits=dates.filter(d=>totalsFor(d).protein>=targetsFor(d).protein).length;
    const hitRate=dates.length?Math.round(hits/dates.length*100):null;
    return `<div class="p3-trend-summary protein"><div class="p3-trend-primary"><span>Average protein</span><strong>${avg==null?'—':`${fmt(avg,1)} g`}</strong><small>${dates.length?`${hits} of ${dates.length} logged days hit target`:'No logged intake in this range'}</small></div><div class="p3-trend-secondary"><div><span>Average target</span><strong>${avgTarget==null?'—':`${fmt(avgTarget,1)} g`}</strong></div><div><span>Target hit rate</span><strong>${hitRate==null?'—':`${hitRate}%`}</strong></div></div></div>${p3BarChart('protein',dates)}`;
  };
}

if (typeof v5TrendFiber === 'function') {
  v5TrendFiber = function dietV54TrendFiber() {
    const dates=p3TrendDates().filter(d=>mealsFor(d).length>0);
    const known=dates.map(d=>({date:d,f:v5MacroForDate(d,'fiber')})).filter(x=>x.f.hasAny);
    const full=known.filter(x=>x.f.complete).length;
    const target=Number(dashboard.profile.fiberTarget||30);
    const avg=known.length?average(known.map(x=>x.f.value)):null;
    const hits=known.filter(x=>x.f.value>=target).length;
    const hitRate=known.length?Math.round(hits/known.length*100):null;
    return `<div class="p3-trend-summary fiber"><div class="p3-trend-primary"><span>Average known fiber</span><strong>${avg==null?'—':`${fmt(avg,1)} g`}</strong><small>${known.length?`${hits} of ${known.length} days with known fiber hit target · ${full} full-coverage`: 'Known fiber values are needed for averages'}</small></div><div class="p3-trend-secondary"><div><span>Fiber target</span><strong>${fmt(target)} g</strong></div><div><span>Target hit rate</span><strong>${hitRate==null?'—':`${hitRate}%`}</strong></div></div></div>${v5FiberChart(dates)}`;
  };
}

if (typeof v53CaloriesDetail === 'function') {
  const dietV54CaloriesDetailBase=v53CaloriesDetail;
  v53CaloriesDetail=function dietV54CaloriesDetail(d){
    return dietV54CaloriesDetailBase(d)
      .replace('Complete days only, so missing meals do not distort averages','All logged intake is included; day status is coverage metadata only')
      .replaceAll('Complete days','Status-complete days');
  };
}

if (typeof v53ProteinDetail === 'function') {
  const dietV54ProteinDetailBase=v53ProteinDetail;
  v53ProteinDetail=function dietV54ProteinDetail(d){
    let html=dietV54ProteinDetailBase(d)
      .replace('Complete days only','All logged intake')
      .replaceAll('Complete days','Status-complete days');
    const daysHit=d.stats.loggedDays?`${d.stats.proteinHits}/${d.stats.loggedDays}`:'—';
    html=html.replace(/(<span>Days hit<\/span><strong>)[^<]*(<\/strong>)/,`$1${daysHit}$2`);
    return html;
  };
}

if (typeof v53FiberDetail === 'function') {
  const dietV54FiberDetailBase=v53FiberDetail;
  v53FiberDetail=function dietV54FiberDetail(d){
    return dietV54FiberDetailBase(d)
      .replace('Only days with complete fiber coverage are scored','Known fiber values are included; full coverage is reported separately');
  };
}

if (typeof v53ProgressDetail === 'function') {
  const dietV54ProgressDetailBase=v53ProgressDetail;
  v53ProgressDetail=function dietV54ProgressDetail(d){
    return dietV54ProgressDetailBase(d)
      .replace('How often complete days met the plan','How often logged days met the plan')
      .replaceAll('Complete days','Status-complete days');
  };
}

if (typeof renderInsights === 'function') {
  const dietV54RenderInsightsBase=renderInsights;
  renderInsights=function dietV54RenderInsights(){
    const result=dietV54RenderInsightsBase();
    const week=v5WeeklySummary();
    const card=app.querySelector('.v5-intel-card.week');
    if(card){
      const strong=card.querySelector('strong');
      const copy=card.querySelector('p');
      if(strong)strong.textContent=`${week.logged}/7 logged`;
      if(copy)copy.textContent=week.avgCalories==null?'Logged intake will build weekly averages.':`${fmt(week.avgCalories)} kcal · ${fmt(week.avgProtein,1)} g protein${week.weightChange==null?'':` · ${week.weightChange>0?'+':''}${fmt(week.weightChange,1)} kg`} · status complete ${week.statusComplete}/${week.logged}`;
    }
    const calibration=app.querySelector('.v5-intel-card.calibration p');
    if(calibration)calibration.textContent=calibration.textContent.replaceAll('complete days','logged intake days');
    return result;
  };
}

if (typeof renderToday === 'function') {
  const dietV54RenderTodayBase=renderToday;
  renderToday=function dietV54RenderToday(){
    const result=dietV54RenderTodayBase();
    const hint=app.querySelector('.v51-closeout-hint span:last-child');
    if(hint){
      const status=String(dayLog(localDateKey()).status||'open');
      hint.textContent=status==='complete'
        ? 'Day status: complete. Logged nutrition counts regardless of status.'
        : 'Day status is optional coverage metadata. Everything you log already counts toward totals, averages and trends.';
    }
    return result;
  };
}

document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.getElementById('statusBtn').addEventListener('click',openConnection);
document.getElementById('refreshBtn').addEventListener('click',()=>cloud.user?refreshData():openConnection());
document.getElementById('closeConnectionBtn').addEventListener('click',()=>connectionDialog.close());
window.addEventListener('online',()=>{if(cloud.user)refreshData({silent:true});else updateStatus();});
window.addEventListener('offline',updateStatus);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cloud.user)updateDateRefresh();});

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    // A new worker may contain backend/auth routing changes. Once it takes
    // control, immediately replace any stale in-memory snapshot from the old
    // deployment with a fresh canonical-backend read.
    setTimeout(()=>{ if(cloud.user) refreshData({silent:true}); },250);
  });
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then(reg=>reg.update())
    .catch(e=>console.warn('Service worker registration failed',e));
}

render();
initCloud(false).then(()=>{
  // If there is no authenticated session, make that explicit instead of
  // silently showing an empty dashboard that looks like missing data.
  if(!cloud.user && configured()) setTimeout(()=>{ if(!connectionDialog.open) openConnection(); },200);
});
