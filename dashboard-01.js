'use strict';

const RELEASE = '2.0';
const CACHE_KEY = 'diet-copilot-dashboard-cache-v2';
const CLOUD_CONFIG_KEY = 'diet-copilot-cloud-config';
const LEGACY_STATE_KEY = 'diet-copilot-state';
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

function loadCloudConfig() {
  try { return { url:'', key:'', ...JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || '{}') }; }
  catch { return { url:'', key:'' }; }
}
function saveCloudConfig() { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ url:cloudConfig.url || '', key:cloudConfig.key || '' })); }
function configured() { return Boolean(cloudConfig.url && cloudConfig.key); }

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
