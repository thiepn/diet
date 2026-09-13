'use strict';

function v53Pct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function v53Signed(value, digits=1, suffix='') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${fmt(n,digits)}${suffix}`;
}

function v53DateLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'});
}

function v53TodayData() {
  v5EnsureDashboardShape();
  const date = localDateKey();
  const meals = mealsFor(date);
  const totals = totalsFor(date);
  const target = targetsFor(date);
  const fiber = v5MacroForDate(date,'fiber');
  const fiberTarget = Number(dashboard.profile?.fiberTarget || 30);
  const todayWeight = weightFor(date);
  const latest = latestWeight();
  const stats = v52Metrics(28);
  const phase = v5CurrentPhase();
  const status = String(dayLog(date).status || 'open');
  return { date, meals, totals, target, fiber, fiberTarget, todayWeight, latest, stats, phase, status };
}

function v53EnsureDetailDialog() {
  let dialog = document.getElementById('metricDetailDialog');
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.id = 'metricDetailDialog';
  dialog.className = 'v53-detail-dialog';
  dialog.innerHTML = `<div class="v53-detail-sheet">
    <header class="v53-detail-head">
      <div class="v53-detail-heading"><span id="v53DetailEyebrow">Today</span><h2 id="v53DetailTitle">Details</h2></div>
      <button class="v53-detail-close" type="button" aria-label="Close details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="v53-detail-body" id="v53DetailBody"></div>
  </div>`;
  document.body.appendChild(dialog);

  dialog.querySelector('.v53-detail-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{ if(event.target === dialog) dialog.close(); });
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('v53-detail-open');
    const trigger = dialog._v53Trigger;
    if (trigger && document.contains(trigger)) trigger.focus({preventScroll:true});
  });
  return dialog;
}

function v53InfoGrid(items) {
  return `<div class="v53-info-grid">${items.map(item=>`<div class="v53-info-cell ${item.cls||''}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong>${item.note?`<small>${esc(item.note)}</small>`:''}</div>`).join('')}</div>`;
}

function v53Progress(label, value, pct, note='') {
  return `<div class="v53-progress-row"><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div><div class="v53-progress-track" aria-hidden="true"><span style="width:${v53Pct(pct)}%"></span></div>${note?`<small>${esc(note)}</small>`:''}</div>`;
}

function v53MealRows(meals, metric, unit, emptyCopy) {
  if (!meals.length) return `<div class="v53-empty">${esc(emptyCopy)}</div>`;
  return `<div class="v53-detail-list">${meals.map(meal=>{
    let value = meal[metric];
    const unknown = value == null || Number.isNaN(Number(value));
    const display = unknown ? 'Not recorded' : `${fmt(Number(value), metric==='calories'?0:1)} ${unit}`;
    return `<div class="v53-detail-row"><div><span>${esc(meal.type||'Meal')}</span><strong>${esc(meal.title||'Meal')}</strong></div><b class="${unknown?'muted':''}">${esc(display)}</b></div>`;
  }).join('')}</div>`;
}

function v53RecentWeightRows(weights) {
  const recent = [...weights].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  if (!recent.length) return `<div class="v53-empty">No weigh-ins have been recorded yet.</div>`;
  return `<div class="v53-detail-list">${recent.map((w,i)=>{
    const older = recent[i+1];
    const delta = older ? Number(w.weight)-Number(older.weight) : null;
    return `<div class="v53-detail-row"><div><span>${esc(prettyDate(w.date,{weekday:'short',day:'numeric',month:'short'}))}</span><strong>${fmt(w.weight,1)} kg</strong>${w.notes?`<small>${esc(w.notes)}</small>`:''}</div><b>${delta==null?'':v53Signed(delta,1,' kg')}</b></div>`;
  }).join('')}</div>`;
}

function v53Section(title, copy, content) {
  return `<section class="v53-detail-section"><div class="v53-section-title"><h3>${esc(title)}</h3>${copy?`<p>${esc(copy)}</p>`:''}</div>${content}</section>`;
}

function v53CaloriesDetail(d) {
  const remaining = Number(d.target.calories||0)-Number(d.totals.calories||0);
  const pct = d.target.calories ? d.totals.calories/d.target.calories*100 : 0;
  const statusLabel = d.status==='complete'?'Complete':d.status==='partial'?'Partial':'Open';
  const stats = d.stats;
  const currentPhase = d.phase?.name || 'No active phase';
  return `${v53InfoGrid([
      {label:'Consumed',value:`${fmt(d.totals.calories)} kcal`,cls:'calories'},
      {label:'Target',value:`${fmt(d.target.calories)} kcal`},
      {label:remaining>=0?'Remaining':'Over target',value:`${fmt(Math.abs(remaining))} kcal`,cls:remaining<0?'warn':''},
      {label:'Day status',value:statusLabel}
    ])}
    ${v53Progress('Today',`${Math.round(pct)}% of target`,pct,remaining>=0?`${fmt(remaining)} kcal remain`:`${fmt(Math.abs(remaining))} kcal above target`)}
    ${v53Section('Meal breakdown','Where today’s calories came from',v53MealRows(d.meals,'calories','kcal','No meals have been logged today.'))}
    ${v53Section('28-day context','Complete days only, so missing meals do not distort averages',v53InfoGrid([
      {label:'Average',value:stats.avgCalories==null?'—':`${fmt(stats.avgCalories)} kcal`},
      {label:'On-target days',value:stats.calorieHitRate==null?'—':`${stats.calorieHitRate}%`,note:'within ±150 kcal'},
      {label:'Typical miss',value:stats.avgAbsCalorieDelta==null?'—':`${fmt(stats.avgAbsCalorieDelta)} kcal`},
      {label:'Complete days',value:`${stats.completeDays}/${stats.loggedDays || 0}`}
    ]))}
    ${v53Section('Target context','The active plan behind today’s number',v53InfoGrid([
      {label:'Current phase',value:currentPhase},
      {label:'Phase target',value:d.phase?.calorieTarget!=null?`${fmt(d.phase.calorieTarget)} kcal`:`${fmt(dashboard.profile?.calorieTarget||d.target.calories)} kcal`},
      {label:'Adaptive targets',value:dashboard.profile?.adaptiveTargetEnabled===false?'Off':'On'},
      {label:'Data source',value:d.status==='complete'?'Finalized day':'Live day'}
    ]))}`;
}

function v53ProteinDetail(d) {
  const target = Number(d.target.protein||0);
  const value = Number(d.totals.protein||0);
  const remaining = Math.max(0,target-value);
  const pct = target ? value/target*100 : 0;
  const best = [...d.meals].sort((a,b)=>Number(b.protein||0)-Number(a.protein||0))[0];
  return `${v53InfoGrid([
      {label:'Today',value:`${fmt(value,1)} g`,cls:'protein'},
      {label:'Target',value:`${fmt(target)} g`},
      {label:'Remaining',value:`${fmt(remaining,1)} g`},
      {label:'Top meal',value:best?`${fmt(best.protein,1)} g`:'—',note:best?.title||''}
    ])}
    ${v53Progress('Protein target',`${Math.round(pct)}% reached`,pct,target?`${fmt(remaining,1)} g still needed to reach today’s target`:'' )}
    ${v53Section('Meal breakdown','Protein recorded in each meal',v53MealRows(d.meals,'protein','g','No protein has been logged today.'))}
    ${v53Section('28-day consistency','Complete days only',v53InfoGrid([
      {label:'Average',value:d.stats.avgProtein==null?'—':`${fmt(d.stats.avgProtein,1)} g`},
      {label:'Target hit rate',value:d.stats.proteinHitRate==null?'—':`${d.stats.proteinHitRate}%`},
      {label:'Days hit',value:d.stats.completeDays?`${d.stats.proteinHits}/${d.stats.completeDays}`:'—'},
      {label:'Plan target',value:`${fmt(d.stats.proteinTarget)} g`}
    ]))}`;
}

function v53WeightDetail(d) {
  const displayWeight = d.todayWeight?.weight ?? d.latest?.weight ?? null;
  const displayDate = d.todayWeight?.date ?? d.latest?.date ?? null;
  const trend = d.stats.trendWeight;
  const goal = d.stats.goal;
  const goalGap = goal!=null&&trend!=null ? Math.abs(trend-goal) : null;
  return `${v53InfoGrid([
      {label:d.todayWeight?'Today':'Latest',value:displayWeight==null?'—':`${fmt(displayWeight,1)} kg`,cls:'weight',note:displayDate?prettyDate(displayDate,{day:'numeric',month:'short'}):''},
      {label:'Trend weight',value:trend==null?'—':`${fmt(trend,1)} kg`,note:'7 latest weigh-ins'},
      {label:'28D pace',value:v53Signed(d.stats.pace,2,' kg/wk')},
      {label:'Goal distance',value:goalGap==null?'—':`${fmt(goalGap,1)} kg`}
    ])}
    ${v53Section('Pace','Observed movement compared with the plan',v53InfoGrid([
      {label:'Observed',value:v53Signed(d.stats.pace,2,' kg/week')},
      {label:'Desired',value:v53Signed(d.stats.desired,2,' kg/week')},
      {label:'Range change',value:v53Signed(d.stats.weightChange,1,' kg')},
      {label:'Weigh-ins',value:String(d.stats.weighIns)}
    ]))}
    ${v53Section('Recent weigh-ins','Newest first',v53RecentWeightRows(dashboard.weights||[]))}
    ${v53Section('How this is interpreted','Daily scale changes are noisy. Diet Copilot emphasizes the recent trend and weekly pace instead of reacting to one reading.',v53InfoGrid([
      {label:'Trend method',value:'7-entry average'},
      {label:'Pace window',value:'28 days'},
      {label:'Goal',value:goal==null?'Not set':`${fmt(goal,1)} kg`},
      {label:'Phase baseline',value:d.stats.startWeight==null?'—':`${fmt(d.stats.startWeight,1)} kg`}
    ]))}`;
}

function v53FiberDetail(d) {
  const value = Number(d.fiber.value||0);
  const target = d.fiberTarget;
  const remaining = Math.max(0,target-value);
  const pct = target ? value/target*100 : 0;
  const covered = d.fiber.complete;
  return `${v53InfoGrid([
      {label:'Today',value:d.fiber.hasAny?`${fmt(value,1)} g`:'—',cls:'fiber'},
      {label:'Target',value:`${fmt(target)} g`},
      {label:'Remaining',value:d.fiber.hasAny?`${fmt(remaining,1)} g`:'—'},
      {label:'Coverage',value:d.fiber.hasAny?(covered?'Complete':'Partial'):'No data',note:d.fiber.unknown?`${d.fiber.unknown} meal${d.fiber.unknown===1?'':'s'} missing fiber`:''}
    ])}
    ${v53Progress('Fiber target',d.fiber.hasAny?`${Math.round(pct)}% recorded`:'No fiber data',pct,covered?'All meals have fiber data':'Today’s total may be understated while meal fiber values are missing')}
    ${v53Section('Meal breakdown','Fiber recorded for each meal',v53MealRows(d.meals,'fiber','g','No meals have been logged today.'))}
    ${v53Section('28-day consistency','Only days with complete fiber coverage are scored',v53InfoGrid([
      {label:'Average',value:d.stats.avgFiber==null?'—':`${fmt(d.stats.avgFiber,1)} g`},
      {label:'Target hit rate',value:d.stats.fiberHitRate==null?'—':`${d.stats.fiberHitRate}%`},
      {label:'Covered days',value:String(d.stats.fiberCoveredDays)},
      {label:'Days hit',value:d.stats.fiberCoveredDays?`${d.stats.fiberHits}/${d.stats.fiberCoveredDays}`:'—'}
    ]))}`;
}

function v53GoalDetail(d) {
  const s = d.stats;
  const phase = d.phase;
  const pct = s.goalProgress==null?0:s.goalProgress;
  const eta = s.etaWeeks==null?'—':`~${s.etaWeeks} weeks`;
  return `${v53InfoGrid([
      {label:'Goal weight',value:s.goal==null?'Not set':`${fmt(s.goal,1)} kg`,cls:'goal'},
      {label:'Trend weight',value:s.trendWeight==null?'—':`${fmt(s.trendWeight,1)} kg`},
      {label:'Remaining',value:s.remaining==null?'—':`${fmt(s.remaining,1)} kg`},
      {label:'ETA',value:eta,note:s.etaSource?`${s.etaSource} pace`:''}
    ])}
    ${v53Progress('Goal progress',s.goalProgress==null?'Building baseline':`${fmt(s.goalProgress)}% complete`,pct,s.goalProgress==null?'A phase baseline and goal weight are needed for percentage progress.':`${fmt(s.remaining,1)} kg remaining to ${fmt(s.goal,1)} kg`)}
    ${v53Section('Active phase','The plan Diet Copilot is currently following',v53InfoGrid([
      {label:'Phase',value:phase?.name||'No active phase',note:phase?.phaseType||''},
      {label:'Calories',value:phase?.calorieTarget!=null?`${fmt(phase.calorieTarget)} kcal`:`${fmt(dashboard.profile?.calorieTarget||0)} kcal`},
      {label:'Protein',value:phase?.proteinTarget!=null?`${fmt(phase.proteinTarget)} g`:`${fmt(dashboard.profile?.proteinTarget||0)} g`},
      {label:'Fiber',value:phase?.fiberTarget!=null?`${fmt(phase.fiberTarget)} g`:`${fmt(dashboard.profile?.fiberTarget||30)} g`}
    ]))}
    ${v53Section('Pace and timeline','Progress uses trend weight rather than a single weigh-in',v53InfoGrid([
      {label:'Phase baseline',value:s.startWeight==null?'—':`${fmt(s.startWeight,1)} kg`},
      {label:'Desired pace',value:v53Signed(s.desired,2,' kg/week')},
      {label:'Observed pace',value:v53Signed(s.pace,2,' kg/week')},
      {label:'Progress source',value:s.goalProgress==null?'Need baseline':'Phase baseline → trend weight'}
    ]))}`;
}

function v53ProgressDetail(d) {
  const s = d.stats;
  const fiberRate = s.fiberHitRate==null?'—':`${s.fiberHitRate}%`;
  const goalValue = s.goalProgress==null?'—':`${fmt(s.goalProgress)}%`;
  return `${v53InfoGrid([
      {label:'Adherence',value:s.adherenceScore==null?'—':`${s.adherenceScore}%`,cls:'progress'},
      {label:'28D status',value:s.headline},
      {label:'Complete days',value:`${s.completeDays}/${s.loggedDays || 0}`},
      {label:'Goal progress',value:goalValue}
    ])}
    ${v53Progress('Overall adherence',s.adherenceScore==null?'Building baseline':`${s.adherenceScore}%`,s.adherenceScore||0,s.headlineCopy)}
    ${v53Section('Target consistency','How often complete days met the plan',v53InfoGrid([
      {label:'Calories',value:s.calorieHitRate==null?'—':`${s.calorieHitRate}%`,note:'within ±150 kcal'},
      {label:'Protein',value:s.proteinHitRate==null?'—':`${s.proteinHitRate}%`},
      {label:'Fiber',value:fiberRate,note:s.fiberCoveredDays?`${s.fiberCoveredDays} covered days`:'no covered days'},
      {label:'Day completion',value:s.completionRate==null?'—':`${s.completionRate}%`}
    ]))}
    ${v53Section('Body-weight movement','Progress beyond daily nutrition targets',v53InfoGrid([
      {label:'Trend weight',value:s.trendWeight==null?'—':`${fmt(s.trendWeight,1)} kg`},
      {label:'Observed pace',value:v53Signed(s.pace,2,' kg/week')},
      {label:'Desired pace',value:v53Signed(s.desired,2,' kg/week')},
      {label:'Remaining to goal',value:s.remaining==null?'—':`${fmt(s.remaining,1)} kg`}
    ]))}
    ${v53Section('Data quality','The score is only as useful as the logging behind it',v53InfoGrid([
      {label:'Meals',value:String(s.meals)},
      {label:'Exact / reused',value:s.exactRate==null?'—':`${s.exactRate}%`},
      {label:'Estimated',value:String(s.estimatedMeals)},
      {label:'Complete days',value:String(s.completeDays)}
    ]))}
    ${v53Section('Score weighting','Calories and protein always count. Fiber joins the score only when enough fiber coverage exists.',v53InfoGrid([
      {label:'Calories',value:'45%'},
      {label:'Protein',value:'35%'},
      {label:'Fiber',value:s.fiberCoveredDays?'20%':'Not scored'},
      {label:'Weight pace',value:'Context only'}
    ]))}`;
}

function v53DetailMarkup(metric, data) {
  if (metric === 'calories') return v53CaloriesDetail(data);
  if (metric === 'protein') return v53ProteinDetail(data);
  if (metric === 'weight') return v53WeightDetail(data);
  if (metric === 'fiber') return v53FiberDetail(data);
  if (metric === 'goal') return v53GoalDetail(data);
  return v53ProgressDetail(data);
}

function v53OpenMetricDetail(metric, trigger) {
  const dialog = v53EnsureDetailDialog();
  const data = v53TodayData();
  const titles = {
    calories:['Calories',`${v53DateLabel(data.date)} · today’s intake`],
    protein:['Protein',`${v53DateLabel(data.date)} · intake and consistency`],
    weight:['Weight','Recent weigh-ins, trend and weekly pace'],
    fiber:['Fiber',`${v53DateLabel(data.date)} · intake and data coverage`],
    goal:['Goal','Target weight, active phase and estimated timeline'],
    progress:['Progress','28-day adherence, consistency and body-weight movement']
  };
  const [title,eyebrow] = titles[metric] || titles.progress;
  dialog.querySelector('#v53DetailTitle').textContent = title;
  dialog.querySelector('#v53DetailEyebrow').textContent = eyebrow;
  dialog.querySelector('#v53DetailBody').innerHTML = v53DetailMarkup(metric,data);
  dialog._v53Trigger = trigger || document.activeElement;
  document.body.classList.add('v53-detail-open');
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');
  dialog.querySelector('.v53-detail-body').scrollTop = 0;
}

function v53MakeClickable(element, metric, label) {
  if (!element) return;
  element.classList.add('v53-clickable-tile');
  element.dataset.metricDetail = metric;
  element.setAttribute('role','button');
  element.setAttribute('tabindex','0');
  element.setAttribute('aria-haspopup','dialog');
  element.setAttribute('aria-label',`Open ${label} details`);
  if (!element.querySelector('.v53-open-indicator')) {
    element.insertAdjacentHTML('beforeend','<span class="v53-open-indicator" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></span>');
  }
  const open = event => {
    if (event.type === 'keydown' && !['Enter',' '].includes(event.key)) return;
    if (event.type === 'keydown') event.preventDefault();
    v53OpenMetricDetail(metric,element);
  };
  element.addEventListener('click',open);
  element.addEventListener('keydown',open);
}

const v53RenderTodayBase = renderToday;
renderToday = function renderTodayV53() {
  const result = v53RenderTodayBase();
  const root = app.querySelector('.today-v2');
  if (!root) return result;

  const data = v53TodayData();
  const metrics = root.querySelector('.today-metrics');
  if (!root.querySelector('.v5-goal-strip')) {
    const goal = data.stats.goal;
    const phase = data.phase;
    const pace = data.stats.desired;
    const parts = [];
    if (phase) parts.push(`<strong>${esc(phase.name)}</strong>`);
    if (goal != null) parts.push(`Goal ${fmt(goal,1)} kg`);
    if (pace != null) parts.push(`Desired ${pace>0?'+':''}${fmt(pace,2)} kg/week`);
    metrics?.insertAdjacentHTML('afterend',`<div class="v5-goal-strip"><span>Goal</span><div>${parts.length?parts.join('<i>·</i>'):'<strong>No goal configured</strong>'}</div></div>`);
  }
  if (!root.querySelector('.v52-goal-progress')) {
    const goalStrip = root.querySelector('.v5-goal-strip');
    const pct = data.stats.goalProgress == null ? 0 : data.stats.goalProgress;
    const label = data.stats.goal == null ? 'Set a goal to track progress' : `Progress to ${fmt(data.stats.goal,1)} kg`;
    const value = data.stats.goalProgress == null ? 'Building baseline' : `${fmt(data.stats.goalProgress)}% · ${fmt(data.stats.remaining,1)} kg remaining`;
    goalStrip?.insertAdjacentHTML('afterend',`<div class="v52-goal-progress"><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div><div class="v52-goal-track" aria-hidden="true"><span style="width:${v53Pct(pct)}%"></span></div></div>`);
  }

  v53MakeClickable(root.querySelector('.calorie-hero-v2'),'calories','calories');
  v53MakeClickable(root.querySelector('.today-metric.protein'),'protein','protein');
  v53MakeClickable(root.querySelector('.today-metric.weight'),'weight','weight');
  v53MakeClickable(root.querySelector('.today-metric.fiber'),'fiber','fiber');
  v53MakeClickable(root.querySelector('.v5-goal-strip'),'goal','goal');
  v53MakeClickable(root.querySelector('.v52-goal-progress'),'progress','progress');

  return result;
};

// iOS Safari still exposes gesture events in browser mode. The viewport meta tag
// handles normal pinch zoom; this closes the remaining gesture path so the PWA
// behaves like an installed app.
document.addEventListener('gesturestart',event=>event.preventDefault(),{passive:false});
