'use strict';

const RELEASE_VERSION = '1.0';

const STATE_VERSION = 6;

const DB_SCHEMA_VERSION = 5;

const STORAGE_KEY = 'diet-copilot-state';

const LEGACY_KEYS = ['diet-copilot-v0.5', 'diet-copilot-v0.4', 'diet-copilot-v0.3', 'diet-copilot-v0.2', 'diet-copilot-v0.1'];

const CLOUD_CONFIG_KEY = 'diet-copilot-cloud-config';

const LEGACY_CLOUD_CONFIG_KEYS = ['diet-copilot-cloud-config-v0.2'];

const MIGRATION_BACKUP_KEY = 'diet-copilot-migration-backup-v1.0';

const REPAIR_BACKUP_KEY = 'diet-copilot-repair-backup-v1.0';

const SAFETY_BACKUP_KEY = 'diet-copilot-safety-backup';

const HISTORY_PAGE_SIZE = 30;

const BASELINE_TABLES = new Set(['profiles','daily_logs','meals','meal_items','saved_foods','saved_meals','saved_meal_items','weight_entries']);

const app = document.getElementById('app');

const toast = document.getElementById('toast');

const mealDialog = document.getElementById('mealDialog');

const quickLogDialog = document.getElementById('quickLogDialog');

const savedFoodDialog = document.getElementById('savedFoodDialog');

const savedMealDialog = document.getElementById('savedMealDialog');

const weightDialog = document.getElementById('weightDialog');

const syncPill = document.getElementById('syncPill');

const defaultState = {
    version: STATE_VERSION,
    profile: { calorieTarget: 2300, proteinTarget: 160, goalWeight: null, theme: 'dark', targetsConfirmed: false },
    meals: [],
    weights: [],
    dayLogs: {},
    savedFoods: [],
    savedMeals: [],
    aiActions: [],
    changes: [],
    syncQueue: [],
    cloudBaselines: {}
  };

let state;

let currentView = 'today';

let historyMode = 'history';

let historyQuery = '';

let historyLimit = HISTORY_PAGE_SIZE;

let quickMode = 'usuals';

let mealEditorItems = [];

let savedMealEditorItems = [];

let lastDeleted = null;

let remoteRefreshTimer = null;

let syncRetryTimer = null;

let deferredInstallPrompt = null;

let qaReport = null;

let runtimeWarnings = [];

let cloud;

let cloudConfig;

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function newId() { return crypto?.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)}`; }

function nowIso() { return new Date().toISOString(); }

function localDateKey(date = new Date()) {
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

function offsetDateKey(days) { const d = new Date(); d.setDate(d.getDate() + days); return localDateKey(d); }

function fmt(n, digits = 0) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits }); }

function average(arr) { return arr.length ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length : 0; }

function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

function prettyDate(dateKey, options = {}) { return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, options); }

function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || ''); }

function sumItems(items = []) { return items.reduce((a, i) => ({ calories: a.calories + Number(i.calories || 0), protein: a.protein + Number(i.protein || 0) }), { calories: 0, protein: 0 }); }

function rangeForItems(items = []) {
    const ranged = items.some(i => i.caloriesLow != null || i.caloriesHigh != null);
    if (!ranged) return { low: null, high: null };
    return items.reduce((a, i) => ({ low: a.low + Number(i.caloriesLow ?? i.calories ?? 0), high: a.high + Number(i.caloriesHigh ?? i.calories ?? 0) }), { low: 0, high: 0 });
  }

function mealRange(m) { const r = rangeForItems(m?.items || []); return { low: m?.caloriesLow ?? r.low, high: m?.caloriesHigh ?? r.high }; }

function aggregateConfidence(items = []) {
    const values = items.map(i => i?.confidence || 'medium');
    if (values.includes('low')) return 'low';
    if (values.includes('medium')) return 'medium';
    return 'high';
  }

function normalizeItem(item, fallback = {}) {
    const rawName = item?.name ?? fallback.name;
    return {
      id: isUuid(item?.id) ? item.id : newId(),
      name: rawName == null ? 'Food' : String(rawName),
      quantity: String(item?.quantity ?? item?.quantityText ?? fallback.quantity ?? ''),
      calories: Number(item?.calories ?? fallback.calories ?? 0),
      protein: Number(item?.protein ?? fallback.protein ?? 0),
      confidence: item?.confidence || fallback.confidence || 'medium',
      source: item?.source || fallback.source || 'text_estimate',
      caloriesLow: item?.caloriesLow ?? item?.calories_low ?? fallback.caloriesLow ?? fallback.calories_low ?? null,
      caloriesHigh: item?.caloriesHigh ?? item?.calories_high ?? fallback.caloriesHigh ?? fallback.calories_high ?? null,
      savedFoodId: isUuid(item?.savedFoodId || item?.saved_food_id) ? (item.savedFoodId || item.saved_food_id) : null
    };
  }


'use strict';

function normalizeState(input) {
    const s = { ...clone(defaultState), ...(input || {}) };
    const incomingProfile = input?.profile || {};
    s.profile = { ...clone(defaultState.profile), ...(s.profile || {}) };
    const incomingDayLogs = input?.dayLogs || input?.dayStatus || {};
    if (incomingProfile.targetsConfirmed == null) {
      s.profile.targetsConfirmed = Boolean(
        (Array.isArray(input?.meals) && input.meals.length) ||
        (Array.isArray(input?.weights) && input.weights.length) ||
        Object.keys(incomingDayLogs || {}).length ||
        Number(incomingProfile.calorieTarget ?? 2300) !== 2300 ||
        Number(incomingProfile.proteinTarget ?? 160) !== 160
      );
    } else s.profile.targetsConfirmed = Boolean(incomingProfile.targetsConfirmed);
    s.meals = Array.isArray(s.meals) ? s.meals : [];
    s.weights = Array.isArray(s.weights) ? s.weights : [];
    s.savedFoods = Array.isArray(s.savedFoods) ? s.savedFoods : [];
    s.savedMeals = Array.isArray(s.savedMeals) ? s.savedMeals : [];
    s.aiActions = Array.isArray(s.aiActions) ? s.aiActions : [];
    s.dayLogs = s.dayLogs || s.dayStatus || {};
    s.changes = Array.isArray(s.changes) ? s.changes : [];
    s.syncQueue = Array.isArray(s.syncQueue) ? s.syncQueue : [];
    s.cloudBaselines = s.cloudBaselines && typeof s.cloudBaselines === 'object' && !Array.isArray(s.cloudBaselines) ? s.cloudBaselines : {};

    s.dayLogs = Object.fromEntries(Object.entries(s.dayLogs).map(([date, value]) => {
      if (value && typeof value === 'object') {
        return [date, {
          id: isUuid(value.id) ? value.id : newId(),
          status: value.status || 'partial',
          calorieTarget: Number(value.calorieTarget ?? s.profile.calorieTarget),
          proteinTarget: Number(value.proteinTarget ?? s.profile.proteinTarget),
          notes: value.notes || '',
          createdAt: value.createdAt || nowIso(),
          updatedAt: value.updatedAt || value.createdAt || nowIso()
        }];
      }
      return [date, { id: newId(), status: String(value || (date === localDateKey() ? 'open' : 'partial')), calorieTarget: Number(s.profile.calorieTarget), proteinTarget: Number(s.profile.proteinTarget), notes: '', createdAt: nowIso(), updatedAt: nowIso() }];
    }));

    const mealIdMap = new Map();
    s.meals = s.meals.map(m => {
      const old = m.id;
      const id = isUuid(old) ? old : newId();
      if (old) mealIdMap.set(old, id);
      let items = Array.isArray(m.items) ? m.items.map(i => normalizeItem(i, { confidence: m.confidence, source: m.source })) : [];
      if (!items.length) items = [normalizeItem(null, { name: m.title || 'Meal', calories: m.calories, protein: m.protein, confidence: m.confidence, source: m.source })];
      const totals = sumItems(items);
      return {
        ...m,
        id,
        date: m.date || localDateKey(),
        type: m.type || m.mealType || 'Other',
        title: m.title || 'Meal',
        items,
        calories: totals.calories,
        protein: totals.protein,
        caloriesLow: m.caloriesLow ?? m.calories_low ?? (items.some(i => i.caloriesLow != null || i.caloriesHigh != null) ? items.reduce((a,i)=>a+Number(i.caloriesLow ?? i.calories ?? 0),0) : null),
        caloriesHigh: m.caloriesHigh ?? m.calories_high ?? (items.some(i => i.caloriesLow != null || i.caloriesHigh != null) ? items.reduce((a,i)=>a+Number(i.caloriesHigh ?? i.calories ?? 0),0) : null),
        confidence: m.confidence || 'medium',
        source: m.source || 'text_estimate',
        originalInput: m.originalInput || '',
        notes: m.notes || '',
        createdAt: m.createdAt || nowIso(),
        updatedAt: m.updatedAt || m.createdAt || nowIso()
      };
    });

    const weightByDate = new Map();
    s.weights.forEach(w => weightByDate.set(w.date || localDateKey(), { ...w, id: isUuid(w.id) ? w.id : newId(), weight: Number(w.weight), createdAt: w.createdAt || w.created_at || nowIso(), updatedAt: w.updatedAt || w.updated_at || w.createdAt || w.created_at || nowIso() }));
    s.weights = [...weightByDate.values()];

    s.savedFoods = s.savedFoods.map(f => ({
      id: isUuid(f.id) ? f.id : newId(), name: String(f.name || 'Saved food'), quantity: String(f.quantity || ''), calories: Number(f.calories || 0), protein: Number(f.protein || 0), confidence: f.confidence || 'high', source: f.source || 'manual_exact', favorite: Boolean(f.favorite), useCount: Number(f.useCount || 0), lastUsedAt: f.lastUsedAt || null, createdAt: f.createdAt || nowIso(), updatedAt: f.updatedAt || f.createdAt || nowIso()
    }));
    s.savedMeals = s.savedMeals.map(sm => ({
      id: isUuid(sm.id) ? sm.id : newId(), name: String(sm.name || 'Saved meal'), mealType: sm.mealType || sm.type || 'Other', items: (Array.isArray(sm.items) && sm.items.length ? sm.items : [normalizeItem(null, { name: sm.name || 'Meal', calories: sm.calories, protein: sm.protein })]).map(i => normalizeItem(i)), favorite: Boolean(sm.favorite), useCount: Number(sm.useCount || 0), lastUsedAt: sm.lastUsedAt || null, createdAt: sm.createdAt || nowIso(), updatedAt: sm.updatedAt || sm.createdAt || nowIso()
    }));

    s.aiActions = s.aiActions.map(a => ({ ...a, id: isUuid(a.id) ? a.id : newId(), entityId: a.entityId || a.entity_id || null, actionType: a.actionType || a.action_type || '', entityType: a.entityType || a.entity_type || '', requestId: a.requestId || a.request_id || '', before: a.before ?? a.before_data ?? null, after: a.after ?? a.after_data ?? null, undoneAt: a.undoneAt || a.undone_at || null, createdAt: a.createdAt || a.created_at || nowIso() }));
    s.changes = s.changes.map(c => ({ ...c, id: isUuid(c.id) ? c.id : newId(), entityId: mealIdMap.get(c.entityId) || c.entityId || '' }));
    s.version = STATE_VERSION;
    delete s.dayStatus;
    return s;
  }

