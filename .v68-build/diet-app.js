/* Diet Copilot Web 1.0.2 — stable production bundle. */

/* ===== src/core/dashboard-01.js ===== */
'use strict';

const RELEASE = '3.2';
const CACHE_KEY = 'diet-copilot-dashboard-cache-v2';
const CLOUD_CONFIG_KEY = 'diet-copilot-cloud-config';
const LEGACY_STATE_KEY = 'diet-copilot-state';
const DIET_SUPABASE = Object.freeze({
  url: 'https://hycegznamzjhwinegaai.supabase.co',
  key: 'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR'
});
const app = document.getElementById('app');
const connectionDialog = document.getElementById('connectionDialog');
const connectionContent = document.getElementById('connectionContent');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

let view = 'today';
let historyRange = 7;
let trendRange = 30;
let dashboard = loadCachedDashboard();
let cloudConfig = loadCloudConfig();
let cloud = { client: null, user: null, channel: null, authSubscription: null, status: 'cache', error: null, bridgeReady: false, schemaVersion: null };
let refreshTimer = null;

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function esc(v = '') { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function fmt(n, digits = 0) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits }); }
function localDateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function offsetDateKey(days, base = new Date()) { const d = new Date(base); d.setDate(d.getDate()+days); return localDateKey(d); }
function prettyDate(k, opts = { weekday:'short', day:'numeric', month:'short' }) { return new Date(`${k}T12:00:00`).toLocaleDateString(undefined, opts); }
function average(a) { return a.length ? a.reduce((x,y)=>x+Number(y||0),0)/a.length : 0; }
function sumMeals(meals) { return meals.reduce((a,m)=>({ calories:a.calories+Number(m.calories||0), protein:a.protein+Number(m.protein||0) }),{calories:0,protein:0}); }
function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t = setTimeout(()=>toast.classList.remove('show'), 3000); }

function emptyDashboard() {
  return { profile:{ calorieTarget:2300, proteinTarget:160, goalWeight:null }, dailyLogs:{}, meals:[], weights:[], fetchedAt:null, source:'empty' };
}

function normalizeLegacyState(s) {
  const out = emptyDashboard();
  if (!s || typeof s !== 'object') return out;
  out.profile = {
    calorieTarget: Number(s.profile?.calorieTarget ?? 2300),
    proteinTarget: Number(s.profile?.proteinTarget ?? 160),
    goalWeight: s.profile?.goalWeight == null ? null : Number(s.profile.goalWeight)
  };
  out.dailyLogs = {};
  Object.entries(s.dayLogs || s.dayStatus || {}).forEach(([date,d]) => {
    out.dailyLogs[date] = typeof d === 'object' ? {
      id:d.id || null, status:d.status || 'partial', calorieTarget:Number(d.calorieTarget ?? out.profile.calorieTarget), proteinTarget:Number(d.proteinTarget ?? out.profile.proteinTarget), notes:d.notes || ''
    } : { id:null, status:String(d || 'partial'), calorieTarget:out.profile.calorieTarget, proteinTarget:out.profile.proteinTarget, notes:'' };
  });
  out.meals = (s.meals || []).map(m => ({
    id:m.id, date:m.date || String(m.eatenAt || '').slice(0,10) || localDateKey(), type:m.type || m.mealType || 'Other', title:m.title || 'Meal',
    calories:Number(m.calories ?? sumMeals([{calories:(m.items||[]).reduce((a,i)=>a+Number(i.calories||0),0)}]).calories),
    protein:Number(m.protein ?? (m.items||[]).reduce((a,i)=>a+Number(i.protein||0),0)), caloriesLow:m.caloriesLow ?? null, caloriesHigh:m.caloriesHigh ?? null,
    confidence:m.confidence || 'medium', source:m.source || 'text_estimate', originalInput:m.originalInput || '', notes:m.notes || '', eatenAt:m.eatenAt || null, updatedAt:m.updatedAt || m.createdAt || null,
    items:(m.items||[]).map(i=>({ name:i.name || 'Food', quantity:i.quantity || '', calories:Number(i.calories||0), protein:Number(i.protein||0), confidence:i.confidence || m.confidence || 'medium', source:i.source || m.source || 'text_estimate', caloriesLow:i.caloriesLow ?? null, caloriesHigh:i.caloriesHigh ?? null }))
  }));
  out.weights = (s.weights || []).map(w => ({ id:w.id, date:w.date, weight:Number(w.weight), notes:w.notes || '', updatedAt:w.updatedAt || w.createdAt || null })).filter(w=>w.date && Number.isFinite(w.weight));
  out.fetchedAt = new Date().toISOString(); out.source = 'legacy-local';
  return out;
}

function loadCachedDashboard() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.meals && cached?.weights) return cached;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STATE_KEY) || 'null');
    if (legacy) {
      const converted = normalizeLegacyState(legacy);
      localStorage.setItem(CACHE_KEY, JSON.stringify(converted));
      return converted;
    }
  } catch (e) { console.warn('Dashboard cache load failed', e); }
  return emptyDashboard();
}

function saveDashboardCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(dashboard)); }
  catch (e) { console.warn('Dashboard cache save failed', e); }
}

// Diet Copilot is a single fixed product. The project URL/key are public client
// configuration, not user settings. Never ask users to paste them on a device.
function loadCloudConfig() {
  try { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(DIET_SUPABASE)); } catch {}
  return { ...DIET_SUPABASE };
}
function saveCloudConfig() {
  cloudConfig = { ...DIET_SUPABASE };
  try { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(DIET_SUPABASE)); } catch {}
}
function configured() { return true; }

function mealsFor(date) { return dashboard.meals.filter(m=>m.date===date).sort((a,b)=>String(a.eatenAt||a.updatedAt||'').localeCompare(String(b.eatenAt||b.updatedAt||''))); }
function totalsFor(date) { return sumMeals(mealsFor(date)); }
function dayLog(date) { return dashboard.dailyLogs[date] || { status:'partial', calorieTarget:dashboard.profile.calorieTarget, proteinTarget:dashboard.profile.proteinTarget, notes:'' }; }
function targetsFor(date) { const d = dayLog(date); return { calories:Number(d.calorieTarget ?? dashboard.profile.calorieTarget), protein:Number(d.proteinTarget ?? dashboard.profile.proteinTarget) }; }
function weightFor(date) { return dashboard.weights.find(w=>w.date===date); }
function latestWeight() { return [...dashboard.weights].sort((a,b)=>a.date.localeCompare(b.date)).at(-1) || null; }
function allDates() { return [...new Set([...Object.keys(dashboard.dailyLogs), ...dashboard.meals.map(m=>m.date), ...dashboard.weights.map(w=>w.date)])].filter(Boolean).sort(); }

function rangeStart(days) { if (!Number.isFinite(days)) return '0000-01-01'; return offsetDateKey(-(days-1)); }
function datesInRange(days) { const start = rangeStart(days); return allDates().filter(d=>d>=start); }
function completeDates(days) { return datesInRange(days).filter(d=>dayLog(d).status==='complete'); }

function sourceQuality(meal) {
  const exactSources = new Set(['manual_exact','nutrition_label','weighed']);
  if (exactSources.has(meal.source)) return 'exact';
  if (meal.confidence === 'high' && !['photo_estimate','restaurant_estimate','text_estimate','ai_adjusted'].includes(meal.source)) return 'exact';
  return 'estimated';
}

/* ===== src/core/dashboard-02.js ===== */
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

/* ===== src/ui/dashboard-p2.js ===== */
'use strict';

function p2MealClass(type='') {
  const t = String(type).trim().toLowerCase();
  if (t.includes('breakfast') || t.includes('frühstück')) return 'breakfast';
  if (t.includes('lunch') || t.includes('mittag')) return 'lunch';
  if (t.includes('dinner') || t.includes('abend')) return 'dinner';
  if (t.includes('snack')) return 'snack';
  if (t.includes('drink') || t.includes('getränk')) return 'drink';
  return 'other';
}

function p2SourceMeta(meal) {
  const source = String(meal.source || '').toLowerCase();
  if (source === 'nutrition_label') return { label:'Label value', cls:'exact' };
  if (source === 'weighed') return { label:'Weighed', cls:'exact' };
  if (source === 'manual_exact') return { label:'Exact', cls:'exact' };
  if (source === 'ai_adjusted') return { label:'Adjusted', cls:'adjusted' };
  if (source === 'photo_estimate' || source === 'restaurant_estimate' || source === 'text_estimate') return { label:'Estimated', cls:'estimated' };
  return sourceQuality(meal) === 'exact' ? { label:'Exact', cls:'exact' } : { label:'Estimated', cls:'estimated' };
}

function p2WeightSub(todayWeight, latest) {
  if (todayWeight) return 'Morning weigh-in';
  if (latest) return `Latest · ${prettyDate(latest.date,{day:'numeric',month:'short'})}`;
  return 'No weigh-ins yet';
}

function p2LoadingState() {
  return `<div class="today-loading" aria-label="Loading today's dashboard">
    <div class="skeleton hero-skeleton"></div>
    <div class="today-metrics"><div class="skeleton tile-skeleton"></div><div class="skeleton tile-skeleton"></div></div>
    <div class="skeleton" style="min-height:112px"></div>
  </div>`;
}

function p2SignedOutState() {
  return `<section class="today-state">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg></div>
    <h2>Sign in to Diet Copilot</h2>
    <p>Your meals, calories, protein and weigh-ins are synced to your account and available on every device.</p>
    <button class="btn primary" type="button" data-open-account>Sign in</button>
  </section>`;
}

function p2ErrorState(message) {
  return `<section class="today-state today-error">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg></div>
    <h2>Couldn't refresh your dashboard</h2>
    <p>${esc(message || 'Your saved data is safe. Try refreshing the connection.')}</p>
    <button class="btn primary" type="button" data-retry-dashboard>Try again</button>
  </section>`;
}

function p2EmptyMeals() {
  return `<div class="today-empty-meals">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H7l-3 3V5Z"/><path d="M8 9h8M8 12h5"/></svg></div>
    <h3>No meals yet today</h3>
    <p>Send a meal description or photo to ChatGPT. Once it is logged, it will appear here automatically.</p>
  </div>`;
}

renderToday = function renderTodayP2() {
  if (cloud.status === 'syncing' && dashboard.source === 'empty') {
    app.innerHTML = p2LoadingState();
    return;
  }

  if (!cloud.user && dashboard.source === 'empty') {
    app.innerHTML = p2SignedOutState();
    app.querySelector('[data-open-account]')?.addEventListener('click', openConnection);
    return;
  }

  if (cloud.status === 'error' && dashboard.source === 'empty') {
    app.innerHTML = p2ErrorState(cloud.error);
    app.querySelector('[data-retry-dashboard]')?.addEventListener('click', () => refreshData());
    return;
  }

  const date = localDateKey();
  const meals = mealsFor(date);
  const totals = totalsFor(date);
  const target = targetsFor(date);
  const remain = target.calories - totals.calories;
  const todayWeight = weightFor(date);
  const latest = latestWeight();
  const proteinPct = target.protein ? Math.max(0, Math.min(100, totals.protein / target.protein * 100)) : 0;
  const kcalPctRaw = target.calories ? totals.calories / target.calories * 100 : 0;
  const kcalPct = Math.max(0, Math.min(100, kcalPctRaw));
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
  const weightValue = todayWeight?.weight ?? latest?.weight ?? null;

  app.innerHTML = `<div class="today-v2">
    <section class="calorie-hero-v2 ${remain < 0 ? 'over' : ''}" aria-label="Today's calorie summary">
      <div class="calorie-hero-kicker"><span>Today's calories</span><span class="date-chip">${esc(dateLabel)}</span></div>
      <div class="calorie-value-row"><strong>${fmt(totals.calories)}</strong><span>kcal</span></div>
      <div class="calorie-target-copy">of ${fmt(target.calories)} kcal target</div>
      <div class="calorie-progress" role="progressbar" aria-label="Calories" aria-valuemin="0" aria-valuemax="${Math.max(1,target.calories)}" aria-valuenow="${Math.max(0,totals.calories)}"><span style="width:${kcalPct}%"></span></div>
      <div class="calorie-footer">
        <div class="calorie-remaining">${remain >= 0 ? `${fmt(remain)} kcal remaining` : `${fmt(Math.abs(remain))} kcal over target`}</div>
        <div class="calorie-percent">${target.calories ? `${Math.round(kcalPctRaw)}% of target` : ''}</div>
      </div>
    </section>

    <div class="today-metrics">
      <section class="today-metric protein" aria-label="Protein summary">
        <div class="metric-v2-head"><span class="metric-v2-title">Protein</span><span class="metric-v2-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9v6M18 9v6M3 10v4M21 10v4M6 12h12"/></svg></span></div>
        <div class="metric-v2-value">${fmt(totals.protein,1)} g</div>
        <div class="metric-v2-sub">of ${fmt(target.protein)} g · ${Math.round(proteinPct)}%</div>
        <div class="protein-track" role="progressbar" aria-label="Protein" aria-valuemin="0" aria-valuemax="${Math.max(1,target.protein)}" aria-valuenow="${Math.max(0,totals.protein)}"><span style="width:${proteinPct}%"></span></div>
      </section>

      <section class="today-metric weight" aria-label="Weight summary">
        <div class="metric-v2-head"><span class="metric-v2-title">Weight</span><span class="metric-v2-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0"/><path d="m12 10 1.8-2.2"/></svg></span></div>
        <div class="metric-v2-value">${weightValue == null ? '—' : `${fmt(weightValue,1)} kg`}</div>
        <div class="metric-v2-sub">${esc(p2WeightSub(todayWeight,latest))}</div>
      </section>
    </div>

    <section class="today-meals-section">
      <div class="today-meals-head"><div><h2>Today's meals</h2><p>${meals.length ? `${fmt(totals.calories)} kcal · ${fmt(totals.protein,1)} g protein` : 'Meals logged through ChatGPT'}</p></div>${meals.length ? `<span class="meal-count-chip">${meals.length} ${meals.length===1?'meal':'meals'}</span>` : ''}</div>
      <div class="meal-list-v2">${meals.length ? meals.map(mealCard).join('') : p2EmptyMeals()}</div>
    </section>
  </div>`;
};

mealCard = function mealCardP2(m) {
  const range = m.caloriesLow != null && m.caloriesHigh != null && Number(m.caloriesLow) !== Number(m.caloriesHigh) ? `${fmt(m.caloriesLow)}–${fmt(m.caloriesHigh)} kcal` : null;
  const sourceMeta = p2SourceMeta(m);
  const cls = p2MealClass(m.type);
  const time = m.eatenAt ? new Date(m.eatenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
  const items = Array.isArray(m.items) ? m.items : [];
  const rows = items.map(i => `<div class="meal-detail-row"><div class="meal-detail-main"><strong>${esc(i.name || 'Food')}</strong>${i.quantity ? `<small>${esc(i.quantity)}</small>` : ''}</div><div class="meal-detail-cal">${fmt(i.calories)} kcal</div></div>`).join('');
  const metaBits = [range ? `<span class="meal-estimate-range">Likely ${range}</span>` : '', m.notes ? esc(m.notes) : ''].filter(Boolean).join('<br>');

  return `<details class="meal-v2 ${cls}">
    <summary>
      <div class="meal-summary-main">
        <div class="meal-kicker"><span class="meal-dot" aria-hidden="true"></span><span class="meal-type-v2">${esc(m.type || 'Meal')}</span>${time ? `<span class="meal-time-v2">${esc(time)}</span>` : ''}</div>
        <div class="meal-name-v2">${esc(m.title || 'Meal')}</div>
        <div class="meal-meta-v2"><span class="meal-protein-v2">${fmt(m.protein,1)} g protein</span><span>·</span><span class="meal-source-v2 ${sourceMeta.cls}">${esc(sourceMeta.label)}</span></div>
      </div>
      <div class="meal-summary-side"><strong>${fmt(m.calories)}</strong><small>kcal</small><svg class="meal-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></div>
    </summary>
    <div class="meal-details-v2">
      ${rows || `<div class="meal-detail-row"><div class="meal-detail-main"><strong>No item breakdown</strong><small>Only the meal total was recorded.</small></div></div>`}
      ${metaBits ? `<div class="meal-details-meta"><strong>${sourceMeta.label}</strong><br>${metaBits}</div>` : ''}
    </div>
  </details>`;
};

/* ===== src/ui/dashboard-p2-session.js ===== */
'use strict';

// P2 privacy guard: never render a local nutrition snapshot until the browser
// session has been resolved and belongs to the signed-in Diet Copilot user.
const renderTodayP2Authed = renderToday;
renderToday = function renderTodayP2SessionGuard() {
  if (cloud.status === 'cache' || cloud.status === 'syncing' && dashboard.source === 'empty') {
    app.innerHTML = p2LoadingState();
    return;
  }
  if (!cloud.user) {
    app.innerHTML = p2SignedOutState();
    app.querySelector('[data-open-account]')?.addEventListener('click', openConnection);
    return;
  }
  return renderTodayP2Authed();
};

/* ===== src/ui/dashboard-p3.js ===== */
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

/* ===== src/core/dashboard-03.js ===== */
function updateStatus(){ let label='Cached', cls=''; if(cloud.status==='syncing'){label='Refreshing';cls='syncing'} else if(cloud.status==='error'){label='Error';cls='error'} else if(cloud.user){label='Live';cls='online'} else if(configured()){label='Sign in'} else if(dashboard.source==='empty'){label='Setup'} statusText.textContent=label; statusDot.className=`status-dot ${cls}`; }

async function disposeCloud(){ if(cloud.client && cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{}} try{cloud.authSubscription?.unsubscribe?.()}catch{} try{await cloud.client?.auth?.dispose?.()}catch{} cloud.channel=null;cloud.authSubscription=null;cloud.client=null;cloud.user=null; }
async function initCloud(showDialog=false){ cloud.error=null; if(!configured()){await disposeCloud();cloud.status='cache';updateStatus();if(showDialog)openConnection();return;} if(!window.supabase?.createClient){cloud.status='error';cloud.error='Supabase SDK failed to load';updateStatus();return;} try{await disposeCloud();cloud.client=window.supabase.createClient(cloudConfig.url,cloudConfig.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); const {data,error}=await cloud.client.auth.getSession(); if(error)throw error; cloud.user=data.session?.user||null; cloud.status=cloud.user?'online':'configured'; const {data:listener}=cloud.client.auth.onAuthStateChange((_event,session)=>{const before=cloud.user?.id;cloud.user=session?.user||null;cloud.status=cloud.user?'online':'configured';updateStatus();if(cloud.user&&cloud.user.id!==before){refreshData({silent:true});subscribeRealtime();}if(!cloud.user&&cloud.channel){cloud.client.removeChannel(cloud.channel).catch(()=>{});cloud.channel=null;}if(connectionDialog.open)renderConnection();}); cloud.authSubscription=listener?.subscription||null; if(cloud.user){await refreshData({silent:true});await subscribeRealtime();} updateStatus(); if(showDialog)openConnection(); }catch(e){cloud.status='error';cloud.error=e.message||String(e);updateStatus();if(showDialog)openConnection();} }

async function subscribeRealtime(){ if(!cloud.client||!cloud.user)return; if(cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{}} let ch=cloud.client.channel(`diet-dashboard-${cloud.user.id}`); ['profiles','daily_logs','meals','meal_items','weight_entries'].forEach(table=>{ch=ch.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshData({silent:true}),450);});}); cloud.channel=ch.subscribe(); }

async function refreshData({silent=false}={}){
  if(!cloud.client||!cloud.user){if(!silent)openConnection();return;}
  if(navigator.onLine===false){if(!silent)showToast('Offline — showing the last cached snapshot');return;}
  cloud.status='syncing';updateStatus();
  try{
    const [p,d,m,mi,w] = await Promise.all([
      cloud.client.from('profiles').select('calorie_target,protein_target,goal_weight,updated_at').maybeSingle(),
      cloud.client.from('daily_logs').select('id,log_date,calorie_target,protein_target,status,notes,updated_at').order('log_date'),
      cloud.client.from('meals').select('id,daily_log_id,meal_type,title,calories,protein,confidence,source,original_input,notes,calories_low,calories_high,eaten_at,created_at,updated_at').order('eaten_at'),
      cloud.client.from('meal_items').select('id,meal_id,name,quantity_text,calories,protein,calories_low,calories_high,confidence,source,sort_order,updated_at').order('sort_order'),
      cloud.client.from('weight_entries').select('id,entry_date,weight,notes,created_at,updated_at').order('entry_date')
    ]);
    for(const r of [p,d,m,mi,w]) if(r.error) throw r.error;
    const dailyLogs={}, dateById={}, itemsByMeal={};
    (d.data||[]).forEach(x=>{dailyLogs[x.log_date]={id:x.id,status:x.status,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),notes:x.notes||'',updatedAt:x.updated_at};dateById[x.id]=x.log_date;});
    (mi.data||[]).forEach(x=>{(itemsByMeal[x.meal_id] ||= []).push({id:x.id,name:x.name,quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),caloriesLow:x.calories_low,caloriesHigh:x.calories_high,confidence:x.confidence,source:x.source,updatedAt:x.updated_at});});
    dashboard={profile:{calorieTarget:Number(p.data?.calorie_target??2300),proteinTarget:Number(p.data?.protein_target??160),goalWeight:p.data?.goal_weight==null?null:Number(p.data.goal_weight)},dailyLogs,meals:(m.data||[]).map(x=>({id:x.id,date:dateById[x.daily_log_id]||String(x.eaten_at||'').slice(0,10),type:x.meal_type||'Other',title:x.title||'Meal',calories:Number(x.calories||0),protein:Number(x.protein||0),confidence:x.confidence||'medium',source:x.source||'text_estimate',originalInput:x.original_input||'',notes:x.notes||'',caloriesLow:x.calories_low,caloriesHigh:x.calories_high,eatenAt:x.eaten_at,updatedAt:x.updated_at,items:itemsByMeal[x.id]||[] })),weights:(w.data||[]).map(x=>({id:x.id,date:x.entry_date,weight:Number(x.weight),notes:x.notes||'',updatedAt:x.updated_at||x.created_at})),fetchedAt:new Date().toISOString(),source:'cloud'};
    saveDashboardCache(); cloud.status='online'; cloud.error=null;
    try{const {data:health,error:he}=await cloud.client.rpc('diet_copilot_healthcheck');if(!he&&health){cloud.bridgeReady=Boolean(health.capabilities?.log_meal_from_ai&&health.capabilities?.log_weight_from_ai);cloud.schemaVersion=health.schema_version;}}catch{}
    render(); if(!silent)showToast('Dashboard refreshed');
  }catch(e){cloud.status='error';cloud.error=e.message||String(e);updateStatus();if(!silent)showToast(`Refresh failed: ${cloud.error}`);if(connectionDialog.open)renderConnection();}
}

function openConnection(){renderConnection();connectionDialog.showModal();}
function renderConnection(){
  const email=cloud.user?.email||'';
  if(cloud.user){
    connectionContent.innerHTML=`<div class="connection-state"><strong>THIEPN Account</strong><span>Signed in as ${esc(email)}. Diet Copilot data stays private to this account.</span></div><div class="btn-row"><button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button><button class="btn ghost" id="signOutBtn" type="button">Sign out</button></div>`;
    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click',()=>refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click',async()=>{await cloud.client.auth.signOut({scope:'local'});cloud.user=null;cloud.status='configured';dashboard=emptyDashboard();try{localStorage.removeItem(CACHE_KEY)}catch{}renderConnection();render();});
    return;
  }
  connectionContent.innerHTML=`<div class="connection-state"><strong>Sign in with THIEPN Account</strong><span>Continue with your Google account to sync Diet Copilot.</span>${cloud.error?`<br><span style="color:var(--danger)">${esc(cloud.error)}</span>`:''}</div><div class="btn-row"><button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button></div>`;
  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent='Redirecting…';cloud.error=null;
    try{
      if(typeof dietSignInWithGoogle==='function')await dietSignInWithGoogle();
      else {const {error}=await cloud.client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${location.origin}${location.pathname}`,queryParams:{prompt:'select_account'}}});if(error)throw error;}
    }catch(error){cloud.error=error?.message||String(error);renderConnection();}
  });
}

function updateDateRefresh(){ if(cloud.user) refreshData({silent:true}); }

/* ===== src/auth/dashboard-auth-persist.js ===== */
'use strict';

// A6 final THIEPN Account bootstrap for Diet Copilot.
// Supabase's project-scoped browser key is the single persisted auth authority
// shared by first-party THIEPN apps on thiepn.dev. Diet Copilot must not keep a
// second access/refresh-token copy in app-specific storage.
const DIET_AUTH_STORAGE_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
const LEGACY_DIET_AUTH_BACKUP_KEY = 'diet-copilot-thiepn-auth-token-backup-v2';
const LEGACY_DIET_AUTH_DB = 'diet-copilot-auth-vault';

function cleanupLegacyDietAuthArtifacts() {
  // Targeted cleanup only. Never clear all localStorage because Diet Copilot
  // keeps legitimate user/application state alongside auth metadata.
  try { localStorage.removeItem(LEGACY_DIET_AUTH_BACKUP_KEY); } catch {}
  try {
    if ('indexedDB' in window) indexedDB.deleteDatabase(LEGACY_DIET_AUTH_DB);
  } catch {}
}

function applyCloudSession(session) {
  cloud.user = session?.user || null;
  cloud.status = cloud.user ? 'online' : 'configured';
  updateStatus();
  if (connectionDialog.open) renderConnection();
}

cleanupLegacyDietAuthArtifacts();

initCloud = async function initCloudFinal(showDialog = false) {
  cloud.error = null;

  if (!configured()) {
    await disposeCloud();
    cloud.status = 'cache';
    updateStatus();
    if (showDialog) openConnection();
    return;
  }

  if (!window.supabase?.createClient) {
    cloud.status = 'error';
    cloud.error = 'Supabase SDK failed to load';
    updateStatus();
    return;
  }

  try {
    if (cloud.client) await disposeCloud();

    cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: DIET_AUTH_STORAGE_KEY
      }
    });

    const { data: stored, error: storedError } = await cloud.client.auth.getSession();
    if (storedError) throw storedError;
    applyCloudSession(stored.session || null);

    const { data: listener } = cloud.client.auth.onAuthStateChange((event, nextSession) => {
      const before = cloud.user?.id || null;
      applyCloudSession(nextSession);

      if (event === 'SIGNED_IN' && cloud.user && cloud.user.id !== before) {
        queueMicrotask(() => {
          refreshData({ silent: true });
          subscribeRealtime();
        });
      }

      if (event === 'SIGNED_OUT' && cloud.channel) {
        cloud.client.removeChannel(cloud.channel).catch(() => {});
        cloud.channel = null;
      }
    });
    cloud.authSubscription = listener?.subscription || null;

    if (cloud.user) {
      await refreshData({ silent: true });
      await subscribeRealtime();
    }

    updateStatus();
    if (showDialog) openConnection();
  } catch (error) {
    cloud.status = 'error';
    cloud.error = error?.message || String(error);
    updateStatus();
    if (showDialog) openConnection();
  }
};

/* ===== src/auth/dashboard-auth.js ===== */
'use strict';

// Diet Copilot uses THIEPN Account, the shared Supabase identity used by other
// first-party THIEPN apps. Diet Copilot intentionally exposes Google sign-in
// only; password/account-management flows are not part of this product.
const DIET_AUTH_RELAY = 'https://thiepn.dev/WORDSTRIKE/';
const DIET_OAUTH_TARGET_KEY = 'diet-copilot:oauth-target-v2';
const DIET_OAUTH_FLOW_KEY = 'diet-copilot:oauth-flow-v2';

function dietClearBrowserOAuthRelayState() {
  try {
    sessionStorage.removeItem(DIET_OAUTH_TARGET_KEY);
    sessionStorage.removeItem(DIET_OAUTH_FLOW_KEY);
  } catch {}
}

function dietSetBrowserOAuthRelayState(target, flowId) {
  try {
    sessionStorage.setItem(DIET_OAUTH_TARGET_KEY, target);
    if (flowId) sessionStorage.setItem(DIET_OAUTH_FLOW_KEY, flowId);
    else sessionStorage.removeItem(DIET_OAUTH_FLOW_KEY);
  } catch {}
}

async function dietSignInWithGoogle() {
  if (typeof dietIsNativeAndroid === 'function' && dietIsNativeAndroid() && window.DietNative?.startGoogleOAuth) {
    return window.DietNative.startGoogleOAuth();
  }

  dietClearBrowserOAuthRelayState();
  const { data, error } = await cloud.client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: DIET_AUTH_RELAY,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google sign-in URL was not created.');

  // The callback is hosted on the same thiepn.dev origin as Diet Copilot.
  // Mark this browsing context as the web client and preserve Supabase's exact
  // PKCE flow id so the returned authorization code is exchanged against the
  // same verifier that created it.
  dietSetBrowserOAuthRelayState('web', data.flowId || '');
  location.assign(data.url);
}

renderConnection = function renderDietConnection() {
  const email = cloud.user?.email || '';

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="connection-state">
        <strong>THIEPN Account</strong>
        <span>Signed in as ${esc(email)}. Diet Copilot data stays private to this account.</span>
      </div>
      <div class="btn-row">
        <button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>`;

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', () => refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut({ scope: 'local' });
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      dietClearBrowserOAuthRelayState();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      renderConnection();
      render();
    });
    return;
  }

  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>Sign in with THIEPN Account</strong>
      <span>Continue with your Google account to sync Diet Copilot.</span>
    </div>
    ${cloud.error ? `<div class="connection-state"><span style="color:var(--danger)">${esc(cloud.error)}</span></div>` : ''}
    <div class="btn-row">
      <button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button>
    </div>`;

  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Redirecting…';
    cloud.error = null;
    try {
      await dietSignInWithGoogle();
    } catch (error) {
      cloud.error = error?.message || String(error);
      dietClearBrowserOAuthRelayState();
      renderConnection();
    }
  });
};

/* ===== src/ui/dashboard-p4.js ===== */
'use strict';

function p4WeekSnapshotMarkup() {
  const complete = completeDates(7);
  const avgCalories = complete.length ? average(complete.map(d=>totalsFor(d).calories)) : null;
  const avgProtein = complete.length ? average(complete.map(d=>totalsFor(d).protein)) : null;
  const weights = dashboard.weights.filter(w=>w.date>=rangeStart(7)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightChange = weights.length > 1 ? Number(weights.at(-1).weight)-Number(weights[0].weight) : null;
  const latest = latestWeight();
  return `<aside class="p4-week-card" aria-label="Seven day snapshot">
    <div class="p4-week-card-head"><div><strong>7-day snapshot</strong><span>Complete days only for intake averages</span></div></div>
    <div class="p4-week-grid">
      <div class="p4-week-stat calories"><span>Avg calories</span><strong>${avgCalories==null?'—':`${fmt(avgCalories)} kcal`}</strong></div>
      <div class="p4-week-stat protein"><span>Avg protein</span><strong>${avgProtein==null?'—':`${fmt(avgProtein,1)} g`}</strong></div>
      <div class="p4-week-stat weight"><span>Weight change</span><strong>${weightChange==null?(latest?`${fmt(latest.weight,1)} kg`:'—'):`${weightChange>0?'+':''}${fmt(weightChange,1)} kg`}</strong></div>
      <div class="p4-week-stat complete"><span>Complete days</span><strong>${complete.length}/7</strong></div>
    </div>
    <div class="p4-week-note">This summary uses your recorded Diet Copilot history and does not treat incomplete days as low-calorie days.</div>
  </aside>`;
}

function p4TodayHeaderMarkup() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  return `<div class="p4-desktop-today-head"><div><h2>Today</h2><p>Your current nutrition and weight overview.</p></div><div class="p4-desktop-date">${esc(date)}</div></div>`;
}

const p4RenderTodayBase = renderToday;
renderToday = function renderTodayP4() {
  const result = p4RenderTodayBase();
  const root = app.querySelector('.today-v2');
  if (root) {
    if (!root.querySelector('.p4-desktop-today-head')) root.insertAdjacentHTML('afterbegin',p4TodayHeaderMarkup());
    if (!root.querySelector('.p4-week-card')) root.insertAdjacentHTML('beforeend',p4WeekSnapshotMarkup());
  }
  return result;
};

function p4SyncDesktopAccount() {
  const label = document.getElementById('desktopAccountState');
  if (!label) return;
  if (cloud?.user?.email) {
    label.textContent = cloud.user.email;
    return;
  }
  const status = String(document.getElementById('statusText')?.textContent || '').toLowerCase();
  if (status.includes('error')) label.textContent = 'Needs attention';
  else if (status.includes('refresh')) label.textContent = 'Syncing…';
  else label.textContent = 'Sign in';
}

const p4UpdateStatusBase = updateStatus;
updateStatus = function updateStatusP4() {
  p4UpdateStatusBase();
  p4SyncDesktopAccount();
};

document.querySelector('.desktop-account[data-open-account]')?.addEventListener('click',openConnection);
p4SyncDesktopAccount();

/* ===== src/ui/dashboard-p5.js ===== */
'use strict';

function p5FriendlyError(error) {
  const raw = String(error || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return 'Something went wrong while updating Diet Copilot. Please try again.';
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials') || lower.includes('oauth')) return 'Google sign-in could not be completed. Try again.';
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) return 'Diet Copilot could not reach the server. Check your internet connection and try again.';
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('session')) return 'Your session needs to be refreshed. Sign in again to continue.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Wait a moment and try again.';
  return 'Diet Copilot could not complete that request. Please try again.';
}

function p5FormatSyncTime(value) {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not synced yet';
  const diff = Date.now() - date.getTime();
  if (diff < 45000) return 'Just now';
  if (diff < 3600000) return `${Math.max(1,Math.round(diff/60000))} min ago`;
  if (diff < 86400000) return date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return date.toLocaleDateString(undefined,{day:'numeric',month:'short'});
}

function p5EnsureSystemNotice() {
  let notice = document.getElementById('systemNotice');
  if (notice) return notice;
  notice = document.createElement('div');
  notice.id = 'systemNotice';
  notice.className = 'system-notice';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  notice.hidden = true;
  document.body.appendChild(notice);
  return notice;
}

function p5RenderSystemNotice() {
  const notice = p5EnsureSystemNotice();
  if (!cloud.user) {
    notice.hidden = true;
    notice.innerHTML = '';
    return;
  }

  if (navigator.onLine === false) {
    notice.className = 'system-notice offline';
    notice.innerHTML = `<span class="system-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5 12.4a10 10 0 0 1 14 0"/><path d="M8.7 16a5 5 0 0 1 6.6 0"/><path d="M12 20h.01"/><path d="m3 3 18 18"/></svg></span><span><strong>Offline</strong><small>Showing your last synced data · ${esc(p5FormatSyncTime(dashboard.fetchedAt))}</small></span>`;
    notice.hidden = false;
    return;
  }

  if (cloud.status === 'error') {
    notice.className = 'system-notice error';
    notice.innerHTML = `<span class="system-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg></span><span><strong>Sync issue</strong><small>${esc(p5FriendlyError(cloud.error))}</small></span><button type="button" data-p5-retry>Retry</button>`;
    notice.hidden = false;
    notice.querySelector('[data-p5-retry]')?.addEventListener('click',()=>refreshData());
    return;
  }

  if (cloud.status === 'syncing') {
    notice.className = 'system-notice syncing';
    notice.innerHTML = `<span class="system-notice-spinner" aria-hidden="true"></span><span><strong>Syncing</strong><small>Updating your latest Diet Copilot data…</small></span>`;
    notice.hidden = false;
    return;
  }

  notice.hidden = true;
  notice.innerHTML = '';
}

function p5AccountIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`;
}

function p5SyncIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.4 6.4L20 8"/><path d="M17.9 15A7 7 0 0 1 5.6 17.6L4 16"/></svg>`;
}

renderConnection = function renderConnectionP5() {
  const email = cloud.user?.email || '';
  const online = navigator.onLine !== false;
  const syncText = p5FormatSyncTime(dashboard.fetchedAt);

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="p5-account-profile">
        <div class="p5-account-avatar" aria-hidden="true">${p5AccountIcon()}</div>
        <div class="p5-account-identity"><span>Signed in</span><strong title="${esc(email)}">${esc(email)}</strong><small>Your nutrition history is available on every device where you use this account.</small></div>
      </div>
      <div class="p5-account-status" aria-label="Account sync status">
        <div><span>Connection</span><strong class="${online?'good':'warn'}">${online?'Online':'Offline'}</strong></div>
        <div><span>Last synced</span><strong>${esc(syncText)}</strong></div>
      </div>
      ${cloud.status==='error' ? `<div class="p5-inline-alert" role="alert">${esc(p5FriendlyError(cloud.error))}</div>` : ''}
      <div class="p5-account-actions">
        <button class="btn primary p5-refresh-btn" id="refreshNowBtn" type="button">${p5SyncIcon()}<span>Refresh data</span></button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>
      <p class="p5-account-footnote">Meals and weigh-ins are logged through ChatGPT. This dashboard only displays your history.</p>`;

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.classList.add('is-busy');
      await refreshData({silent:true});
      renderConnection();
      render();
    });
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut({ scope: 'local' });
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      if (connectionDialog.open) connectionDialog.close();
      render();
      p5RenderSystemNotice();
      showToast('Signed out');
    });
    return;
  }

  connectionContent.innerHTML = `
    <div class="p5-login-intro">
      <div class="p5-login-icon" aria-hidden="true">${p5AccountIcon()}</div>
      <h3>Welcome back</h3>
      <p>Continue with your Google account to sync your Diet Copilot history on this device.</p>
    </div>
    ${cloud.error ? `<div class="p5-inline-alert" role="alert">${esc(p5FriendlyError(cloud.error))}</div>` : ''}
    <button class="btn primary p5-signin-btn" id="googleSignInBtn" type="button">Continue with Google</button>
    <p class="p5-login-footnote">Diet Copilot uses Google sign-in only.</p>`;

  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Redirecting…';
    cloud.error = null;
    try {
      await dietSignInWithGoogle();
    } catch (error) {
      cloud.error = error?.message || String(error);
      renderConnection();
    }
  });
};

p2ErrorState = function p2ErrorStateP5(message) {
  return `<section class="today-state today-error">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg></div>
    <h2>Couldn't update Diet Copilot</h2>
    <p>${esc(p5FriendlyError(message))}</p>
    <button class="btn primary" type="button" data-retry-dashboard>Try again</button>
  </section>`;
};

const p5UpdateStatusBase = updateStatus;
updateStatus = function updateStatusP5() {
  p5UpdateStatusBase();
  p5RenderSystemNotice();
};

const p5RenderBase = render;
render = function renderP5() {
  const result = p5RenderBase();
  p5RenderSystemNotice();
  document.querySelectorAll('.meal-v2 summary').forEach(summary => {
    const details = summary.parentElement;
    summary.setAttribute('aria-label', `${details?.querySelector('.meal-type-v2')?.textContent || 'Meal'} details`);
  });
  return result;
};

function p5OpenDialogFocus() {
  requestAnimationFrame(()=>{
    const target = connectionDialog.querySelector('input[autofocus],input,button:not(#closeConnectionBtn)');
    target?.focus({preventScroll:true});
  });
}

const p5OpenConnectionBase = openConnection;
openConnection = function openConnectionP5() {
  p5OpenConnectionBase();
  p5OpenDialogFocus();
};

connectionDialog.addEventListener('click', event => {
  if (event.target === connectionDialog) connectionDialog.close();
});

window.addEventListener('online',()=>{
  p5RenderSystemNotice();
  if (cloud.user) showToast('Back online · syncing');
});
window.addEventListener('offline',()=>{
  p5RenderSystemNotice();
  if (cloud.user) showToast('Offline · showing saved data');
});

p5EnsureSystemNotice();
p5RenderSystemNotice();

/* ===== src/ui/dashboard-p6.js ===== */
'use strict';

// Final release hardening. This layer fixes issues found during the V4 audit
// without changing Diet Copilot's data model or Supabase behavior.

p2WeightSub = function p2WeightSubP6(todayWeight, latest) {
  if (todayWeight) return String(todayWeight.notes || '').trim() || 'Today';
  if (latest) return `Latest · ${prettyDate(latest.date,{day:'numeric',month:'short'})}`;
  return 'No weigh-ins yet';
};

function p6ChartLabel(date, value, unit) {
  return `${prettyDate(date,{day:'numeric',month:'short'})}: ${fmt(value,unit==='kg'||unit==='g'?1:0)} ${unit}`;
}

p3WeightChart = function p3WeightChartP6(weights, moving) {
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
    ${raw.map(p=>{ const label=p6ChartLabel(p.date,p.value,'kg'); return `<circle class="p3-weight-point p6-chart-hit" cx="${p.x}" cy="${p.y}" r="4" tabindex="0" role="img" aria-label="${esc(label)}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></circle>`; }).join('')}
    <text class="p3-axis-label" x="${left}" y="16">${fmt(max,1)} kg</text>
    <text class="p3-axis-label" x="${left}" y="${height-bottom-6}">${fmt(min,1)} kg</text>
    <text class="p3-axis-date" x="${left}" y="${height-8}" text-anchor="start">${prettyDate(weights[0].date,{day:'numeric',month:'short'})}</text>
    <text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(weights.at(-1).date,{day:'numeric',month:'short'})}</text>
  </svg></div>`;
};

p3BarChart = function p3BarChartP6(metric, dates) {
  if (!dates.length) return `<div class="p3-chart-empty"><strong>No ${esc(metric)} data yet</strong><span>Logged days will appear here as your history grows.</span></div>`;
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
  // Long all-time ranges must shrink rather than overlap one another.
  const barWidth = Math.max(1.5,Math.min(30,step*.58));
  const yFor = value => top + (1-(Number(value)||0)/max)*(height-top-bottom);
  const targetPath = points.map((p,i)=>`${i?'L':'M'} ${(left+step*i+step/2).toFixed(1)} ${yFor(p.target).toFixed(1)}`).join(' ');
  const unit = isCalories ? 'kcal' : 'g';
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-bar-chart ${metric}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${isCalories?'Calorie':'Protein'} trend chart">
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/>
    <line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>
    ${points.map((p,i)=>{ const x=left+step*i+(step-barWidth)/2; const y=yFor(p.value); const h=Math.max(1,height-bottom-y); const label=p6ChartLabel(p.date,p.value,unit); return `<rect class="p3-bar ${p.complete?'complete':'partial'} p6-chart-hit" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6,barWidth/2).toFixed(1)}" tabindex="0" role="img" aria-label="${esc(label)}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></rect>`; }).join('')}
    <path class="p3-target-line" d="${targetPath}"/>
    <text class="p3-axis-label" x="${left}" y="16">${fmt(max,isCalories?0:1)} ${unit}</text>
    <text class="p3-axis-date" x="${left}" y="${height-8}" text-anchor="start">${prettyDate(points[0].date,{day:'numeric',month:'short'})}</text>
    <text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(points.at(-1).date,{day:'numeric',month:'short'})}</text>
  </svg><div class="p3-chart-legend"><span><i class="p3-legend-bar"></i>Recorded</span><span><i class="p3-legend-line"></i>Target</span></div></div>`;
};

function p6EnsureChartTooltip() {
  let tip = document.getElementById('chartTooltip');
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = 'chartTooltip';
  tip.className = 'p6-chart-tooltip';
  tip.setAttribute('role','status');
  tip.hidden = true;
  document.body.appendChild(tip);
  return tip;
}

function p6ShowChartTooltip(target) {
  const label = target?.dataset?.chartLabel;
  if (!label) return;
  const tip = p6EnsureChartTooltip();
  tip.textContent = label;
  tip.hidden = false;
  requestAnimationFrame(()=>{
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth-tipRect.width-10,Math.max(10,rect.left+rect.width/2-tipRect.width/2));
    const top = Math.max(10,rect.top-tipRect.height-9);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
}

function p6HideChartTooltip() {
  const tip = document.getElementById('chartTooltip');
  if (tip) tip.hidden = true;
}

document.addEventListener('click',event=>{
  const hit = event.target.closest?.('.p6-chart-hit');
  if (hit) p6ShowChartTooltip(hit);
  else if (!event.target.closest?.('#chartTooltip')) p6HideChartTooltip();
});
document.addEventListener('focusin',event=>{ if (event.target.matches?.('.p6-chart-hit')) p6ShowChartTooltip(event.target); });
document.addEventListener('focusout',event=>{ if (event.target.matches?.('.p6-chart-hit')) p6HideChartTooltip(); });

// Make account opening idempotent and ensure the Supabase client exists even if
// a user clicks immediately after first paint.
openConnection = async function openConnectionP6() {
  if (!cloud.client && configured()) {
    try { await initCloud(false); } catch {}
  }
  renderConnection();
  if (!connectionDialog.open) connectionDialog.showModal();
  if (typeof p5OpenDialogFocus === 'function') p5OpenDialogFocus();
};

// P4 bound the original account handler before P5/P6 existed. Replace the
// desktop button once to remove that stale listener and use the final handler.
const p6DesktopAccountOld = document.querySelector('.desktop-account[data-open-account]');
if (p6DesktopAccountOld) {
  const replacement = p6DesktopAccountOld.cloneNode(true);
  p6DesktopAccountOld.replaceWith(replacement);
  replacement.addEventListener('click',openConnection);
}

const p6RenderBase = render;
render = function renderP6() {
  const result = p6RenderBase();
  p6HideChartTooltip();
  return result;
};

p6EnsureChartTooltip();

/* ===== src/ui/dashboard-v5.js ===== */
'use strict';

function v5EnsureDashboardShape() {
  dashboard.savedFoods ||= [];
  dashboard.savedMeals ||= [];
  dashboard.goalPhases ||= [];
  dashboard.recommendations ||= [];
  dashboard.weeklyReviews ||= [];
  dashboard.profile ||= {};
  if (dashboard.profile.fiberTarget == null) dashboard.profile.fiberTarget = 30;
  if (dashboard.profile.showOptionalMacros == null) dashboard.profile.showOptionalMacros = false;
  if (dashboard.profile.showMealPhotos == null) dashboard.profile.showMealPhotos = true;
}

v5EnsureDashboardShape();

function v5SafePhotoUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value, location.href);
    return ['http:','https:'].includes(u.protocol) ? u.href : null;
  } catch { return null; }
}

function v5MacroForDate(date, key) {
  const meals = mealsFor(date);
  let value = 0, known = 0, unknown = 0;
  for (const meal of meals) {
    if (meal[key] == null || Number.isNaN(Number(meal[key]))) unknown++;
    else { value += Number(meal[key]); known++; }
  }
  return { value, known, unknown, hasAny: known > 0, complete: meals.length > 0 && unknown === 0 };
}

function v5CurrentPhase() {
  return (dashboard.goalPhases || []).find(p => p.active) || null;
}

function v5LatestRecommendation() {
  return [...(dashboard.recommendations || [])].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0] || null;
}

function v5ReminderSummary() {
  const p = dashboard.profile || {};
  const enabled = [];
  if (p.weighInReminderEnabled) enabled.push(`Weigh-in${p.weighInReminderTime ? ` ${String(p.weighInReminderTime).slice(0,5)}` : ''}`);
  if (p.dayCloseReminderEnabled) enabled.push(`Close day${p.dayCloseReminderTime ? ` ${String(p.dayCloseReminderTime).slice(0,5)}` : ''}`);
  if (p.weeklyReviewReminderEnabled) enabled.push('Weekly review');
  return enabled.length ? enabled.join(' · ') : 'Off';
}

refreshData = async function refreshDataV5({silent=false}={}) {
  if(!cloud.client||!cloud.user){if(!silent)openConnection();return;}
  if(navigator.onLine===false){if(!silent)showToast('Offline — showing the last cached snapshot');return;}
  cloud.status='syncing'; updateStatus();
  try {
    const [p,d,m,mi,w,sf,sm,gp,tr,wr] = await Promise.all([
      cloud.client.from('profiles').select('calorie_target,protein_target,fiber_target,goal_weight,desired_weekly_weight_change,adaptive_target_enabled,adaptive_min_complete_days,show_optional_macros,show_meal_photos,weigh_in_reminder_enabled,weigh_in_reminder_time,day_close_reminder_enabled,day_close_reminder_time,weekly_review_reminder_enabled,weekly_review_day,weekly_review_time,reminder_timezone,updated_at').maybeSingle(),
      cloud.client.from('daily_logs').select('id,log_date,calorie_target,protein_target,status,notes,updated_at').order('log_date'),
      cloud.client.from('meals').select('id,daily_log_id,meal_type,title,calories,protein,carbs,fat,fiber,confidence,source,original_input,notes,calories_low,calories_high,photo_url,photo_alt,eaten_at,created_at,updated_at').order('eaten_at'),
      cloud.client.from('meal_items').select('id,meal_id,saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber,calories_low,calories_high,confidence,source,sort_order,updated_at').order('sort_order'),
      cloud.client.from('weight_entries').select('id,entry_date,weight,notes,created_at,updated_at').order('entry_date'),
      cloud.client.from('saved_foods').select('id,name,brand,barcode,quantity_text,calories,protein,carbs,fat,fiber,aliases,source,confidence,favorite,use_count,last_used_at,photo_url,verified_at,updated_at').order('use_count',{ascending:false}).limit(100),
      cloud.client.from('saved_meals').select('id,name,meal_type,calories,protein,carbs,fat,fiber,aliases,favorite,use_count,last_used_at,photo_url,updated_at').order('use_count',{ascending:false}).limit(50),
      cloud.client.from('goal_phases').select('id,phase_type,name,start_date,end_date,calorie_target,protein_target,fiber_target,goal_weight,desired_weekly_weight_change,active,notes,created_at,updated_at').order('start_date',{ascending:false}),
      cloud.client.from('target_recommendations').select('id,generated_on,lookback_days,complete_days,weigh_in_count,avg_calories,weekly_weight_change,estimated_maintenance,desired_weekly_weight_change,current_target,raw_recommended_target,recommended_target,rationale,status,created_at,resolved_at').order('created_at',{ascending:false}).limit(20),
      cloud.client.from('weekly_reviews').select('id,week_end,payload,created_at').order('week_end',{ascending:false}).limit(20)
    ]);
    for(const r of [p,d,m,mi,w,sf,sm,gp,tr,wr]) if(r.error) throw r.error;

    const dailyLogs={}, dateById={}, itemsByMeal={};
    (d.data||[]).forEach(x=>{
      dailyLogs[x.log_date]={id:x.id,status:x.status,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),notes:x.notes||'',updatedAt:x.updated_at};
      dateById[x.id]=x.log_date;
    });
    (mi.data||[]).forEach(x=>{
      (itemsByMeal[x.meal_id] ||= []).push({
        id:x.id,savedFoodId:x.saved_food_id,name:x.name,quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),
        carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),
        caloriesLow:x.calories_low,caloriesHigh:x.calories_high,confidence:x.confidence,source:x.source,updatedAt:x.updated_at
      });
    });

    dashboard={
      profile:{
        calorieTarget:Number(p.data?.calorie_target??2300),proteinTarget:Number(p.data?.protein_target??160),fiberTarget:Number(p.data?.fiber_target??30),
        goalWeight:p.data?.goal_weight==null?null:Number(p.data.goal_weight),desiredWeeklyWeightChange:p.data?.desired_weekly_weight_change==null?null:Number(p.data.desired_weekly_weight_change),
        adaptiveTargetEnabled:p.data?.adaptive_target_enabled!==false,adaptiveMinCompleteDays:Number(p.data?.adaptive_min_complete_days??14),
        showOptionalMacros:Boolean(p.data?.show_optional_macros),showMealPhotos:p.data?.show_meal_photos!==false,
        weighInReminderEnabled:Boolean(p.data?.weigh_in_reminder_enabled),weighInReminderTime:p.data?.weigh_in_reminder_time||null,
        dayCloseReminderEnabled:Boolean(p.data?.day_close_reminder_enabled),dayCloseReminderTime:p.data?.day_close_reminder_time||null,
        weeklyReviewReminderEnabled:Boolean(p.data?.weekly_review_reminder_enabled),weeklyReviewDay:p.data?.weekly_review_day,weeklyReviewTime:p.data?.weekly_review_time||null,
        reminderTimezone:p.data?.reminder_timezone||null
      },
      dailyLogs,
      meals:(m.data||[]).map(x=>({
        id:x.id,date:dateById[x.daily_log_id]||String(x.eaten_at||'').slice(0,10),type:x.meal_type||'Other',title:x.title||'Meal',calories:Number(x.calories||0),protein:Number(x.protein||0),
        carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),
        confidence:x.confidence||'medium',source:x.source||'text_estimate',originalInput:x.original_input||'',notes:x.notes||'',caloriesLow:x.calories_low,caloriesHigh:x.calories_high,
        photoUrl:x.photo_url||null,photoAlt:x.photo_alt||'',eatenAt:x.eaten_at,updatedAt:x.updated_at,items:itemsByMeal[x.id]||[]
      })),
      weights:(w.data||[]).map(x=>({id:x.id,date:x.entry_date,weight:Number(x.weight),notes:x.notes||'',updatedAt:x.updated_at||x.created_at})),
      savedFoods:(sf.data||[]).map(x=>({id:x.id,name:x.name,brand:x.brand||'',barcode:x.barcode||'',quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],source:x.source,confidence:x.confidence,favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,verifiedAt:x.verified_at,updatedAt:x.updated_at})),
      savedMeals:(sm.data||[]).map(x=>({id:x.id,name:x.name,mealType:x.meal_type,calories:x.calories==null?null:Number(x.calories),protein:x.protein==null?null:Number(x.protein),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,updatedAt:x.updated_at})),
      goalPhases:(gp.data||[]).map(x=>({id:x.id,phaseType:x.phase_type,name:x.name,startDate:x.start_date,endDate:x.end_date,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),fiberTarget:Number(x.fiber_target),goalWeight:x.goal_weight==null?null:Number(x.goal_weight),desiredWeeklyWeightChange:x.desired_weekly_weight_change==null?null:Number(x.desired_weekly_weight_change),active:Boolean(x.active),notes:x.notes||'',createdAt:x.created_at,updatedAt:x.updated_at})),
      recommendations:(tr.data||[]).map(x=>({id:x.id,generatedOn:x.generated_on,lookbackDays:Number(x.lookback_days),completeDays:Number(x.complete_days),weighInCount:Number(x.weigh_in_count),avgCalories:x.avg_calories==null?null:Number(x.avg_calories),weeklyWeightChange:x.weekly_weight_change==null?null:Number(x.weekly_weight_change),estimatedMaintenance:x.estimated_maintenance==null?null:Number(x.estimated_maintenance),desiredWeeklyWeightChange:x.desired_weekly_weight_change==null?null:Number(x.desired_weekly_weight_change),currentTarget:Number(x.current_target),rawRecommendedTarget:x.raw_recommended_target==null?null:Number(x.raw_recommended_target),recommendedTarget:x.recommended_target==null?null:Number(x.recommended_target),rationale:x.rationale||'',status:x.status,createdAt:x.created_at,resolvedAt:x.resolved_at})),
      weeklyReviews:(wr.data||[]).map(x=>({id:x.id,weekEnd:x.week_end,payload:x.payload||{},createdAt:x.created_at})),
      fetchedAt:new Date().toISOString(),source:'cloud'
    };
    v5EnsureDashboardShape();
    saveDashboardCache(); cloud.status='online'; cloud.error=null;
    try{
      const {data:health,error:he}=await cloud.client.rpc('diet_copilot_healthcheck');
      if(!he&&health){cloud.bridgeReady=Boolean(health.capabilities?.log_meal_from_ai&&health.capabilities?.log_weight_from_ai);cloud.schemaVersion=health.schema_version;}
    }catch{}
    render(); if(!silent)showToast('Dashboard refreshed');
  } catch(e) {
    cloud.status='error'; cloud.error=e.message||String(e); updateStatus();
    if(!silent)showToast(`Refresh failed: ${p5FriendlyError? p5FriendlyError(cloud.error):cloud.error}`);
    if(connectionDialog.open)renderConnection();
  }
};

subscribeRealtime = async function subscribeRealtimeV5() {
  if(!cloud.client||!cloud.user)return;
  if(cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{}}
  let ch=cloud.client.channel(`diet-dashboard-v5-${cloud.user.id}`);
  ['profiles','daily_logs','meals','meal_items','weight_entries','saved_foods','saved_meals','goal_phases','target_recommendations','weekly_reviews'].forEach(table=>{
    ch=ch.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshData({silent:true}),350);});
  });
  cloud.channel=ch.subscribe();
};

mealCard = function mealCardV5(m) {
  const range = m.caloriesLow != null && m.caloriesHigh != null && Number(m.caloriesLow)!==Number(m.caloriesHigh) ? `${fmt(m.caloriesLow)}–${fmt(m.caloriesHigh)} kcal` : null;
  const sourceMeta=p2SourceMeta(m), cls=p2MealClass(m.type), time=m.eatenAt?new Date(m.eatenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  const photo=v5SafePhotoUrl(m.photoUrl), showPhoto=photo && dashboard.profile?.showMealPhotos!==false;
  const itemRows=(m.items||[]).map(i=>{
    const bits=[];
    if(i.quantity)bits.push(esc(i.quantity));
    if(Number(i.protein||0)>0)bits.push(`${fmt(i.protein,1)} g protein`);
    if(i.fiber!=null)bits.push(`${fmt(i.fiber,1)} g fiber`);
    if(dashboard.profile?.showOptionalMacros){if(i.carbs!=null)bits.push(`${fmt(i.carbs,1)} g carbs`);if(i.fat!=null)bits.push(`${fmt(i.fat,1)} g fat`);}
    return `<div class="meal-detail-row"><div class="meal-detail-main"><strong>${esc(i.name||'Food')}</strong>${bits.length?`<small>${bits.join(' · ')}</small>`:''}</div><div class="meal-detail-cal">${fmt(i.calories)} kcal</div></div>`;
  }).join('');
  const meta=[];
  if(range)meta.push(`<span class="meal-estimate-range">Likely ${range}</span>`);
  if(m.fiber!=null)meta.push(`<span class="v5-fiber-text">${fmt(m.fiber,1)} g fiber</span>`);
  if(dashboard.profile?.showOptionalMacros){if(m.carbs!=null)meta.push(`${fmt(m.carbs,1)} g carbs`);if(m.fat!=null)meta.push(`${fmt(m.fat,1)} g fat`);}
  if(m.notes)meta.push(esc(m.notes));
  return `<details class="meal-v2 ${cls} ${showPhoto?'has-photo':''}">
    <summary>
      ${showPhoto?`<img class="v5-meal-photo" src="${esc(photo)}" alt="${esc(m.photoAlt||m.title||'Meal photo')}" loading="lazy">`:''}
      <div class="meal-summary-main">
        <div class="meal-kicker"><span class="meal-dot" aria-hidden="true"></span><span class="meal-type-v2">${esc(m.type||'Meal')}</span>${time?`<span class="meal-time-v2">${esc(time)}</span>`:''}</div>
        <div class="meal-name-v2">${esc(m.title||'Meal')}</div>
        <div class="meal-meta-v2"><span class="meal-protein-v2">${fmt(m.protein,1)} g protein</span>${m.fiber!=null?`<span>·</span><span class="v5-fiber-text">${fmt(m.fiber,1)} g fiber</span>`:''}<span>·</span><span class="meal-source-v2 ${sourceMeta.cls}">${esc(sourceMeta.label)}</span></div>
      </div>
      <div class="meal-summary-side"><strong>${fmt(m.calories)}</strong><small>kcal</small><svg class="meal-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></div>
    </summary>
    <div class="meal-details-v2">${itemRows||`<div class="meal-detail-row"><div class="meal-detail-main"><strong>No item breakdown</strong><small>Only the meal total was recorded.</small></div></div>`}${meta.length?`<div class="meal-details-meta"><strong>${esc(sourceMeta.label)}</strong><br>${meta.join(' · ')}</div>`:''}</div>
  </details>`;
};

p4WeekSnapshotMarkup = function p4WeekSnapshotMarkupV5() {
  const complete=completeDates(7), avgCalories=complete.length?average(complete.map(d=>totalsFor(d).calories)):null, avgProtein=complete.length?average(complete.map(d=>totalsFor(d).protein)):null;
  const fiberDays=complete.map(d=>v5MacroForDate(d,'fiber')).filter(x=>x.complete), avgFiber=fiberDays.length?average(fiberDays.map(x=>x.value)):null;
  const weights=dashboard.weights.filter(w=>w.date>=rangeStart(7)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightChange=weights.length>1?Number(weights.at(-1).weight)-Number(weights[0].weight):null, latest=latestWeight();
  return `<aside class="p4-week-card" aria-label="Seven day snapshot"><div class="p4-week-card-head"><div><strong>7-day snapshot</strong><span>Complete days only for intake averages</span></div></div><div class="p4-week-grid v5-week-grid">
    <div class="p4-week-stat calories"><span>Avg calories</span><strong>${avgCalories==null?'—':`${fmt(avgCalories)} kcal`}</strong></div>
    <div class="p4-week-stat protein"><span>Avg protein</span><strong>${avgProtein==null?'—':`${fmt(avgProtein,1)} g`}</strong></div>
    <div class="p4-week-stat v5-fiber"><span>Avg fiber</span><strong>${avgFiber==null?'—':`${fmt(avgFiber,1)} g`}</strong></div>
    <div class="p4-week-stat weight"><span>Weight change</span><strong>${weightChange==null?(latest?`${fmt(latest.weight,1)} kg`:'—'):`${weightChange>0?'+':''}${fmt(weightChange,1)} kg`}</strong></div>
    <div class="p4-week-stat complete"><span>Complete days</span><strong>${complete.length}/7</strong></div>
  </div><div class="p4-week-note">Incomplete days are excluded from intake averages. Fiber averages only use days where fiber data is complete.</div></aside>`;
};

const v5RenderTodayBase=renderToday;
renderToday=function renderTodayV5(){
  const result=v5RenderTodayBase(); v5EnsureDashboardShape();
  const root=app.querySelector('.today-v2'); if(!root)return result;
  const date=localDateKey(), fiber=v5MacroForDate(date,'fiber'), target=Number(dashboard.profile.fiberTarget||30), pct=target?Math.max(0,Math.min(100,fiber.value/target*100)):0;
  const metrics=root.querySelector('.today-metrics');
  if(metrics&&!metrics.querySelector('.today-metric.fiber')) metrics.insertAdjacentHTML('beforeend',`<section class="today-metric fiber" aria-label="Fiber summary"><div class="metric-v2-head"><span class="metric-v2-title">Fiber</span><span class="metric-v2-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21V10"/><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 16c4 0 6-2 6-6-4 0-6 2-6 6Z"/></svg></span></div><div class="metric-v2-value">${fiber.hasAny?`${fmt(fiber.value,1)} g`:'—'}</div><div class="metric-v2-sub">${fiber.hasAny?`${fiber.complete?'':'At least '}${fmt(fiber.value,1)} of ${fmt(target)} g${fiber.complete?'':' · partial data'}`:'No fiber data yet'}</div><div class="v5-fiber-track"><span style="width:${pct}%"></span></div></section>`);
  const head=root.querySelector('.today-meals-head');
  if(head&&!head.querySelector('.v5-day-status')){const status=String(dayLog(date).status||'open');head.insertAdjacentHTML('beforeend',`<span class="v5-day-status ${esc(status)}">${status==='complete'?'Complete day':status==='partial'?'Partial day':'Open day'}</span>`);}
  const phase=v5CurrentPhase(), goal=dashboard.profile.goalWeight, pace=dashboard.profile.desiredWeeklyWeightChange;
  if((phase||goal!=null||pace!=null)&&!root.querySelector('.v5-goal-strip')){
    const parts=[]; if(phase)parts.push(`<strong>${esc(phase.name)}</strong>`); if(goal!=null)parts.push(`Goal ${fmt(goal,1)} kg`); if(pace!=null)parts.push(`Desired ${pace>0?'+':''}${fmt(pace,2)} kg/week`);
    const anchor=root.querySelector('.today-metrics'); anchor?.insertAdjacentHTML('afterend',`<div class="v5-goal-strip"><span>Goal</span><div>${parts.join('<i>·</i>')}</div></div>`);
  }
  if(dashboard.profile.showOptionalMacros&&!root.querySelector('.v5-macro-strip')){
    const carbs=v5MacroForDate(date,'carbs'), fat=v5MacroForDate(date,'fat');
    root.querySelector('.today-meals-section')?.insertAdjacentHTML('beforebegin',`<div class="v5-macro-strip"><span>Optional macros</span><strong>Carbs ${carbs.hasAny?`${carbs.complete?'':'≥'}${fmt(carbs.value,1)} g`:'—'}</strong><strong>Fat ${fat.hasAny?`${fat.complete?'':'≥'}${fmt(fat.value,1)} g`:'—'}</strong></div>`);
  }
  return result;
};

p3TrendTabs=function p3TrendTabsV5(){
  const tabs=[['weight','Weight'],['calories','Calories'],['protein','Protein'],['fiber','Fiber']];
  return `<div class="p3-segmented v5-trend-tabs" role="tablist" aria-label="Trend metric">${tabs.map(([key,label])=>`<button type="button" role="tab" aria-selected="${p3TrendMetric===key?'true':'false'}" class="${p3TrendMetric===key?'active':''}" data-trend-metric="${key}">${label}</button>`).join('')}</div>`;
};

function v5FiberChart(dates){
  if(!dates.length)return `<div class="p3-chart-empty"><strong>No fiber data yet</strong><span>Fiber appears when nutrition labels or meal estimates include it.</span></div>`;
  const width=760,height=250,left=42,right=18,top=24,bottom=34,target=Number(dashboard.profile.fiberTarget||30);
  const points=dates.map(date=>{const f=v5MacroForDate(date,'fiber');return {date,value:f.hasAny?f.value:null,complete:f.complete&&dayLog(date).status==='complete',coverage:f.complete};});
  if(!points.some(p=>p.value!=null))return `<div class="p3-chart-empty"><strong>No fiber data yet</strong><span>New nutrition-label foods will automatically carry fiber when it is available.</span></div>`;
  const max=Math.max(target,...points.map(p=>Number(p.value)||0),1)*1.15,plot=width-left-right,step=plot/Math.max(1,points.length),barWidth=Math.max(1.5,Math.min(30,step*.58));
  const y=v=>top+(1-(Number(v)||0)/max)*(height-top-bottom), targetY=y(target);
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-bar-chart fiber" viewBox="0 0 ${width} ${height}" role="img" aria-label="Fiber trend chart"><line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/><line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>${points.map((p,i)=>{if(p.value==null)return '';const x=left+step*i+(step-barWidth)/2,yy=y(p.value),h=Math.max(1,height-bottom-yy),label=`${prettyDate(p.date,{day:'numeric',month:'short'})}: ${p.coverage?'':'at least '}${fmt(p.value,1)} g fiber`;return `<rect class="p3-bar ${p.complete?'complete':'partial'} p6-chart-hit" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6,barWidth/2).toFixed(1)}" tabindex="0" role="img" aria-label="${esc(label)}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></rect>`;}).join('')}<line class="p3-target-line" x1="${left}" x2="${width-right}" y1="${targetY}" y2="${targetY}"/><text class="p3-axis-label" x="${left}" y="16">${fmt(max,0)} g</text><text class="p3-axis-date" x="${left}" y="${height-8}">${prettyDate(points[0].date,{day:'numeric',month:'short'})}</text><text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(points.at(-1).date,{day:'numeric',month:'short'})}</text></svg><div class="p3-chart-legend"><span><i class="p3-legend-bar"></i>Recorded fiber</span><span><i class="p3-legend-line"></i>${fmt(target)} g target</span></div></div>`;
}

function v5TrendFiber(){
  const dates=p3TrendDates(), complete=dates.map(d=>({date:d,f:v5MacroForDate(d,'fiber')})).filter(x=>dayLog(x.date).status==='complete'&&x.f.complete), target=Number(dashboard.profile.fiberTarget||30), avg=complete.length?average(complete.map(x=>x.f.value)):null, hits=complete.filter(x=>x.f.value>=target).length, hitRate=complete.length?Math.round(hits/complete.length*100):null;
  return `<div class="p3-trend-summary fiber"><div class="p3-trend-primary"><span>Average fiber</span><strong>${avg==null?'—':`${fmt(avg,1)} g`}</strong><small>${complete.length?`${hits} of ${complete.length} complete-data days hit target`:'Complete fiber data is needed for averages'}</small></div><div class="p3-trend-secondary"><div><span>Fiber target</span><strong>${fmt(target)} g</strong></div><div><span>Target hit rate</span><strong>${hitRate==null?'—':`${hitRate}%`}</strong></div></div></div>${v5FiberChart(dates)}`;
}

renderTrends=function renderTrendsV5(){
  if(p3GateView())return;
  const metricContent=p3TrendMetric==='weight'?p3TrendWeight():p3TrendMetric==='calories'?p3TrendCalories():p3TrendMetric==='protein'?p3TrendProtein():v5TrendFiber();
  app.innerHTML=`<div class="p3-view p3-trends-view">${p3PageHeader('Trends','Follow weight, calories, protein and fiber without cluttering the screen with competing charts.')}${p3TrendTabs()}${p3RangeBar(trendRange,'trend',p3TrendRanges())}<section class="p3-trend-panel ${p3TrendMetric}">${metricContent}</section></div>`;
  app.querySelectorAll('[data-trend-metric]').forEach(button=>button.addEventListener('click',()=>{p3TrendMetric=button.dataset.trendMetric;renderTrends();}));
  app.querySelectorAll('[data-trend-range]').forEach(button=>button.addEventListener('click',()=>{trendRange=button.dataset.trendRange==='all'?Infinity:Number(button.dataset.trendRange);renderTrends();}));
};

function v5WeeklySummary(){
  const dates=Array.from({length:7},(_,i)=>offsetDateKey(i-6)), complete=dates.filter(d=>dayLog(d).status==='complete'), avgCalories=complete.length?average(complete.map(d=>totalsFor(d).calories)):null, avgProtein=complete.length?average(complete.map(d=>totalsFor(d).protein)):null;
  const weights=dashboard.weights.filter(w=>w.date>=dates[0]&&w.date<=dates.at(-1)).sort((a,b)=>a.date.localeCompare(b.date));
  const change=weights.length>1?weights.at(-1).weight-weights[0].weight:null;
  return {complete:complete.length,avgCalories,avgProtein,weightChange:change};
}

const v5RenderInsightsBase=renderInsights;
renderInsights=function renderInsightsV5(){
  const result=v5RenderInsightsBase(); const root=app.querySelector('.p3-insights-view'); if(!root)return result; v5EnsureDashboardShape();
  const week=v5WeeklySummary(), phase=v5CurrentPhase(), rec=v5LatestRecommendation(), foods=dashboard.savedFoods||[];
  const goalValue=phase?phase.name:(dashboard.profile.goalWeight!=null?`${fmt(dashboard.profile.goalWeight,1)} kg goal`:'Not configured');
  const goalCopy=phase?`${phase.phaseType} · ${fmt(phase.calorieTarget)} kcal · ${fmt(phase.proteinTarget)} g protein${phase.desiredWeeklyWeightChange!=null?` · ${phase.desiredWeeklyWeightChange>0?'+':''}${fmt(phase.desiredWeeklyWeightChange,2)} kg/week`:''}`:'Tell ChatGPT your goal weight and desired weekly change to enable adaptive calibration.';
  let recValue='Not ready', recCopy='Set a desired weekly weight-change rate and build enough complete-day / weigh-in data first.';
  if(rec){if(rec.status==='pending'&&rec.recommendedTarget!=null){recValue=`${fmt(rec.recommendedTarget)} kcal`;recCopy=`Suggested from ${rec.completeDays} complete days and ${rec.weighInCount} weigh-ins. Ask ChatGPT to apply or dismiss it.`;}else if(rec.status==='accepted'){recValue=`${fmt(rec.recommendedTarget)} kcal applied`;recCopy='The most recent adaptive recommendation was accepted.';}else if(rec.status==='insufficient'){recCopy=rec.rationale||recCopy;}}
  root.insertAdjacentHTML('beforeend',`<section class="v5-intelligence-section"><div class="v5-section-head"><div><h3>Diet intelligence</h3><p>Useful automation and planning without adding manual logging controls.</p></div></div><div class="v5-intelligence-grid">
    <article class="v5-intel-card goal"><span>Goal phase</span><strong>${esc(goalValue)}</strong><p>${esc(goalCopy)}</p></article>
    <article class="v5-intel-card week"><span>7-day review</span><strong>${week.complete}/7 complete</strong><p>${week.avgCalories==null?'Complete days will unlock reliable weekly averages.':`${fmt(week.avgCalories)} kcal · ${fmt(week.avgProtein,1)} g protein${week.weightChange==null?'':` · ${week.weightChange>0?'+':''}${fmt(week.weightChange,1)} kg`}`}</p></article>
    <article class="v5-intel-card calibration"><span>Calorie calibration</span><strong>${esc(recValue)}</strong><p>${esc(recCopy)}</p></article>
    <article class="v5-intel-card memory"><span>Food memory</span><strong>${foods.length} remembered</strong><p>${foods.length?`Exact packaged foods can now be reused without re-estimating. Most recent: ${esc(foods[0].name)}.`:'Exact nutrition-label foods will be remembered automatically.'}</p></article>
  </div></section>`);
  return result;
};

const v5RenderConnectionBase=renderConnection;
renderConnection=function renderConnectionV5(){
  v5RenderConnectionBase(); v5EnsureDashboardShape(); if(!cloud.user)return;
  const phase=v5CurrentPhase(), p=dashboard.profile;
  connectionContent.insertAdjacentHTML('beforeend',`<section class="v5-account-settings"><div class="v5-account-settings-head"><strong>Diet settings</strong><span>Managed through ChatGPT</span></div><div class="v5-settings-grid">
    <div><span>Goal phase</span><strong>${phase?esc(phase.name):'Not set'}</strong></div>
    <div><span>Goal weight</span><strong>${p.goalWeight==null?'—':`${fmt(p.goalWeight,1)} kg`}</strong></div>
    <div><span>Desired pace</span><strong>${p.desiredWeeklyWeightChange==null?'—':`${p.desiredWeeklyWeightChange>0?'+':''}${fmt(p.desiredWeeklyWeightChange,2)} kg/wk`}</strong></div>
    <div><span>Fiber target</span><strong>${fmt(p.fiberTarget||30)} g</strong></div>
    <div><span>Optional carbs/fat</span><strong>${p.showOptionalMacros?'Shown':'Hidden'}</strong></div>
    <div><span>Reminders</span><strong>${esc(v5ReminderSummary())}</strong></div>
  </div><p>Tell ChatGPT things like “set my goal to…”, “show carbs and fat”, or “remind me to close my day”.</p></section>`);
};

/* ===== src/intelligence/dashboard-v5-2.js ===== */
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

/* ===== src/ui/dashboard-v5-3.js ===== */
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

/* ===== src/auth/dashboard-auth-final.js ===== */
'use strict';

// Final auth surface guard. All active layers are Google-only; this last layer
// keeps that contract explicit if presentation layers are rearranged later.
const dietRenderConnectionBeforeFinalAuth = renderConnection;

renderConnection = function renderConnectionFinalAuth() {
  const result = dietRenderConnectionBeforeFinalAuth();
  const email = cloud.user?.email || '';

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="connection-state">
        <strong>THIEPN Account</strong>
        <span>Signed in as ${esc(email)}. Diet Copilot data stays private to this account.</span>
      </div>
      <div class="btn-row">
        <button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>`;

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', () => refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut({ scope: 'local' });
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      renderConnection();
      render();
    });
    return result;
  }

  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>Sign in with THIEPN Account</strong>
      <span>Continue with your Google account to sync Diet Copilot.</span>
    </div>
    ${cloud.error ? `<div class="connection-state"><span style="color:var(--danger)">${esc(cloud.error)}</span></div>` : ''}
    <div class="btn-row">
      <button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button>
    </div>`;

  const button = connectionContent.querySelector('#googleSignInBtn');
  button?.addEventListener('click', async event => {
    const target = event.currentTarget;
    target.disabled = true;
    target.textContent = 'Redirecting…';
    cloud.error = null;
    try {
      await dietSignInWithGoogle();
    } catch (error) {
      cloud.error = error?.message || String(error);
      renderConnection();
    }
  });

  return result;
};

/* ===== src/core/dashboard-04.js ===== */
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

/* ===== src/intelligence/dashboard-v6-2.js ===== */
'use strict';

// V6.2 — Smart Diet Coach & Decision Engine.
// This layer is intentionally passive on Today: it interprets existing data and
// never adds a logging control or an extra step between the user and ChatGPT.

function v62ExactSource(source) {
  return ['nutrition_label','weighed','manual_exact','saved_food','saved_meal','saved_recipe'].includes(String(source||''));
}

function v62TodayDecision() {
  if (typeof v5EnsureDashboardShape === 'function') v5EnsureDashboardShape();
  const date = localDateKey();
  const meals = mealsFor(date);
  if (!meals.length) return null;

  const totals = totalsFor(date);
  const target = targetsFor(date);
  const fiber = v5MacroForDate(date,'fiber');
  const fiberTarget = Number(dashboard.profile?.fiberTarget || 30);
  const calRemaining = Number(target.calories||0) - Number(totals.calories||0);
  const proteinRemaining = Math.max(0, Number(target.protein||0) - Number(totals.protein||0));
  const fiberRemaining = Math.max(0, fiberTarget - Number(fiber.value||0));
  const caloriesLow = meals.reduce((sum,m)=>sum+Number(m.caloriesLow ?? m.calories ?? 0),0);
  const caloriesHigh = meals.reduce((sum,m)=>sum+Number(m.caloriesHigh ?? m.calories ?? 0),0);
  const exactMeals = meals.filter(m=>v62ExactSource(m.source)).length;
  const rangeWidth = Math.max(0,caloriesHigh-caloriesLow);
  const localHour = new Date().getHours();

  let state='on_track', title='Day is still flexible', copy=`About ${fmt(Math.max(0,calRemaining))} kcal remain with ${fmt(proteinRemaining,1)} g protein still available to target.`;
  if (Number(totals.calories||0) >= Number(target.calories||0)+150) {
    state='over_target'; title='Above calorie target'; copy='No compensation is required from one day. If you eat again, prioritize hunger, protein and fiber rather than trying to correct the number.';
  } else if (calRemaining <= 250 && proteinRemaining >= 25) {
    state='calories_tight'; title='Protein is the constraint'; copy=`About ${fmt(Math.max(0,calRemaining))} kcal remain while ${fmt(proteinRemaining,1)} g protein is still needed. If you eat again, a lean protein source fits best.`;
  } else if (proteinRemaining >= 35 && calRemaining >= 250) {
    state='protein_priority'; title='Protein is the priority'; copy=`${fmt(proteinRemaining,1)} g protein remains with about ${fmt(calRemaining)} kcal available.`;
  } else if (fiberRemaining >= 10 && calRemaining >= 250) {
    state='fiber_priority'; title='Fiber is the clearest gap'; copy=`Known fiber is ${fmt(fiberRemaining,1)} g below target with about ${fmt(calRemaining)} kcal available.`;
  } else if (localHour >= 20 && calRemaining >= 500) {
    state='room_left'; title='Plenty of room remains'; copy=`About ${fmt(calRemaining)} kcal remain. There is no need to force food if you are not hungry, but the day is still well below target.`;
  } else if (calRemaining >= -150 && calRemaining <= 250 && proteinRemaining <= 20 && fiberRemaining <= 8) {
    state='no_action_needed'; title='No correction needed'; copy='Calories and the main nutrition targets are close enough that there is no useful adjustment to make.';
  }

  return {
    date, meals, state, title, copy,
    calories:Number(totals.calories||0), protein:Number(totals.protein||0), fiber:Number(fiber.value||0),
    calorieTarget:Number(target.calories||0), proteinTarget:Number(target.protein||0), fiberTarget,
    calRemaining, proteinRemaining, fiberRemaining,
    caloriesLow, caloriesHigh, rangeWidth,
    exactMeals, estimatedMeals:Math.max(0,meals.length-exactMeals), exactRate:meals.length?Math.round(exactMeals/meals.length*100):null,
    fiberComplete:fiber.complete, fiberUnknown:fiber.unknown, uncertaintyMaterial:rangeWidth>=300
  };
}

function v62FoodScore(food, d) {
  const calories=Number(food.calories||0), protein=Number(food.protein||0), fiber=food.fiber==null?null:Number(food.fiber);
  if (!(calories>0)) return -Infinity;
  let fit=0;
  if (d.calRemaining<=250) {
    if (calories<=Math.max(75,d.calRemaining+25)) fit+=27;
    else if (calories<=Math.max(150,d.calRemaining+100)) fit+=7;
    else fit-=25;
  } else if (calories<=d.calRemaining+75) fit+=18;
  else if (calories<=d.calRemaining+200) fit+=4;
  else fit-=18;

  if (d.proteinRemaining>0) fit+=Math.min(45,(protein/Math.max(1,d.proteinRemaining))*45);
  if (d.fiberRemaining>0 && fiber!=null) fit+=Math.min(20,(fiber/Math.max(1,d.fiberRemaining))*20);
  fit+=Math.min(18,(protein/calories*100)*0.9);
  if (food.favorite) fit+=4;
  fit+=Math.min(Number(food.useCount||0),10)*0.4;
  return fit;
}

function v62FoodWhy(food, d) {
  const calories=Number(food.calories||0), protein=Number(food.protein||0), fiber=food.fiber==null?null:Number(food.fiber);
  const proteinEfficiency=calories>0?protein/calories*100:0;
  if (d.state==='calories_tight' && calories<=Math.max(150,d.calRemaining+75) && proteinEfficiency>=10) return 'high protein for the calories';
  if (proteinEfficiency>=12) return 'protein-efficient';
  if (fiber!=null && fiber>=4) return 'fiber-efficient';
  if (d.calories+calories<=d.calorieTarget+150) return 'fits today';
  return 'familiar saved food';
}

function v62FoodSuggestions(d, limit=2) {
  if (!['calories_tight','protein_priority','fiber_priority'].includes(d.state)) return [];
  return [...(dashboard.savedFoods||[])]
    .filter(f=>Number(f.calories||0)>0)
    .map(f=>({food:f,score:v62FoodScore(f,d)}))
    .filter(x=>Number.isFinite(x.score))
    .sort((a,b)=>b.score-a.score || Number(b.food.useCount||0)-Number(a.food.useCount||0))
    .slice(0,limit)
    .map(x=>({...x.food,why:v62FoodWhy(x.food,d),score:x.score}));
}

function v62GuidanceMarkup(d) {
  const suggestions=v62FoodSuggestions(d,2);
  const uncertainty=d.uncertaintyMaterial
    ? `<div class="v62-uncertainty"><strong>Estimate uncertainty matters</strong><span>Today is roughly ${fmt(d.caloriesLow)}–${fmt(d.caloriesHigh)} kcal from the stored ranges, so do not over-correct the point estimate.</span></div>`
    : '';
  const foodRows=suggestions.length?`<div class="v62-food-fit"><span>Best fit from saved foods</span>${suggestions.map(f=>`<div class="v62-food-row"><div><strong>${esc(f.name)}</strong><small>${esc(f.why)}</small></div><div><b>${fmt(f.protein,1)} g</b><small>${fmt(f.calories)} kcal</small></div></div>`).join('')}</div>`:'';
  const fiberLabel=d.fiberComplete?`${fmt(d.fiberRemaining,1)} g fiber left`:`${fmt(d.fiber,1)} g known fiber`;
  return `<section class="v62-guidance ${esc(d.state)}" aria-label="Today's guidance">
    <div class="v62-guidance-head"><div><span>Today's guidance</span><strong>${esc(d.title)}</strong></div><small>${d.exactRate==null?'':`${d.exactRate}% exact / reused`}</small></div>
    <p>${esc(d.copy)}</p>
    <div class="v62-guidance-metrics"><span><b>${fmt(Math.max(0,d.calRemaining))}</b> kcal left</span><span><b>${fmt(d.proteinRemaining,1)}</b> g protein left</span><span><b>${esc(fiberLabel)}</b></span></div>
    ${uncertainty}${foodRows}
  </section>`;
}

function v62CoachActions() {
  if (typeof v52Metrics!=='function') return [];
  const m=v52Metrics(28), actions=[];
  const today=v62TodayDecision();
  if (today && !['no_action_needed','on_track'].includes(today.state)) actions.push({type:today.state,title:today.title,copy:today.copy});
  if (m.loggedDays<7) actions.push({type:'baseline',title:'Keep building the baseline',copy:`${m.loggedDays}/7 logged intake days. All logged data already counts; more days make trend decisions steadier.`});
  if (m.proteinHitRate!=null&&m.proteinHitRate<70) actions.push({type:'protein',title:'Make protein easier to hit',copy:`Protein reached target on ${m.proteinHitRate}% of logged days. Improving convenience is more useful than chasing perfect macros.`});
  if (m.avgFiber!=null&&m.fiberTarget&&m.avgFiber<m.fiberTarget) actions.push({type:'fiber',title:'Fiber remains a recurring gap',copy:`Known fiber averages ${fmt(m.avgFiber,1)} g against a ${fmt(m.fiberTarget)} g target. Missing fiber stays unknown rather than becoming zero.`});
  if (m.calorieHitRate!=null&&m.calorieHitRate<60) actions.push({type:'calories',title:'Calorie consistency is the bigger lever',copy:`${m.calorieHitRate}% of logged days are within ±150 kcal of target.`});
  if (m.pace!=null&&m.desired!=null&&Math.abs(m.pace-m.desired)>.15) actions.push({type:'pace',title:'Weight pace differs from plan',copy:`Observed ${v52Sign(m.pace,2,' kg/week')} versus ${v52Sign(m.desired,2,' kg/week')} planned. Wait for trend evidence before changing calories.`});
  if (m.exactRate!=null&&m.exactRate<50) actions.push({type:'confidence',title:'Treat precision cautiously',copy:`Only ${m.exactRate}% of recent meals are exact or reused. Large photo/restaurant estimates should not trigger aggressive corrections.`});
  const min=Number(dashboard.profile?.adaptiveMinCompleteDays||14),need=Math.max(0,min-m.loggedDays);
  if (need>0) actions.push({type:'calibration',title:'Adaptive calories are still learning',copy:`${need} more logged intake day${need===1?'':'s'} are needed before calibration has enough intake history.`});
  if (!actions.length) actions.push({type:'good',title:'No obvious intervention',copy:'Current logged intake and available trend data do not show a clear change to make.'});
  return actions.slice(0,4);
}

if (typeof v6CoachActions === 'function') v6CoachActions=v62CoachActions;
if (typeof v6CoachMarkup === 'function') {
  v6CoachMarkup=function v62CoachMarkup(){
    const actions=v62CoachActions();
    const m=typeof v52Metrics==='function'?v52Metrics(28):null;
    const confidence=m?.exactRate==null?'Building data quality':`${m.exactRate}% exact / reused`;
    return `<section class="v6-coach v62-coach"><div class="v6-section-head"><div><span>Decision engine</span><h3>Coach priorities</h3></div><small>${esc(confidence)}</small></div><div class="v6-coach-grid">${actions.map((a,i)=>`<article class="${esc(a.type)}"><b>${i+1}</b><div><strong>${esc(a.title)}</strong><p>${esc(a.copy)}</p></div></article>`).join('')}</div></section>`;
  };
}

// Wrap the final Today renderer after V6.1.2. The Quick Capture invariant is
// reinforced here so future V6 changes cannot accidentally bring it back.
const v62RenderTodayBase=renderToday;
renderToday=function renderTodayV62(){
  const result=v62RenderTodayBase();
  const root=app.querySelector('.today-v2');
  root?.querySelector('.v6-capture-card')?.remove();
  if(!root)return result;
  root.querySelector('.v62-guidance')?.remove();
  const decision=v62TodayDecision();
  const metrics=root.querySelector('.today-metrics');
  if(decision&&metrics)metrics.insertAdjacentHTML('afterend',v62GuidanceMarkup(decision));
  return result;
};

// Re-render once after this layer is installed so an already-open Today or
// Insights view receives V6.2 without waiting for the next realtime event.
queueMicrotask(()=>{
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  if(typeof render==='function')render();
});

/* ===== src/intelligence/dashboard-v6-3.js ===== */
'use strict';

// V6.3 — Food Intelligence & Memory 2.0.
// V6.6 owns final rendering, refresh and realtime. V6.3 now contributes only
// reusable food-memory intelligence and the remembered-food guidance upgrade.

function v63EnsureShape(){
  dashboard.foodPortions ||= [];
}

async function v63LoadFoodPortions(){
  v63EnsureShape();
  if(!cloud.client||!cloud.user)return;
  const {data,error}=await cloud.client
    .from('saved_food_portions')
    .select('id,saved_food_id,multiplier,quantity_text,use_count,last_used_at,updated_at')
    .order('use_count',{ascending:false});
  if(error)throw error;
  dashboard.foodPortions=(data||[]).map(x=>({
    id:x.id,
    savedFoodId:x.saved_food_id,
    multiplier:Number(x.multiplier||1),
    quantity:x.quantity_text||'',
    useCount:Number(x.use_count||0),
    lastUsedAt:x.last_used_at,
    updatedAt:x.updated_at
  }));
  saveDashboardCache();
}

function v63UsualPortion(foodId){
  v63EnsureShape();
  return [...dashboard.foodPortions]
    .filter(p=>p.savedFoodId===foodId)
    .sort((a,b)=>b.useCount-a.useCount || String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||'')))[0]||null;
}

function v63PortionLabel(food,portion){
  if(!portion)return food.quantity||'';
  if(portion.quantity)return portion.quantity;
  if(Math.abs(Number(portion.multiplier||1)-1)<.001)return food.quantity||'usual portion';
  return `${fmt(portion.multiplier,2)} × ${food.quantity||'saved portion'}`;
}

function v63ScaleFoodToUsual(food){
  const portion=v63UsualPortion(food.id);
  const mult=portion?Number(portion.multiplier||1):1;
  const scale=v=>v==null?null:Number(v)*mult;
  return {
    ...food,
    calories:scale(food.calories),
    protein:scale(food.protein),
    carbs:scale(food.carbs),
    fat:scale(food.fat),
    fiber:scale(food.fiber),
    usualMultiplier:mult,
    usualQuantity:v63PortionLabel(food,portion),
    portionUseCount:portion?.useCount||0
  };
}

// V6.2 food suggestions use the user's learned usual amount rather than
// blindly assuming the saved base portion when enough portion history exists.
if(typeof v62FoodSuggestions==='function'){
  v62FoodSuggestions=function v63FoodSuggestions(d,limit=2){
    if(!['calories_tight','protein_priority','fiber_priority'].includes(d.state))return [];
    return [...(dashboard.savedFoods||[])]
      .filter(f=>Number(f.calories||0)>0)
      .map(base=>{
        const food=v63ScaleFoodToUsual(base);
        const score=v62FoodScore(food,d)+Math.min(food.portionUseCount||0,6)*.75;
        return {food,score};
      })
      .filter(x=>Number.isFinite(x.score))
      .sort((a,b)=>b.score-a.score || Number(b.food.useCount||0)-Number(a.food.useCount||0))
      .slice(0,limit)
      .map(x=>({...x.food,why:v62FoodWhy(x.food,d),score:x.score}));
  };
}

if(typeof v62GuidanceMarkup==='function'){
  v62GuidanceMarkup=function v63GuidanceMarkup(d){
    const suggestions=v62FoodSuggestions(d,2);
    const uncertainty=d.uncertaintyMaterial
      ? `<div class="v62-uncertainty"><strong>Estimate uncertainty matters</strong><span>Today is roughly ${fmt(d.caloriesLow)}–${fmt(d.caloriesHigh)} kcal from the stored ranges, so do not over-correct the point estimate.</span></div>`
      : '';
    const foodRows=suggestions.length?`<div class="v62-food-fit"><span>Best fit from remembered foods</span>${suggestions.map(f=>`<div class="v62-food-row"><div><strong>${esc(f.name)}</strong><small>${esc(f.why)}${f.usualQuantity?` · usual ${esc(f.usualQuantity)}`:''}</small></div><div><b>${fmt(f.protein,1)} g</b><small>${fmt(f.calories)} kcal</small></div></div>`).join('')}</div>`:'';
    const fiberLabel=d.fiberComplete?`${fmt(d.fiberRemaining,1)} g fiber left`:`${fmt(d.fiber,1)} g known fiber`;
    return `<section class="v62-guidance ${esc(d.state)}" aria-label="Today's guidance">
      <div class="v62-guidance-head"><div><span>Today's guidance</span><strong>${esc(d.title)}</strong></div><small>${d.exactRate==null?'':`${d.exactRate}% exact / reused`}</small></div>
      <p>${esc(d.copy)}</p>
      <div class="v62-guidance-metrics"><span><b>${fmt(Math.max(0,d.calRemaining))}</b> kcal left</span><span><b>${fmt(d.proteinRemaining,1)}</b> g protein left</span><span><b>${esc(fiberLabel)}</b></span></div>
      ${uncertainty}${foodRows}
    </section>`;
  };
}

function v63RecentCutoff(days=90){
  const d=new Date(`${localDateKey()}T12:00:00`);
  d.setDate(d.getDate()-Math.max(1,days)+1);
  return d.toISOString().slice(0,10);
}

function v63MealPatterns(days=90){
  const cutoff=v63RecentCutoff(days), map=new Map();
  for(const meal of dashboard.meals||[]){
    if(!meal.date||meal.date<cutoff)continue;
    for(const item of meal.items||[]){
      if(!item.savedFoodId)continue;
      const key=`${item.savedFoodId}|${meal.type||'Other'}`;
      const prev=map.get(key)||{savedFoodId:item.savedFoodId,name:item.name||'Food',mealType:meal.type||'Other',uses:0,lastUsed:meal.date};
      prev.uses+=1;
      if(meal.date>prev.lastUsed)prev.lastUsed=meal.date;
      map.set(key,prev);
    }
  }
  return [...map.values()].filter(x=>x.uses>=2).sort((a,b)=>b.uses-a.uses||b.lastUsed.localeCompare(a.lastUsed));
}

function v63Pairings(days=90){
  const cutoff=v63RecentCutoff(days), map=new Map();
  for(const meal of dashboard.meals||[]){
    if(!meal.date||meal.date<cutoff)continue;
    const unique=[...new Map((meal.items||[]).filter(i=>i.savedFoodId).map(i=>[i.savedFoodId,i])).values()];
    for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
      const pair=[unique[i],unique[j]].sort((a,b)=>String(a.savedFoodId).localeCompare(String(b.savedFoodId)));
      const key=`${pair[0].savedFoodId}|${pair[1].savedFoodId}`;
      const prev=map.get(key)||{nameA:pair[0].name||'Food',nameB:pair[1].name||'Food',uses:0,lastUsed:meal.date};
      prev.uses+=1;
      if(meal.date>prev.lastUsed)prev.lastUsed=meal.date;
      map.set(key,prev);
    }
  }
  return [...map.values()].filter(x=>x.uses>=2).sort((a,b)=>b.uses-a.uses||b.lastUsed.localeCompare(a.lastUsed));
}

function v63MemoryStats(){
  v63EnsureShape();
  const foods=dashboard.savedFoods||[];
  const aliases=foods.reduce((n,f)=>n+(f.aliases||[]).length,0);
  const barcodes=foods.filter(f=>f.barcode&&f.verifiedAt).length;
  const favorites=foods.filter(f=>f.favorite).length;
  const learnedFoods=new Set(dashboard.foodPortions.map(p=>p.savedFoodId)).size;
  const patterns=v63MealPatterns(90);
  const pairings=v63Pairings(90);
  return {foods,aliases,barcodes,favorites,learnedFoods,patterns,pairings};
}

function v63TopFoodRows(foods){
  const top=[...foods].sort((a,b)=>Number(b.useCount||0)-Number(a.useCount||0)||String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||''))).slice(0,4);
  if(!top.length)return '<div class="v53-empty">Food memory will build automatically as exact foods are logged through ChatGPT.</div>';
  return `<div class="v63-memory-list">${top.map(food=>{
    const portion=v63UsualPortion(food.id);
    const label=v63PortionLabel(food,portion);
    const badges=[];
    if(food.favorite)badges.push('favorite');
    if(food.barcode&&food.verifiedAt)badges.push('verified barcode');
    return `<div class="v63-memory-row"><div><strong>${esc(food.name)}</strong><small>${label?`usual ${esc(label)}`:'portion still learning'}${badges.length?` · ${esc(badges.join(' · '))}`:''}</small></div><div><b>${fmt(food.protein,1)} g</b><small>${fmt(food.calories)} kcal saved</small></div></div>`;
  }).join('')}</div>`;
}

function v63PatternRows(patterns,pairings){
  const rows=[];
  for(const p of patterns.slice(0,3))rows.push(`<div class="v63-pattern-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.mealType)} pattern</small></div><b>${p.uses}×</b></div>`);
  for(const p of pairings.slice(0,2))rows.push(`<div class="v63-pattern-row"><div><strong>${esc(p.nameA)} + ${esc(p.nameB)}</strong><small>Repeated together</small></div><b>${p.uses}×</b></div>`);
  return rows.length?`<div class="v63-pattern-list">${rows.join('')}</div>`:'<div class="v53-empty">No repeated meal pattern is strong enough yet. This appears automatically after repeat use.</div>';
}

function v63FoodIntelligenceMarkup(){
  const s=v63MemoryStats();
  return `<section class="v63-food-intelligence">
    <div class="v6-section-head"><div><span>Memory 2.0</span><h3>Food intelligence</h3></div><small>Learned automatically</small></div>
    <div class="v63-memory-stats">
      <div><span>Saved foods</span><strong>${s.foods.length}</strong></div>
      <div><span>Learned portions</span><strong>${s.learnedFoods}</strong></div>
      <div><span>Aliases</span><strong>${s.aliases}</strong></div>
      <div><span>Verified barcodes</span><strong>${s.barcodes}</strong></div>
    </div>
    <div class="v63-memory-columns">
      <div class="v63-memory-block"><div class="v63-block-head"><strong>Remembered foods</strong><small>Most used first</small></div>${v63TopFoodRows(s.foods)}</div>
      <div class="v63-memory-block"><div class="v63-block-head"><strong>Recognized routines</strong><small>Last 90 days</small></div>${v63PatternRows(s.patterns,s.pairings)}</div>
    </div>
    <p class="v63-memory-note">Aliases, usual portions and meal patterns are learned from normal ChatGPT logging. The dashboard remains read-only.</p>
  </section>`;
}

/* ===== src/intelligence/dashboard-v6-4.js ===== */
'use strict';

// V6.4 — Reliability, Reconciliation & Data Integrity.
// The dashboard remains read-only. This layer only makes the existing viewer
// converge back to canonical Supabase state quickly after resume/reconnect.

let v64RefreshPromise = null;
let v64ResumeTimer = null;
const V64_STALE_MS = 15000;

function v64SnapshotAgeMs(){
  const stamp = dashboard?.fetchedAt;
  const parsed = stamp ? Date.parse(stamp) : 0;
  return parsed > 0 ? Math.max(0, Date.now() - parsed) : Infinity;
}

async function v64RefreshCanonical({force=false}={}){
  if(!cloud?.client || !cloud?.user) return false;
  if(navigator.onLine === false) return false;
  if(!force && v64SnapshotAgeMs() < V64_STALE_MS) return false;
  if(v64RefreshPromise) return v64RefreshPromise;

  v64RefreshPromise = (async()=>{
    try{
      await refreshData({silent:true});
      return true;
    }catch(error){
      console.warn('V6.4 canonical refresh failed', error);
      return false;
    }finally{
      v64RefreshPromise = null;
    }
  })();
  return v64RefreshPromise;
}

function v64ScheduleCanonicalRefresh(force=false){
  clearTimeout(v64ResumeTimer);
  v64ResumeTimer = setTimeout(()=>v64RefreshCanonical({force}), 120);
}

window.addEventListener('online', ()=>v64ScheduleCanonicalRefresh(true));
window.addEventListener('focus', ()=>v64ScheduleCanonicalRefresh(false));
window.addEventListener('pageshow', event=>v64ScheduleCanonicalRefresh(Boolean(event.persisted)));
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') v64ScheduleCanonicalRefresh(false);
});

// If a Realtime subscription disappeared while the app was suspended, rebuild
// it on a forced reconnect. This is silent and does not alter data.
window.addEventListener('online', ()=>{
  setTimeout(()=>{
    if(cloud?.user && typeof subscribeRealtime === 'function'){
      Promise.resolve(subscribeRealtime()).catch(error=>console.warn('V6.4 realtime resubscribe failed', error));
    }
  }, 250);
});

// Keep the product boundary explicit even if old cached V6 scripts are mixed in.
const v64RenderTodayBase = renderToday;
renderToday = function renderTodayV64(){
  const result = v64RenderTodayBase();
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  return result;
};

// Reconcile once after the new layer arrives when the current snapshot is stale.
queueMicrotask(()=>v64ScheduleCanonicalRefresh(false));

/* ===== src/intelligence/dashboard-v6-5.js ===== */
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

/* ===== src/intelligence/dashboard-v6-6.js ===== */
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

/* ===== src/release.js ===== */
'use strict';

// V6.8.1 — Diet Copilot Web 1.0.2 maintenance release.
// No new nutrition workflow: this layer freezes and certifies the stable web product.
const DIET_PRODUCT_VERSION = '6.8.1';
const DIET_WEB_RELEASE = '1.0.2';
const DIET_RELEASE_CHANNEL = 'stable';

function dietTodayInvariant(){
  const root=app?.querySelector?.('.today-v2');
  if(!root)return;
  root.querySelector('.v6-capture-card')?.remove();
  root.querySelector('.v6-activity')?.remove();
  root.querySelector('.v51-closeout-hint')?.remove();
  document.getElementById('v6CaptureDialog')?.remove();
}

function dietHorizontalOverflow(){
  const doc=document.documentElement;
  return Math.max(0,(doc?.scrollWidth||0)-(doc?.clientWidth||0));
}

function dietReleaseSnapshot(){
  const nutrition=typeof v66ConfidenceForRange==='function'?v66ConfidenceForRange(28):null;
  const weight=typeof v66WeightConfidence==='function'?v66WeightConfidence(28):null;
  return Object.freeze({
    productVersion:DIET_PRODUCT_VERSION,
    webRelease:DIET_WEB_RELEASE,
    channel:DIET_RELEASE_CHANNEL,
    stable:true,
    view:typeof view==='string'?view:null,
    online:navigator.onLine,
    cloudStatus:cloud?.status??'unknown',
    source:dashboard?.source??null,
    fetchedAt:dashboard?.fetchedAt??null,
    realtimeChannels:[cloud?.channel,cloud?.v6ActivityChannel].filter(Boolean).length,
    horizontalOverflowPx:dietHorizontalOverflow(),
    quickCapturePresent:Boolean(document.querySelector('.v6-capture-card,[data-v6-capture]')),
    activityTodayCardPresent:Boolean(document.querySelector('.today-v2 .v6-activity')),
    closeoutPromptPresent:Boolean(document.querySelector('.today-v2 .v51-closeout-hint')),
    nutritionConfidence:nutrition?.label??'Building',
    weightConfidence:weight?.label??'Building'
  });
}

function dietReleaseChecks(){
  const snapshot=dietReleaseSnapshot();
  return Object.freeze({
    release:DIET_WEB_RELEASE,
    stable:true,
    dashboardReadOnly:true,
    directChatGPTLogging:true,
    quickCaptureAbsent:!snapshot.quickCapturePresent,
    todayActivityCardAbsent:!snapshot.activityTodayCardPresent,
    closeoutPromptAbsent:!snapshot.closeoutPromptPresent,
    noHorizontalOverflow:snapshot.horizontalOverflowPx<=1,
    canonicalRealtimeOnly:snapshot.realtimeChannels<=1,
    snapshot
  });
}

const dietRenderTodayStableBase=renderToday;
renderToday=function renderTodayV68(){
  const result=dietRenderTodayStableBase();
  dietTodayInvariant();
  return result;
};

window.DietRelease=Object.freeze({
  version:DIET_PRODUCT_VERSION,
  webRelease:DIET_WEB_RELEASE,
  channel:DIET_RELEASE_CHANNEL,
  stable:true,
  snapshot:dietReleaseSnapshot,
  certify:dietReleaseChecks
});

window.addEventListener('load',dietTodayInvariant,{once:true});
window.addEventListener('resize',()=>{
  clearTimeout(dietHorizontalOverflow.t);
  dietHorizontalOverflow.t=setTimeout(()=>{
    const overflow=dietHorizontalOverflow();
    if(overflow>1)console.warn(`Diet Copilot Web 1.0.2 horizontal overflow detected: ${overflow}px`);
  },150);
});
queueMicrotask(dietTodayInvariant);

/* ===== src/native/android-bridge.js ===== */
'use strict';

// V7.0.3 native Android companion. This file is deliberately inert on the web.
const DIET_NATIVE_VERSION = '7.0.3';
const DIET_NATIVE_AUTH_START = 'https://thiepn.dev/diet/native-auth-start.html';
const DIET_NATIVE_PENDING_FLOW_KEY = 'diet-copilot:native-oauth-flow-v2';
let dietNativeAuthSubscription = null;
let dietNativeAuthUrlListener = null;
let dietNativeSessionFingerprint = null;
let dietNativePanelBusy = false;
let dietNativeOAuthBusy = false;

function dietNativePlugin(){
  return globalThis.Capacitor?.Plugins?.DietHealthConnect || null;
}
function dietNativeAppPlugin(){
  return globalThis.Capacitor?.Plugins?.App || null;
}
function dietNativeBrowserPlugin(){
  return globalThis.Capacitor?.Plugins?.Browser || null;
}
function dietIsNativeAndroid(){
  return Boolean(dietNativePlugin());
}
function dietNativeTime(value){
  if(!value)return 'Not synced yet';
  const d=new Date(value); return Number.isNaN(d.getTime())?'Not synced yet':d.toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function dietNativeRememberFlowId(flowId){
  try{
    if(flowId)localStorage.setItem(DIET_NATIVE_PENDING_FLOW_KEY,flowId);
    else localStorage.removeItem(DIET_NATIVE_PENDING_FLOW_KEY);
  }catch{}
}
function dietNativePendingFlowId(){
  try{return localStorage.getItem(DIET_NATIVE_PENDING_FLOW_KEY)||null}catch{return null}
}

async function dietNativeStartGoogleOAuth(){
  if(!dietIsNativeAndroid()||!cloud?.client)throw new Error('Native sign-in is unavailable.');
  if(dietNativeOAuthBusy)return;
  const browser=dietNativeBrowserPlugin();
  if(!browser)throw new Error('Android browser integration is unavailable.');
  dietNativeOAuthBusy=true;
  try{
    const {data,error}=await cloud.client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:DIET_AUTH_RELAY,
        skipBrowserRedirect:true,
        queryParams:{prompt:'select_account'}
      }
    });
    if(error)throw error;
    if(!data?.url)throw new Error('Google sign-in URL was not created.');

    const flowId=data.flowId||null;
    dietNativeRememberFlowId(flowId);

    // Open a first-party bootstrap page before Supabase. It marks this external
    // browser tab as the native client, then immediately continues to the
    // provider URL. This prevents the shared WordStrike callback from guessing
    // whether a PKCE code belongs to the website or to the Android WebView.
    const startUrl=new URL(DIET_NATIVE_AUTH_START);
    startUrl.hash=new URLSearchParams({auth_url:data.url,flow_id:flowId||''}).toString();
    await browser.open({url:startUrl.toString()});
  }catch(error){
    dietNativeRememberFlowId(null);
    throw error;
  }finally{
    dietNativeOAuthBusy=false;
  }
}

async function dietNativeHandleAuthUrl(rawUrl){
  if(!rawUrl||!cloud?.client)return false;
  let url;
  try{url=new URL(rawUrl)}catch{return false}
  if(url.protocol!=='dev.thiepn.diet:'||url.hostname!=='auth-callback')return false;

  await dietNativeBrowserPlugin()?.close?.().catch(()=>{});
  const authError=url.searchParams.get('error_description')||url.searchParams.get('error');
  if(authError){
    cloud.error=authError;
    cloud.status='configured';
    updateStatus();
    if(connectionDialog?.open)renderConnection();
    showToast(`Google sign-in failed: ${authError}`);
    return true;
  }

  const code=url.searchParams.get('code');
  if(!code){
    cloud.error='Google sign-in returned without an authorization code.';
    dietNativeRememberFlowId(null);
    if(connectionDialog?.open)renderConnection();
    showToast(cloud.error);
    return true;
  }

  try{
    const flowId=url.searchParams.get('sb_flow_id')||dietNativePendingFlowId();
    const {data,error}=await cloud.client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    if(error)throw error;
    cloud.user=data?.session?.user||null;
    cloud.status=cloud.user?'online':'configured';
    cloud.error=null;
    dietNativeRememberFlowId(null);
    dietNativeSessionFingerprint=null;
    updateStatus();
    await dietNativeConfigureSession();
    if(cloud.user){
      await refreshData({silent:true});
      await subscribeRealtime();
    }
    render();
    if(connectionDialog?.open)connectionDialog.close();
    showToast('Signed in with THIEPN Account');
  }catch(error){
    cloud.error=error?.message||String(error);
    dietNativeRememberFlowId(null);
    cloud.status='configured';
    updateStatus();
    if(connectionDialog?.open)renderConnection();
    showToast(`Google sign-in failed: ${cloud.error}`);
  }
  return true;
}

async function dietNativeInstallAuthDeepLink(){
  const appPlugin=dietNativeAppPlugin();
  if(!appPlugin||dietNativeAuthUrlListener)return;
  dietNativeAuthUrlListener=await appPlugin.addListener('appUrlOpen',event=>{
    dietNativeHandleAuthUrl(event?.url).catch(error=>{
      cloud.error=error?.message||String(error);
      if(connectionDialog?.open)renderConnection();
    });
  });
  const launch=await appPlugin.getLaunchUrl().catch(()=>null);
  if(launch?.url)await dietNativeHandleAuthUrl(launch.url);
}

async function dietNativeConfigureSession(){
  const plugin=dietNativePlugin();
  if(!plugin||!cloud?.client)return;
  const {data}=await cloud.client.auth.getSession();
  const session=data?.session;
  if(!session){
    dietNativeSessionFingerprint=null;
    await plugin.clearSession().catch(()=>{});
    return;
  }
  const fingerprint=`${session.user?.id||''}:${session.expires_at||0}:${String(session.refresh_token||'').slice(-8)}`;
  if(fingerprint===dietNativeSessionFingerprint)return;
  await plugin.configureSession({
    supabaseUrl:DIET_SUPABASE.url,
    anonKey:DIET_SUPABASE.key,
    accessToken:session.access_token,
    refreshToken:session.refresh_token,
    expiresAt:Number(session.expires_at||0)
  });
  dietNativeSessionFingerprint=fingerprint;
  await dietNativeConfigureReminders();
}

async function dietNativeConfigureReminders(){
  const plugin=dietNativePlugin(), p=dashboard?.profile;
  if(!plugin||!cloud?.user||!p)return;
  await plugin.configureReminders({
    weighEnabled:Boolean(p.weighInReminderEnabled),
    weighTime:p.weighInReminderTime||null,
    weeklyEnabled:Boolean(p.weeklyReviewReminderEnabled),
    weeklyDay:p.weeklyReviewDay==null?null:Number(p.weeklyReviewDay),
    weeklyTime:p.weeklyReviewTime||null,
    timezone:p.reminderTimezone||Intl.DateTimeFormat().resolvedOptions().timeZone
  }).catch(()=>{});
}

function dietNativeStateCopy(state){
  if(state.healthConnectStatus==='update_required')return 'Health Connect needs an update on this device.';
  if(state.healthConnectStatus!=='available')return 'Health Connect is unavailable on this device.';
  if(!state.permissionsGranted)return 'Connect Health Connect to sync steps, active calories, exercise and distance.';
  if(state.backgroundReadSupported&&!state.backgroundReadGranted)return 'Connected for foreground sync. Allow background health access for automatic syncing.';
  return 'Connected. Activity is used as coaching context and never automatically increases your calorie target.';
}

async function dietNativeRenderPanel(){
  if(!dietIsNativeAndroid()||!cloud?.user||dietNativePanelBusy)return;
  const host=connectionContent?.querySelector('.p5-account-footnote')?.parentElement || connectionContent;
  if(!host)return;
  let card=host.querySelector('[data-diet-native-health]');
  if(!card){
    card=document.createElement('section');
    card.className='diet-native-health';
    card.dataset.dietNativeHealth='';
    host.appendChild(card);
  }
  dietNativePanelBusy=true;
  try{
    await dietNativeConfigureSession();
    const state=await dietNativePlugin().getState();
    card.innerHTML=`
      <div class="diet-native-health-head"><div><span>Android</span><strong>Health Connect</strong></div><span class="diet-native-health-badge ${state.permissionsGranted?'connected':'idle'}">${state.permissionsGranted?'Connected':'Not connected'}</span></div>
      <p>${esc(dietNativeStateCopy(state))}</p>
      <div class="diet-native-health-stats">
        <div><span>Background sync</span><strong>${state.backgroundReadGranted?'Allowed':state.backgroundReadSupported?'Not allowed':'Unavailable'}</strong></div>
        <div><span>Last activity sync</span><strong>${esc(dietNativeTime(state.lastSyncAt))}</strong></div>
      </div>
      <div class="btn-row diet-native-health-actions">
        ${state.healthConnectStatus==='available'&&!state.permissionsGranted?'<button class="btn primary" type="button" data-native-connect>Connect Health Connect</button>':''}
        ${state.permissionsGranted?'<button class="btn primary" type="button" data-native-sync>Sync now</button>':''}
        ${!state.notificationPermissionGranted?'<button class="btn ghost" type="button" data-native-notifications>Allow reminders</button>':''}
      </div>`;
    card.querySelector('[data-native-connect]')?.addEventListener('click',async event=>{
      event.currentTarget.disabled=true;
      await dietNativePlugin().requestHealthPermissions();
      showToast('Complete Health Connect permissions, then return to Diet Copilot');
    });
    card.querySelector('[data-native-sync]')?.addEventListener('click',async event=>{
      const button=event.currentTarget; button.disabled=true; button.textContent='Syncing…';
      try{
        await dietNativePlugin().syncDailyActivity({days:2});
        await refreshData({silent:true});
        showToast('Health Connect synced');
      }catch(error){
        showToast(error?.message||'Health Connect sync failed');
      }finally{ dietNativeRenderPanel(); }
    });
    card.querySelector('[data-native-notifications]')?.addEventListener('click',async()=>{
      await dietNativePlugin().requestNotificationPermission();
      showToast('Notification permission requested');
    });
  }catch(error){
    card.innerHTML=`<div class="diet-native-health-head"><div><span>Android</span><strong>Health Connect</strong></div></div><p>${esc(error?.message||'Native integration is temporarily unavailable.')}</p>`;
  }finally{
    dietNativePanelBusy=false;
  }
}

const dietNativeRenderConnectionBase=renderConnection;
renderConnection=function renderConnectionNative(){
  const result=dietNativeRenderConnectionBase();
  if(dietIsNativeAndroid()&&cloud?.user)queueMicrotask(dietNativeRenderPanel);
  return result;
};

async function dietNativeBootstrap(){
  if(!dietIsNativeAndroid()||!cloud?.client)return;
  await dietNativeInstallAuthDeepLink().catch(()=>{});
  await dietNativeConfigureSession().catch(()=>{});
  if(!dietNativeAuthSubscription){
    const {data}=cloud.client.auth.onAuthStateChange(()=>{
      dietNativeSessionFingerprint=null;
      queueMicrotask(()=>dietNativeConfigureSession().catch(()=>{}));
    });
    dietNativeAuthSubscription=data?.subscription||null;
  }
}

window.addEventListener('load',()=>dietNativeBootstrap());
window.addEventListener('focus',()=>{
  dietNativeBootstrap();
  if(connectionDialog?.open)dietNativeRenderPanel();
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')dietNativeBootstrap();
});
setTimeout(dietNativeBootstrap,500);

window.DietNative=Object.freeze({
  version:DIET_NATIVE_VERSION,
  isAndroid:dietIsNativeAndroid,
  state:()=>dietNativePlugin()?.getState(),
  sync:()=>dietNativePlugin()?.syncDailyActivity({days:2}),
  startGoogleOAuth:dietNativeStartGoogleOAuth,
  handleAuthUrl:dietNativeHandleAuthUrl
});

/* ===== src/operations/dashboard-ops.js ===== */
'use strict';

// A7 operational layer. This file intentionally does not own identity, data, or
// network transport. It observes the final dashboard contract and emits only
// redacted operational metadata.
const DIET_OPERATIONS_VERSION = 'A7.1';

function dietReleaseLabel() {
  return window.DietRelease?.webRelease || (typeof RELEASE === 'string' ? RELEASE : null);
}

function dietOperationId() {
  try { return crypto.randomUUID(); }
  catch { return `op-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
}

function dietFailureCategory(status = 0) {
  const code = Number(status || 0);
  if (code === 0) return 'network';
  if (code === 401) return 'authentication';
  if (code === 403) return 'authorization';
  if (code === 429) return 'rate_limit';
  if (code >= 500) return 'service';
  if (code >= 400) return 'request';
  return 'unknown';
}

function dietOperationalEvent(event, fields = {}) {
  const allowed = ['operation_id','category','http_status','duration_ms','attempt','online','cloud_status','release','error_name'];
  const payload = { event, operations_version: DIET_OPERATIONS_VERSION };
  for (const key of allowed) {
    const value = fields[key];
    if (value !== undefined && value !== null) payload[key] = value;
  }
  const serialized = JSON.stringify(payload);
  if (String(event).endsWith('.failure') || fields.category === 'service') console.warn(serialized);
  else console.info(serialized);
}

function dietOperationalSnapshot() {
  return Object.freeze({
    app: 'diet',
    operationsVersion: DIET_OPERATIONS_VERSION,
    release: dietReleaseLabel(),
    online: navigator.onLine,
    cloudStatus: cloud?.status ?? 'unknown',
    hasSession: Boolean(cloud?.user),
    cachedAt: dashboard?.fetchedAt ?? null,
    source: dashboard?.source ?? null,
  });
}

const dietRefreshBeforeOperations = typeof refreshData === 'function' ? refreshData : null;
if (dietRefreshBeforeOperations) {
  refreshData = async function refreshDataA7(...args) {
    const operationId = dietOperationId();
    const started = Date.now();
    try {
      const result = await dietRefreshBeforeOperations.apply(this, args);
      if (cloud?.status === 'error') {
        dietOperationalEvent('diet.refresh.failure', {
          operation_id: operationId,
          category: navigator.onLine ? 'service' : 'network',
          duration_ms: Date.now() - started,
          online: navigator.onLine,
          cloud_status: cloud.status,
          release: dietReleaseLabel(),
        });
      } else {
        dietOperationalEvent('diet.refresh.success', {
          operation_id: operationId,
          duration_ms: Date.now() - started,
          online: navigator.onLine,
          cloud_status: cloud?.status ?? 'unknown',
          release: dietReleaseLabel(),
        });
      }
      return result;
    } catch (error) {
      dietOperationalEvent('diet.refresh.failure', {
        operation_id: operationId,
        category: navigator.onLine ? 'service' : 'network',
        duration_ms: Date.now() - started,
        online: navigator.onLine,
        cloud_status: cloud?.status ?? 'unknown',
        release: dietReleaseLabel(),
        error_name: error?.name || 'Error',
      });
      throw error;
    }
  };
}

window.addEventListener('offline', () => {
  dietOperationalEvent('diet.network.offline', {
    operation_id: dietOperationId(),
    category: 'network',
    online: false,
    cloud_status: cloud?.status ?? 'unknown',
    release: dietReleaseLabel(),
  });
});

window.addEventListener('online', () => {
  dietOperationalEvent('diet.network.online', {
    operation_id: dietOperationId(),
    online: true,
    cloud_status: cloud?.status ?? 'unknown',
    release: dietReleaseLabel(),
  });
});

window.DietOperations = Object.freeze({
  version: DIET_OPERATIONS_VERSION,
  classifyStatus: dietFailureCategory,
  createOperationId: dietOperationId,
  snapshot: dietOperationalSnapshot,
});
