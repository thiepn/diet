'use strict';

let p3TrendMetric = 'weight';

function p3GateView() {
  if (cloud.status === 'cache' || (cloud.status === 'syncing' && dashboard.source === 'empty')) {
    app.innerHTML = p2LoadingState();
    return true;
  }
  if (!cloud.user) {
    app.innerHTML = p2SignedOutState();
    app.querySelector('[data-open-account]')?.addEventListener('click', openConnection);
    return true;
  }
  if (cloud.status === 'error' && dashboard.source === 'empty') {
    app.innerHTML = p2ErrorState(cloud.error);
    app.querySelector('[data-retry-dashboard]')?.addEventListener('click', () => refreshData());
    return true;
  }
  return false;
}

function p3PageHeader(title, copy) {
  return `<div class="p3-page-head"><div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div></div>`;
}

function p3RangeBar(selected, attr, ranges) {
  return `<div class="p3-range-bar" role="group" aria-label="Time range">${ranges.map(([value,label]) => {
    const key = Number.isFinite(value) ? value : 'all';
    return `<button class="p3-range-btn ${selected===value?'active':''}" type="button" data-${attr}-range="${key}">${label}</button>`;
  }).join('')}</div>`;
}

function p3StatusLabel(date) {
  const status = String(dayLog(date).status || '').toLowerCase();
  if (status === 'complete') return { label:'Complete', cls:'complete' };
  if (date === localDateKey()) return { label:'Today', cls:'today' };
  if (status === 'partial') return { label:'Partial', cls:'partial' };
  if (status === 'open') return { label:'Open', cls:'open' };
  return { label:'Recorded', cls:'recorded' };
}

function p3HistoryMealRow(meal) {
  const cls = p2MealClass(meal.type);
  const source = p2SourceMeta(meal);
  return `<div class="p3-history-meal ${cls}">
    <div class="p3-history-meal-main">
      <div class="p3-history-meal-kicker"><span class="p3-meal-dot" aria-hidden="true"></span><span>${esc(meal.type || 'Meal')}</span></div>
      <strong>${esc(meal.title || 'Meal')}</strong>
      <small><span class="protein-text">${fmt(meal.protein,1)} g protein</span> · ${esc(source.label)}</small>
    </div>
    <div class="p3-history-meal-kcal">${fmt(meal.calories)}<small>kcal</small></div>
  </div>`;
}

function p3HistoryDay(date) {
  const meals = mealsFor(date);
  const total = totalsFor(date);
  const target = targetsFor(date);
  const weight = weightFor(date);
  const status = p3StatusLabel(date);
  const caloriePct = target.calories ? Math.max(0, Math.min(100, total.calories / target.calories * 100)) : 0;
  return `<details class="p3-history-day">
    <summary>
      <div class="p3-history-date-block">
        <strong>${prettyDate(date,{weekday:'short',day:'numeric',month:'short'})}</strong>
        <span class="p3-day-status ${status.cls}">${status.label}</span>
      </div>
      <div class="p3-history-metrics">
        <div class="p3-history-metric calories"><strong>${fmt(total.calories)}</strong><span>kcal</span></div>
        <div class="p3-history-metric protein"><strong>${fmt(total.protein,1)}</strong><span>g protein</span></div>
        <div class="p3-history-metric weight"><strong>${weight ? fmt(weight.weight,1) : '—'}</strong><span>kg</span></div>
      </div>
      <div class="p3-history-progress" aria-hidden="true"><span style="width:${caloriePct}%"></span></div>
      <svg class="p3-history-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </summary>
    <div class="p3-history-body">
      ${meals.length ? meals.map(p3HistoryMealRow).join('') : `<div class="p3-history-no-meals">No meals recorded for this day.</div>`}
      <div class="p3-history-day-footer"><span>Calorie target ${fmt(target.calories)} kcal</span><span>Protein target ${fmt(target.protein)} g</span></div>
    </div>
  </details>`;
}

renderHistory = function renderHistoryP3() {
  if (p3GateView()) return;
  const dates = datesInRange(historyRange).sort().reverse();
  app.innerHTML = `<div class="p3-view p3-history-view">
    ${p3PageHeader('History','A compact view of what you ate, your protein intake and weigh-ins.')}
    ${p3RangeBar(historyRange,'history',[[3,'3D'],[7,'7D'],[14,'14D'],[30,'30D'],[90,'90D'],[Infinity,'All']])}
    <div class="p3-history-list">${dates.length ? dates.map(p3HistoryDay).join('') : `<div class="p3-empty"><strong>No history in this range</strong><span>Meals and weigh-ins logged through ChatGPT will appear here.</span></div>`}</div>
  </div>`;
  app.querySelectorAll('[data-history-range]').forEach(button => button.addEventListener('click', () => {
    historyRange = button.dataset.historyRange === 'all' ? Infinity : Number(button.dataset.historyRange);
    renderHistory();
  }));
};

function p3TrendRanges() {
  return [[7,'7D'],[30,'30D'],[90,'90D'],[180,'6M'],[Infinity,'All']];
}

function p3TrendTabs() {
  const tabs = [['weight','Weight'],['calories','Calories'],['protein','Protein']];
  return `<div class="p3-segmented" role="tablist" aria-label="Trend metric">${tabs.map(([key,label]) => `<button type="button" role="tab" aria-selected="${p3TrendMetric===key?'true':'false'}" class="${p3TrendMetric===key?'active':''}" data-trend-metric="${key}">${label}</button>`).join('')}</div>`;
}

function p3TrendDates() {
  return datesInRange(trendRange).sort();
}

function p3CompleteDates() {
  return p3TrendDates().filter(date => dayLog(date).status === 'complete');
}

function p3WeightChart(weights, moving) {
  if (weights.length < 2) return `<div class="p3-chart-empty"><strong>Not enough weight data yet</strong><span>Two or more weigh-ins are needed to draw a trend.</span></div>`;
  const width = 760, height = 250, left = 42, right = 18, top = 24, bottom = 34;
  const values = [...weights.map(w=>Number(w.weight)), ...moving.map(w=>Number(w.value))];
  let min = Math.min(...values), max = Math.max(...values);
  const padValue = Math.max(.3,(max-min)*.2);
  min -= padValue; max += padValue;
  if (min === max) { min -= .5; max += .5; }
  const xFor = (i,len) => left + i * ((width-left-right)/Math.max(1,len-1));
  const yFor = value => top + (max-value)/(max-min) * (height-top-bottom);
  const raw = weights.map((w,i)=>({x:xFor(i,weights.length),y:yFor(w.weight),value:w.weight,date:w.date}));
  const smooth = moving.map((w,i)=>({x:xFor(i,moving.length),y:yFor(w.value),value:w.value,date:w.date}));
  const path = points => points.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weight trend chart">
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/>
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>
    <path class="p3-weight-raw-line" d="${path(raw)}"/>
    <path class="p3-weight-trend-line" d="${path(smooth)}"/>
    ${raw.map(p=>`<circle class="p3-weight-point" cx="${p.x}" cy="${p.y}" r="4"><title>${prettyDate(p.date,{day:'numeric',month:'short'})}: ${fmt(p.value,1)} kg</title></circle>`).join('')}
    <text class="p3-axis-label" x="${left}" y="16">${fmt(max,1)} kg</text>
    <text class="p3-axis-label" x="${left}" y="${height-8}">${fmt(min,1)} kg</text>
    <text class="p3-axis-date" x="${left}" y="${height-8}" text-anchor="start">${prettyDate(weights[0].date,{day:'numeric',month:'short'})}</text>
    <text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(weights.at(-1).date,{day:'numeric',month:'short'})}</text>
  </svg></div>`;
}

function p3BarChart(metric, dates) {
  if (!dates.length) return `<div class="p3-chart-empty"><strong>No ${metric} data yet</strong><span>Logged days will appear here as your history grows.</span></div>`;
  const width = 760, height = 250, left = 42, right = 18, top = 24, bottom = 34;
  const isCalories = metric === 'calories';
  const points = dates.map(date => ({
    date,
    value: isCalories ? totalsFor(date).calories : totalsFor(date).protein,
    target: isCalories ? targetsFor(date).calories : targetsFor(date).protein,
    complete: dayLog(date).status === 'complete'
  }));
  const max = Math.max(1,...points.map(p=>Math.max(Number(p.value)||0,Number(p.target)||0))) * 1.12;
  const plotWidth = width-left-right;
  const step = plotWidth / Math.max(1,points.length);
  const barWidth = Math.max(5,Math.min(30,step*.58));
  const yFor = value => top + (1-(Number(value)||0)/max)*(height-top-bottom);
  const targetPath = points.map((p,i)=>`${i?'L':'M'} ${(left+step*i+step/2).toFixed(1)} ${yFor(p.target).toFixed(1)}`).join(' ');
  const unit = isCalories ? 'kcal' : 'g';
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-bar-chart ${metric}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${isCalories?'Calorie':'Protein'} trend chart">
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/>
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>
    ${points.map((p,i)=>{ const x=left+step*i+(step-barWidth)/2; const y=yFor(p.value); const h=Math.max(1,height-bottom-y); return `<rect class="p3-bar ${p.complete?'complete':'partial'}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6,barWidth/2).toFixed(1)}"><title>${prettyDate(p.date,{day:'numeric',month:'short'})}: ${fmt(p.value,isCalories?0:1)} ${unit}</title></rect>`; }).join('')}
    <path class="p3-target-line" d="${targetPath}"/>
    <text class="p3-axis-label" x="${left}" y="16">${fmt(max,isCalories?0:1)} ${unit}</text>
    <text class="p3-axis-date" x="${left}" y="${height-8}" text-anchor="start">${prettyDate(points[0].date,{day:'numeric',month:'short'})}</text>
    <text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(points.at(-1).date,{day:'numeric',month:'short'})}</text>
  </svg><div class="p3-chart-legend"><span><i class="p3-legend-bar"></i>Recorded</span><span><i class="p3-legend-line"></i>Target</span></div></div>`;
}

function p3TrendWeight() {
  const start = rangeStart(trendRange);
  const weights = dashboard.weights.filter(w=>w.date>=start).sort((a,b)=>a.date.localeCompare(b.date));
  const moving = rollingWeightAverages(weights,7);
  const latest = weights.at(-1) || latestWeight();
  const delta = weightDelta(trendRange);
  const pace = weeklyWeightPace(trendRange);
  return `<div class="p3-trend-summary weight">
    <div class="p3-trend-primary"><span>Current weight</span><strong>${latest?`${fmt(latest.weight,1)} kg`:'—'}</strong><small>${delta==null?'Add more weigh-ins to compare':`${delta>0?'+':''}${fmt(delta,1)} kg in selected range`}</small></div>
    <div class="p3-trend-secondary"><div><span>Weekly pace</span><strong>${pace==null?'—':`${pace>0?'+':''}${fmt(pace,2)} kg`}</strong></div><div><span>Weigh-ins</span><strong>${weights.length}</strong></div></div>
  </div>${p3WeightChart(weights,moving)}`;
}

function p3TrendCalories() {
  const dates = p3TrendDates();
  const complete = p3CompleteDates();
  const avg = complete.length ? average(complete.map(d=>totalsFor(d).calories)) : null;
  const avgTarget = complete.length ? average(complete.map(d=>targetsFor(d).calories)) : null;
  const delta = avg==null||avgTarget==null ? null : avg-avgTarget;
  return `<div class="p3-trend-summary calories">
    <div class="p3-trend-primary"><span>Average calories</span><strong>${avg==null?'—':`${fmt(avg)} kcal`}</strong><small>${complete.length?`${complete.length} complete day${complete.length===1?'':'s'}`:'Complete days are used for averages'}</small></div>
    <div class="p3-trend-secondary"><div><span>Average target</span><strong>${avgTarget==null?'—':`${fmt(avgTarget)} kcal`}</strong></div><div><span>Vs target</span><strong>${delta==null?'—':`${delta>0?'+':''}${fmt(delta)} kcal`}</strong></div></div>
  </div>${p3BarChart('calories',dates)}`;
}

function p3TrendProtein() {
  const dates = p3TrendDates();
  const complete = p3CompleteDates();
  const avg = complete.length ? average(complete.map(d=>totalsFor(d).protein)) : null;
  const avgTarget = complete.length ? average(complete.map(d=>targetsFor(d).protein)) : null;
  const hits = complete.filter(d=>totalsFor(d).protein>=targetsFor(d).protein).length;
  const hitRate = complete.length ? Math.round(hits/complete.length*100) : null;
  return `<div class="p3-trend-summary protein">
    <div class="p3-trend-primary"><span>Average protein</span><strong>${avg==null?'—':`${fmt(avg,1)} g`}</strong><small>${complete.length?`${hits} of ${complete.length} complete days hit target`:'Complete days are used for averages'}</small></div>
    <div class="p3-trend-secondary"><div><span>Average target</span><strong>${avgTarget==null?'—':`${fmt(avgTarget,0)} g`}</strong></div><div><span>Target hit rate</span><strong>${hitRate==null?'—':`${hitRate}%`}</strong></div></div>
  </div>${p3BarChart('protein',dates)}`;
}

renderTrends = function renderTrendsP3() {
  if (p3GateView()) return;
  const metricContent = p3TrendMetric === 'weight' ? p3TrendWeight() : p3TrendMetric === 'calories' ? p3TrendCalories() : p3TrendProtein();
  app.innerHTML = `<div class="p3-view p3-trends-view">
    ${p3PageHeader('Trends','Follow weight, calories and protein without cluttering the screen with competing charts.')}
    ${p3TrendTabs()}
    ${p3RangeBar(trendRange,'trend',p3TrendRanges())}
    <section class="p3-trend-panel ${p3TrendMetric}">${metricContent}</section>
  </div>`;
  app.querySelectorAll('[data-trend-metric]').forEach(button => button.addEventListener('click',()=>{
    p3TrendMetric = button.dataset.trendMetric;
    renderTrends();
  }));
  app.querySelectorAll('[data-trend-range]').forEach(button => button.addEventListener('click',()=>{
    trendRange = button.dataset.trendRange === 'all' ? Infinity : Number(button.dataset.trendRange);
    renderTrends();
  }));
};

function p3InsightIcon(type) {
  const icons = {
    weight:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0"/><path d="m12 10 1.8-2.2"/></svg>',
    calories:'<svg viewBox="0 0 24 24"><path d="M13 2s1 4-2 6c-2 1.4-3 3.2-3 5.3A5.7 5.7 0 0 0 13.7 19 5.3 5.3 0 0 0 19 13.7C19 8.7 15 6 13 2Z"/><path d="M10.5 17c-1.1-2.7.4-4.5 2.3-6.2.1 2.1 1.7 3 1.7 4.5 0 1.2-.8 2.2-2 2.7"/></svg>',
    protein:'<svg viewBox="0 0 24 24"><path d="M6 9v6M18 9v6M3 10v4M21 10v4M6 12h12"/></svg>',
    logging:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></svg>',
    quality:'<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/></svg>'
  };
  return icons[type] || icons.quality;
}

function p3InsightCard(type,title,value,copy) {
  return `<article class="p3-insight ${type}"><div class="p3-insight-icon" aria-hidden="true">${p3InsightIcon(type)}</div><div><span class="p3-insight-label">${esc(title)}</span><strong>${esc(value)}</strong><p>${esc(copy)}</p></div></article>`;
}

renderInsights = function renderInsightsP3() {
  if (p3GateView()) return;
  const c7 = completeDates(7);
  const c30 = completeDates(30);
  const avgCalories7 = c7.length ? average(c7.map(d=>totalsFor(d).calories)) : null;
  const avgCalories30 = c30.length ? average(c30.map(d=>totalsFor(d).calories)) : null;
  const avgProtein7 = c7.length ? average(c7.map(d=>totalsFor(d).protein)) : null;
  const proteinHits = c7.filter(d=>totalsFor(d).protein>=targetsFor(d).protein).length;
  const pace = weeklyWeightPace(30);
  const weights30 = dashboard.weights.filter(w=>w.date>=rangeStart(30)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightChange = weights30.length>1 ? weights30.at(-1).weight-weights30[0].weight : null;
  const dates14 = datesInRange(14);
  const complete14 = dates14.filter(d=>dayLog(d).status==='complete').length;
  const meals30 = dashboard.meals.filter(m=>m.date>=rangeStart(30));
  const exact = meals30.filter(m=>sourceQuality(m)==='exact').length;
  const estimated = meals30.length-exact;

  const weightValue = pace==null ? (latestWeight()?`${fmt(latestWeight().weight,1)} kg`:'—') : `${pace>0?'+':''}${fmt(pace,2)} kg/wk`;
  const weightCopy = pace==null ? (weights30.length<4?'More weigh-ins are needed for a reliable 30-day pace.':'No weekly trend available yet.') : `${weightChange==null?'':`${weightChange>0?'+':''}${fmt(weightChange,1)} kg across the selected 30-day window. `}Based on your recorded weigh-ins.`;
  const calorieValue = avgCalories7!=null ? `${fmt(avgCalories7)} kcal` : avgCalories30!=null ? `${fmt(avgCalories30)} kcal` : '—';
  const calorieCopy = avgCalories7!=null ? `7-day average across ${c7.length} complete day${c7.length===1?'':'s'}.` : avgCalories30!=null ? `30-day average across ${c30.length} complete day${c30.length===1?'':'s'}.` : 'Complete days are required for a meaningful calorie average.';
  const proteinValue = avgProtein7!=null ? `${fmt(avgProtein7,1)} g` : '—';
  const proteinCopy = c7.length ? `${proteinHits} of ${c7.length} complete days reached the recorded protein target.` : 'Complete days are required to measure protein consistency.';
  const loggingValue = dates14.length ? `${complete14}/${dates14.length}` : '—';
  const loggingCopy = dates14.length ? `Complete days among the ${dates14.length} recorded day${dates14.length===1?'':'s'} in the last 14 days.` : 'No recorded days in the last 14 days yet.';
  const qualityValue = meals30.length ? `${estimated} estimated` : '—';
  const qualityCopy = meals30.length ? `${exact} exact/label meal${exact===1?'':'s'} and ${estimated} estimated meal${estimated===1?'':'s'} in the last 30 days.` : 'Meal source quality will appear as your history grows.';

  app.innerHTML = `<div class="p3-view p3-insights-view">
    ${p3PageHeader('Insights','A short factual summary of what your recorded data currently says.')}
    <div class="p3-insights-grid">
      ${p3InsightCard('weight','Weight',weightValue,weightCopy)}
      ${p3InsightCard('calories','Calories',calorieValue,calorieCopy)}
      ${p3InsightCard('protein','Protein',proteinValue,proteinCopy)}
      ${p3InsightCard('logging','Logging',loggingValue,loggingCopy)}
      ${p3InsightCard('quality','Meal estimates',qualityValue,qualityCopy)}
    </div>
  </div>`;
};
