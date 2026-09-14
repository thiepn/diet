'use strict';

function v51DateFromWeeks(weeks) {
  if (weeks == null || !Number.isFinite(Number(weeks))) return null;
  const d = new Date();
  d.setDate(d.getDate() + Math.round(Number(weeks) * 7));
  return d;
}

function v51DateLabel(date) {
  return date ? date.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : null;
}

function v51CoachAnalysis() {
  v5EnsureDashboardShape();
  const profile = dashboard.profile || {};
  const complete = completeDates(28);
  const calorieHits = complete.filter(d => Math.abs(totalsFor(d).calories - targetsFor(d).calories) <= 150).length;
  const proteinHits = complete.filter(d => totalsFor(d).protein >= targetsFor(d).protein).length;
  const fiberDays = complete.map(d => ({date:d, fiber:v5MacroForDate(d,'fiber')})).filter(x => x.fiber.complete);
  const fiberHits = fiberDays.filter(x => x.fiber.value >= Number(profile.fiberTarget || 30)).length;

  let adherenceScore = null;
  if (complete.length) {
    let weighted = (calorieHits / complete.length) * 45 + (proteinHits / complete.length) * 35;
    let totalWeight = 80;
    if (fiberDays.length) {
      weighted += (fiberHits / fiberDays.length) * 20;
      totalWeight = 100;
    }
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
  else if (Math.abs(desiredPace) < .05) {
    paceStatus = Math.abs(observedPace) <= .15 ? 'on_pace' : observedPace > 0 ? 'gaining' : 'losing';
  } else if (desiredPace < 0) {
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
  if (goal != null && trendWeight != null && desiredPace != null && Math.abs(desiredPace) >= .05 && (goal-trendWeight)*desiredPace > 0) {
    plannedWeeks = Math.ceil(Math.abs(goal-trendWeight)/Math.abs(desiredPace));
  }
  if (goal != null && trendWeight != null && observedPace != null && Math.abs(observedPace) >= .05 && (goal-trendWeight)*observedPace > 0) {
    actualWeeks = Math.ceil(Math.abs(goal-trendWeight)/Math.abs(observedPace));
  }

  const phase = v5CurrentPhase();
  let maintenanceStatus = 'not_applicable', remaining = null;
  if (goal != null && trendWeight != null && phase?.phaseType === 'cut') {
    remaining = trendWeight - goal;
    maintenanceStatus = remaining <= .3 ? 'transition_now' : remaining <= 1.5 ? 'prepare_transition' : 'continue_cut';
  } else if (goal != null && trendWeight != null && phase?.phaseType === 'gain') {
    remaining = goal - trendWeight;
    maintenanceStatus = remaining <= .3 ? 'transition_now' : remaining <= 1.5 ? 'prepare_transition' : 'continue_gain';
  }

  return {
    completeDays:complete.length, calorieHits, proteinHits, fiberCoveredDays:fiberDays.length, fiberHits, adherenceScore,
    weighIns:weights.length, weightSpan, trendWeight, observedPace, desiredPace, paceStatus,
    goal, plannedWeeks, actualWeeks,
    plannedDate:v51DateFromWeeks(plannedWeeks), actualDate:v51DateFromWeeks(actualWeeks),
    phase, maintenanceStatus, remaining
  };
}

function v51PaceMeta(a) {
  const map = {
    building_baseline:['Building baseline','Add more weigh-ins before Diet Copilot judges your pace.','baseline'],
    target_not_set:['No target pace','Set a desired weekly weight change to enable pace coaching.','baseline'],
    on_pace:['On pace',`${a.observedPace>0?'+':''}${fmt(a.observedPace,2)} kg/week vs ${a.desiredPace>0?'+':''}${fmt(a.desiredPace,2)} planned.`,'good'],
    slower_than_planned:['Slower than planned',`${a.observedPace>0?'+':''}${fmt(a.observedPace,2)} kg/week vs ${a.desiredPace>0?'+':''}${fmt(a.desiredPace,2)} planned.`,'warn'],
    faster_than_planned:['Faster than planned',`${a.observedPace>0?'+':''}${fmt(a.observedPace,2)} kg/week vs ${a.desiredPace>0?'+':''}${fmt(a.desiredPace,2)} planned.`,'warn'],
    possible_plateau:['Possible plateau',`The 28-day trend is ${a.observedPace>0?'+':''}${fmt(a.observedPace,2)} kg/week. Diet Copilot will use adherence data before recommending a calorie change.`,'warn'],
    gaining:['Weight trending up',`${a.observedPace>0?'+':''}${fmt(a.observedPace,2)} kg/week.`,'warn'],
    losing:['Weight trending down',`${a.observedPace>0?'+':''}${fmt(a.observedPace,2)} kg/week.`,'warn']
  };
  return map[a.paceStatus] || map.building_baseline;
}

function v51EtaMeta(a) {
  if (a.goal == null || a.trendWeight == null) return ['Not available','A goal weight and weigh-ins are required.','baseline'];
  if (a.actualWeeks != null) return [`~${a.actualWeeks} weeks`,`${v51DateLabel(a.actualDate)} at the observed trend · ${fmt(a.trendWeight,1)} kg trend weight → ${fmt(a.goal,1)} kg goal.`,'good'];
  if (a.plannedWeeks != null) return [`~${a.plannedWeeks} weeks`,`${v51DateLabel(a.plannedDate)} at your planned ${a.desiredPace>0?'+':''}${fmt(a.desiredPace,2)} kg/week pace. Actual ETA will replace this after enough weigh-ins.`,'baseline'];
  return ['Not available','Your current weight trend is not moving toward the configured goal yet.','warn'];
}

function v51AdherenceMeta(a) {
  if (!a.completeDays) return ['Not enough data','Complete days are required before adherence can be scored.','baseline'];
  const pieces=[`${a.calorieHits}/${a.completeDays} calories`,`${a.proteinHits}/${a.completeDays} protein`];
  if (a.fiberCoveredDays) pieces.push(`${a.fiberHits}/${a.fiberCoveredDays} fiber`);
  const cls=a.adherenceScore>=80?'good':a.adherenceScore>=60?'baseline':'warn';
  return [`${a.adherenceScore}%`,`${pieces.join(' · ')}. Calories count as on target within ±150 kcal.` ,cls];
}

function v51MaintenanceMeta(a) {
  if (a.maintenanceStatus === 'transition_now') return ['Transition recommended',`You are within about ${fmt(Math.max(0,a.remaining),1)} kg of the goal. Diet Copilot should recommend a maintenance phase rather than automatically continuing the cut.`,'good'];
  if (a.maintenanceStatus === 'prepare_transition') return ['Prepare for maintenance',`About ${fmt(Math.max(0,a.remaining),1)} kg remains. Start planning the transition, but do not change phases automatically.`,'baseline'];
  if (a.maintenanceStatus === 'continue_cut') return ['Continue cut',`${fmt(Math.max(0,a.remaining),1)} kg remains to the goal. No maintenance transition is indicated yet.`,'baseline'];
  if (a.maintenanceStatus === 'continue_gain') return ['Continue gain',`${fmt(Math.max(0,a.remaining),1)} kg remains to the goal.`,'baseline'];
  return ['Not applicable','Maintenance-transition coaching activates near the end of an active cut or gain phase.','baseline'];
}

function v51CoachCard(type,label,meta) {
  const [value,copy,cls]=meta;
  return `<article class="v51-coach-card ${type} ${cls}"><div class="v51-coach-label">${esc(label)}</div><strong>${esc(value)}</strong><p>${esc(copy)}</p></article>`;
}

const v51RenderInsightsBase = renderInsights;
renderInsights = function renderInsightsV51() {
  const result = v51RenderInsightsBase();
  const root = app.querySelector('.p3-insights-view');
  if (!root) return result;
  const analysis = v51CoachAnalysis();
  const existing = root.querySelector('.v51-smart-coach');
  existing?.remove();
  root.insertAdjacentHTML('beforeend',`<section class="v51-smart-coach"><div class="v5-section-head"><div><h3>Smart Diet Coach</h3><p>Trend-based guidance that waits for enough data instead of reacting to daily scale noise.</p></div></div><div class="v51-coach-grid">${v51CoachCard('pace','Weight-loss pace',v51PaceMeta(analysis))}${v51CoachCard('eta','Goal ETA',v51EtaMeta(analysis))}${v51CoachCard('adherence','Adherence',v51AdherenceMeta(analysis))}${v51CoachCard('maintenance','Maintenance transition',v51MaintenanceMeta(analysis))}</div></section>`);
  const memoryCopy=root.querySelector('.v5-intel-card.memory p');
  if(memoryCopy&&!memoryCopy.dataset.v51){memoryCopy.dataset.v51='1';memoryCopy.insertAdjacentText('beforeend',' Portion scaling is supported, so “half”, “1.5×”, or a different gram amount can reuse the same verified food instead of creating a new estimate.');}
  return result;
};

const v51RenderTodayBase = renderToday;
renderToday = function renderTodayV51() {
  const result = v51RenderTodayBase();
  const root = app.querySelector('.today-v2');
  if (!root) return result;
  const date=localDateKey(), meals=mealsFor(date), status=String(dayLog(date).status||'open');
  const head=root.querySelector('.today-meals-head');
  if(head&&!root.querySelector('.v51-closeout-hint')&&meals.length){
    const text=status==='complete'?'Day complete. If you log something else later, Diet Copilot will reopen it automatically.':'When you are finished eating, tell ChatGPT “I’m done for today” to close the day and make it eligible for adherence averages.';
    head.insertAdjacentHTML('afterend',`<div class="v51-closeout-hint ${status==='complete'?'complete':'open'}"><span class="v51-closeout-dot" aria-hidden="true"></span><span>${esc(text)}</span></div>`);
  }
  return result;
};
