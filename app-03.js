'use strict';
  function loadState() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeState(JSON.parse(current));
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          try {
            if (!localStorage.getItem(MIGRATION_BACKUP_KEY)) localStorage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify({ sourceKey: key, capturedAt: nowIso(), state: JSON.parse(legacy) }));
          } catch (backupError) { console.warn('Migration backup could not be stored', backupError); }
          const migrated = normalizeState(JSON.parse(legacy));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (e) { console.warn('State load failed', e); }
    return clone(defaultState);
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) {
      const message = `Local save failed: ${e.message || e}`;
      runtimeWarnings = [...runtimeWarnings.filter(x => x !== message), message].slice(-8);
      console.error(message);
      if (toast) showToast('Local save failed — export a backup before closing the app');
    }
    updateSyncPill();
  }
  function loadCloudConfig() { try { return { url: '', key: '', activated: false, ...(JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || '{}')) }; } catch { return { url: '', key: '', activated: false }; } }
  function saveCloudConfig() { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig)); }

  function mealTotals(m) { return sumItems(m.items || []); }
  function mealsFor(dateKey) { return state.meals.filter(m => m.date === dateKey).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); }
  function totalsFor(dateKey) { return mealsFor(dateKey).reduce((a, m) => { const t = mealTotals(m); return { calories: a.calories + t.calories, protein: a.protein + t.protein }; }, { calories: 0, protein: 0 }); }
  function getDayLog(dateKey) {
    const existing = state.dayLogs[dateKey];
    if (existing && typeof existing === 'object') return existing;
    return { id: newId(), status: (dateKey === localDateKey() ? 'open' : 'partial'), calorieTarget: Number(state.profile.calorieTarget), proteinTarget: Number(state.profile.proteinTarget), createdAt: nowIso(), updatedAt: nowIso() };
  }
  function getStatus(dateKey) { return getDayLog(dateKey).status; }
  function targetsFor(dateKey) {
    const log = state.dayLogs[dateKey];
    return log && typeof log === 'object' ? { calories: Number(log.calorieTarget), protein: Number(log.proteinTarget) } : { calories: Number(state.profile.calorieTarget), protein: Number(state.profile.proteinTarget) };
  }
  function ensureDayLog(dateKey, persist = true) {
    if (!state.dayLogs[dateKey] || typeof state.dayLogs[dateKey] !== 'object') {
      state.dayLogs[dateKey] = getDayLog(dateKey);
      if (persist) { queueUpsertDay(dateKey); saveState(); }
    }
    return state.dayLogs[dateKey];
  }
  function recentMeals(limit = 8) { return [...state.meals].sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')).slice(0, limit); }
  function sortUsuals(arr) { return [...arr].sort((a, b) => Number(b.favorite) - Number(a.favorite) || Number(b.useCount || 0) - Number(a.useCount || 0) || String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || ''))); }

  function baselineKey(table, rowId) { return `${table}:${rowId}`; }
  function getCloudBaseline(table, rowId) { return state.cloudBaselines?.[baselineKey(table, rowId)] || null; }
  function setCloudBaseline(table, rowId, updatedAt) {
    if (!state.cloudBaselines || typeof state.cloudBaselines !== 'object') state.cloudBaselines = {};
    const key = baselineKey(table, rowId);
    if (updatedAt) state.cloudBaselines[key] = updatedAt; else delete state.cloudBaselines[key];
  }
  function clearCloudBaselines() { state.cloudBaselines = {}; }
  function isOnline() { return navigator.onLine !== false; }
  function isUnsafeSupabaseKey(key) {
    const value = String(key || '').trim();
    if (/^sb_secret_/i.test(value)) return true;
    if (value.split('.').length === 3) {
      try {
        const payload = value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        const decoded = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
        return decoded?.role === 'service_role';
      } catch {}
    }
    return false;
  }
  function hasMigrationBackup() { try { return Boolean(localStorage.getItem(MIGRATION_BACKUP_KEY)); } catch { return false; } }
  function sameServerVersion(a, b) { return String(a || '') === String(b || ''); }
  async function fetchRemoteUpdatedAt(op) {
    if (!cloud.client || !cloud.user || !BASELINE_TABLES.has(op.table)) return null;
    const select = op.table === 'profiles' ? 'user_id,updated_at' : 'id,updated_at';
    let query = cloud.client.from(op.table).select(select);
    query = op.table === 'profiles' ? query.eq('user_id', cloud.user.id) : query.eq('id', op.rowId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data?.updated_at || null;
  }

  function showToast(message, actionLabel, action) {
    toast.innerHTML = '';
    const span = document.createElement('span'); span.textContent = message; toast.appendChild(span);
    if (actionLabel && action) { const btn = document.createElement('button'); btn.textContent = actionLabel; btn.addEventListener('click', () => { action(); hideToast(); }); toast.appendChild(btn); }
    toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(hideToast, 3600);
  }
  function hideToast() { toast.classList.remove('show'); }
