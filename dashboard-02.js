function setView(next) {
  view = next;
  document.querySelectorAll('.nav-item').forEach(b => { const active = b.dataset.view === next; b.classList.toggle('active', active); active ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current'); });
  render();
  window.scrollTo({ top:0, behavior:'auto' });
}

function readOnlyNote() {
  return `<div class="read-only-note"><span><strong>ChatGPT is the logger.</strong> Meals, corrections and weigh-ins are written to the shared database through ChatGPT. This site only displays your record.</span><span>${dashboard.fetchedAt ? `Updated ${new Date(dashboard.fetchedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'No cloud snapshot yet'}</span></div>`;
}

function render() {
  document.getElementById('dateLabel').textContent = new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'});
  if (view==='today') renderToday();
  else if (view==='history') renderHistory();
  else if (view==='trends') renderTrends();
  else renderInsights();
  updateStatus();
}

function renderToday() {
  const date = localDateKey(), meals = mealsFor(date), totals = totalsFor(date), target = targetsFor(date), remain = target.calories - totals.calories;
  const todayWeight = weightFor(date), latest = latestWeight(), proteinPct = target.protein ? Math.min(100, totals.protein/target.protein*100) : 0, kcalPct = target.calories ? Math.min(100, totals.calories/target.calories*100) : 0;
  app.innerHTML = `${readOnlyNote()}
    <section class="hero"><div class="hero-grid"><div><p class="eyebrow">Calories consumed</p><div class="hero-number">${fmt(totals.calories)}</div><div class="hero-sub">of ${fmt(target.calories)} kcal today</div><div class="remaining ${remain<0?'over':''}">${remain>=0?`${fmt(remain)} kcal remaining`:`${fmt(Math.abs(remain))} kcal over target`}</div><div class="progress"><span style="width:${kcalPct}%"></span></div></div><div class="metric-stack"><div class="metric"><small>Protein</small><strong>${fmt(totals.protein,1)} / ${fmt(target.protein)} g</strong><div class="progress"><span style="width:${proteinPct}%"></span></div></div><div class="metric"><small>Weight</small><strong>${todayWeight?`${fmt(todayWeight.weight,1)} kg`:latest?`${fmt(latest.weight,1)} kg`:'—'}</strong><div class="hero-sub">${todayWeight?'Today':latest?`Latest · ${prettyDate(latest.date,{day:'numeric',month:'short'})}`:'No weigh-ins yet'}</div></div></div></div></section>
    <section class="section"><div class="section-head"><div><h2>Today's log</h2><p>${meals.length} meal${meals.length===1?'':'s'} · ${esc(dayLog(date).status || 'partial')} day</p></div></div><div class="meal-list">${meals.length?meals.map(mealCard).join(''):`<div class="empty"><strong>No meals logged by ChatGPT yet</strong>Send your meal or a photo in ChatGPT. Once it is written to the shared database, it will appear here automatically.</div>`}</div></section>`;
}

function mealCard(m) {
  const range = m.caloriesLow != null && m.caloriesHigh != null && Number(m.caloriesLow)!==Number(m.caloriesHigh) ? `${fmt(m.caloriesLow)}–${fmt(m.caloriesHigh)} kcal` : null;
  const quality = sourceQuality(m);
  const items = (m.items || []).slice(0,5).map(i=>`<span class="meal-item">${esc(i.name)}${i.quantity?` · ${esc(i.quantity)}`:''}</span>`).join('');
  const time = m.eatenAt ? new Date(m.eatenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
  return `<article class="meal"><div class="meal-top"><div><h3>${esc(m.type)} · ${esc(m.title)}</h3><div class="meal-time">${time}${time?' · ':''}${fmt(m.protein,1)} g protein · <span class="${quality}">${quality}</span>${range?` · <span class="estimate">likely ${range}</span>`:''}</div></div><div class="meal-kcal">${fmt(m.calories)} kcal</div></div>${items?`<div class="meal-items">${items}</div>`:''}${m.notes?`<div class="meal-note" style="margin-top:9px">${esc(m.notes)}</div>`:''}</article>`;
}

function rangeButtons(selected, on = 'history') {
  const ranges = [[3,'3D'],[7,'7D'],[14,'14D'],[30,'30D'],[90,'90D'],[Infinity,'All']];
  return `<div class="range-bar">${ranges.map(([v,l])=>`<button class="range-btn ${selected===v?'active':''}" data-${on}-range="${Number.isFinite(v)?v:'all'}">${l}</button>`).join('')}</div>`;
}

function renderHistory() {
  const dates = datesInRange(historyRange).sort().reverse();
  app.innerHTML = `${readOnlyNote()}<section class="section" style="margin-top:8px"><div class="section-head"><div><h2>History</h2><p>Review what ChatGPT logged over time</p></div></div>${rangeButtons(historyRange,'history')}<div class="history-list" style="margin-top:12px">${dates.length?dates.map(historyDay).join(''):`<div class="empty"><strong>No history in this range</strong>Logged meals and weigh-ins will appear here.</div>`}</div></section>`;
  app.querySelectorAll('[data-history-range]').forEach(b=>b.addEventListener('click',()=>{ historyRange = b.dataset.historyRange==='all'?Infinity:Number(b.dataset.historyRange); renderHistory(); }));
}

function historyDay(date) {
  const meals = mealsFor(date), total = totalsFor(date), target = targetsFor(date), weight = weightFor(date), status = dayLog(date).status || 'partial';
  return `<details class="day-card"><summary><div class="day-date">${prettyDate(date,{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</div><div class="day-kcal">${fmt(total.calories)} kcal</div><div class="day-meta">${esc(status)}${weight?` · ${fmt(weight.weight,1)} kg`:''}</div><div class="day-meta right">${fmt(total.protein,1)} g protein · target ${fmt(target.calories)}</div></summary><div class="day-body">${meals.length?meals.map(m=>`<div class="day-meal"><div><strong>${esc(m.type)} · ${esc(m.title)}</strong><small>${(m.items||[]).map(i=>i.name).slice(0,3).join(' · ')}</small></div><strong>${fmt(m.calories)} kcal</strong></div>`).join(''):`<div class="day-meal"><small>No meals logged.</small></div>`}</div></details>`;
}

function rollingWeightAverages(weights,n=7) { return weights.map((w,i)=>{ const s=weights.slice(Math.max(0,i-n+1),i+1); return {date:w.date,value:average(s.map(x=>x.weight)),count:s.length}; }); }
function weightDelta(days) { const start = rangeStart(days), w = [...dashboard.weights].filter(x=>x.date>=start).sort((a,b)=>a.date.localeCompare(b.date)); return w.length>1 ? w.at(-1).weight - w[0].weight : null; }
function weeklyWeightPace(days=30) {
  const start=rangeStart(days), w=[...dashboard.weights].filter(x=>x.date>=start).sort((a,b)=>a.date.localeCompare(b.date)); if(w.length<4)return null;
  const x0=new Date(`${w[0].date}T12:00:00`).getTime(); const pts=w.map(a=>({x:(new Date(`${a.date}T12:00:00`).getTime()-x0)/86400000,y:a.weight})); const mx=average(pts.map(p=>p.x)), my=average(pts.map(p=>p.y)); const den=pts.reduce((s,p)=>s+(p.x-mx)**2,0); if(!den)return null; const slope=pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/den; return slope*7;
}

function renderTrends() {
  const dates = datesInRange(trendRange), complete = dates.filter(d=>dayLog(d).status==='complete');
  const avgCalories = average(complete.map(d=>totalsFor(d).calories)), avgProtein = average(complete.map(d=>totalsFor(d).protein));
  const weights = dashboard.weights.filter(w=>w.date>=rangeStart(trendRange)).sort((a,b)=>a.date.localeCompare(b.date)), moving=rollingWeightAverages(weights,7), latest=weights.at(-1), delta=weightDelta(trendRange);
  app.innerHTML = `${readOnlyNote()}<section class="section" style="margin-top:8px"><div class="section-head"><div><h2>Trends</h2><p>Calories, protein and body-weight movement</p></div></div>${rangeButtons(trendRange,'trend')}<div class="cards" style="margin-top:12px"><div class="stat-card"><small>Current weight</small><strong>${latest?`${fmt(latest.weight,1)} kg`:'—'}</strong><span>${delta==null?'Need more weigh-ins':`${delta>0?'+':''}${fmt(delta,1)} kg in range`}</span></div><div class="stat-card"><small>Avg calories</small><strong>${complete.length?fmt(avgCalories):'—'}</strong><span>${complete.length} complete day${complete.length===1?'':'s'}</span></div><div class="stat-card"><small>Avg protein</small><strong>${complete.length?`${fmt(avgProtein,1)} g`:'—'}</strong><span>Complete days only</span></div><div class="stat-card"><small>Weight pace</small><strong>${weeklyWeightPace(trendRange)==null?'—':`${weeklyWeightPace(trendRange)>0?'+':''}${fmt(weeklyWeightPace(trendRange),2)} kg/wk`}</strong><span>Regression estimate</span></div></div><div class="chart-card">${chartTitle('Weight trend','7-entry moving average')}${renderWeightChart(weights,moving)}</div><div class="chart-card">${chartTitle('Daily calories','Complete + partial days')}${renderCaloriesChart(dates)}</div></section>`;
  app.querySelectorAll('[data-trend-range]').forEach(b=>b.addEventListener('click',()=>{ trendRange=b.dataset.trendRange==='all'?Infinity:Number(b.dataset.trendRange); renderTrends(); }));
}
function chartTitle(a,b){return `<div class="chart-title"><h3>${a}</h3><span>${b}</span></div>`;}
function renderWeightChart(weights,moving){ if(weights.length<2)return `<div class="empty"><strong>Not enough weight data</strong>Two or more weigh-ins are needed for a chart.</div>`; const width=760,height=190,pad=28,vals=[...weights.map(w=>w.weight),...moving.map(w=>w.value)]; let min=Math.min(...vals),max=Math.max(...vals); if(min===max){min-=.5;max+=.5} const point=(v,i,len)=>({x:pad+i*((width-pad*2)/Math.max(1,len-1)),y:height-pad-((v-min)/(max-min))*(height-pad*2)}); const raw=weights.map((w,i)=>point(w.weight,i,weights.length)), mov=moving.map((w,i)=>point(w.value,i,moving.length)); const path=a=>a.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '); return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Weight trend"><line class="grid" x1="${pad}" x2="${width-pad}" y1="${pad}" y2="${pad}"/><line class="grid" x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}"/><path class="line2" d="${path(raw)}"/><path class="line" d="${path(mov)}"/>${raw.map(p=>`<circle class="point" cx="${p.x}" cy="${p.y}" r="3"/>`).join('')}<text x="${pad}" y="16">${fmt(max,1)} kg</text><text x="${pad}" y="${height-5}">${fmt(min,1)} kg</text></svg>`; }
function renderCaloriesChart(dates){ if(dates.length<2)return `<div class="empty"><strong>Not enough daily data</strong>More logged days are needed for a chart.</div>`; const width=760,height=190,pad=28,points=dates.map(d=>({date:d,value:totalsFor(d).calories,target:targetsFor(d).calories})); const max=Math.max(500,...points.map(p=>Math.max(p.value,p.target)))*1.08; const point=(v,i)=>({x:pad+i*((width-pad*2)/Math.max(1,points.length-1)),y:height-pad-(v/max)*(height-pad*2)}); const actual=points.map((p,i)=>point(p.value,i)), targets=points.map((p,i)=>point(p.target,i)); const path=a=>a.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '); return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Calories trend"><line class="grid" x1="${pad}" x2="${width-pad}" y1="${pad}" y2="${pad}"/><line class="grid" x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}"/><path class="line2" d="${path(targets)}"/><path class="line" d="${path(actual)}"/>${actual.map(p=>`<circle class="point" cx="${p.x}" cy="${p.y}" r="3"/>`).join('')}<text x="${pad}" y="16">${fmt(max)} kcal</text><text x="${pad}" y="${height-5}">0 kcal</text></svg>`; }

function renderInsights() {
  const c7=completeDates(7), c30=completeDates(30), meals30=dashboard.meals.filter(m=>m.date>=rangeStart(30));
  const pHits=c30.filter(d=>totalsFor(d).protein>=targetsFor(d).protein).length, exact=meals30.filter(m=>sourceQuality(m)==='exact').length, estimated=meals30.length-exact;
  const coverage14=Array.from({length:14},(_,i)=>offsetDateKey(-i)).filter(d=>dayLog(d).status==='complete').length;
  const avg7=average(c7.map(d=>totalsFor(d).calories)), avg30=average(c30.map(d=>totalsFor(d).calories)); const pace=weeklyWeightPace(30);
  const targetDev=c30.length?average(c30.map(d=>Math.abs(totalsFor(d).calories-targetsFor(d).calories))):null;
  app.innerHTML = `${readOnlyNote()}<section class="section" style="margin-top:8px"><div class="section-head"><div><h2>Insights</h2><p>What your recorded data currently says</p></div></div><div class="insights-grid">
    <article class="insight-card"><h3>Weight direction</h3><p>${pace==null?'There is not enough recent weight data to estimate a weekly pace yet.':`Your 30-day weight regression is <strong>${pace>0?'+':''}${fmt(pace,2)} kg/week</strong>. This is a trend estimate, not a single-day change.`}</p></article>
    <article class="insight-card"><h3>Calorie averages</h3><p>${c7.length?`Your 7-day complete-day average is <strong>${fmt(avg7)} kcal</strong>. `:'No complete days in the last week yet. '}${c30.length?`Across the last 30 days it is <strong>${fmt(avg30)} kcal</strong>.`:'There are not enough complete days for a 30-day average.'}</p></article>
    <article class="insight-card"><h3>Protein consistency</h3><p>${c30.length?`You reached the recorded protein target on <strong>${pHits} of ${c30.length}</strong> complete days in the last 30 days.`:'Mark days complete once ChatGPT has logged everything to make protein consistency meaningful.'}</p></article>
    <article class="insight-card"><h3>Logging completeness</h3><p><strong>${coverage14}/14</strong> days are marked complete in the last two weeks. Partial days are excluded from calorie averages so missing meals do not look like low-calorie success.</p></article>
    <article class="insight-card"><h3>Estimate quality</h3><div class="quality-row"><span>Exact / high-confidence source</span><strong>${exact}</strong></div><div class="quality-row"><span>AI / photo / restaurant estimate</span><strong>${estimated}</strong></div><div class="quality-row"><span>Average target deviation</span><strong>${targetDev==null?'—':`${fmt(targetDev)} kcal`}</strong></div></article>
    <article class="insight-card"><h3>What this dashboard is for</h3><p>Use ChatGPT to add, correct or delete entries. Use this site to inspect the resulting record, verify estimates, and review progress over days and months. There are deliberately no nutrition-entry controls here.</p></article>
  </div></section>`;
}
