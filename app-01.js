'use strict';

  const APP_VERSION = 5;
  const STORAGE_KEY = 'diet-copilot-v0.5';
  const LEGACY_KEYS = ['diet-copilot-v0.4', 'diet-copilot-v0.3', 'diet-copilot-v0.2', 'diet-copilot-v0.1'];
  const CLOUD_CONFIG_KEY = 'diet-copilot-cloud-config-v0.2';
  const MIGRATION_BACKUP_KEY = 'diet-copilot-migration-backup-v0.5';
  const REPAIR_BACKUP_KEY = 'diet-copilot-repair-backup-v0.5';
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
    version: APP_VERSION,
    profile: { calorieTarget: 2300, proteinTarget: 160, goalWeight: null, theme: 'dark' },
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

  let state = loadState();
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
  let cloud = { client: null, user: null, status: 'local', busy: false, lastSyncAt: null, error: null, channel: null, remotePending: false, remoteEventCount: 0, deferredRefresh: false, health: null, healthCheckedAt: null };
  let cloudConfig = loadCloudConfig();

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
  function normalizeItem(item, fallback = {}) {
    return {
      id: isUuid(item?.id) ? item.id : newId(),
      name: String(item?.name || fallback.name || 'Food'),
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

