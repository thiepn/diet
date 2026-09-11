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

function loadCloudConfig() {
    const fallback = { url: '', key: '', activated: false };
    try {
      const current = localStorage.getItem(CLOUD_CONFIG_KEY);
      if (current) return { ...fallback, ...JSON.parse(current) };
      for (const key of LEGACY_CLOUD_CONFIG_KEYS) {
        const legacy = localStorage.getItem(key);
        if (!legacy) continue;
        const migrated = { ...fallback, ...JSON.parse(legacy) };
        localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (e) { console.warn('Cloud config load failed', e); }
    return fallback;
  }

function saveCloudConfig() { localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig)); }

function createCloudState() {
    return { client: null, user: null, status: 'local', busy: false, lastSyncAt: null, error: null, channel: null, authSubscription: null, remotePending: false, remoteEventCount: 0, deferredRefresh: false, health: null, healthCheckedAt: null };
  }

function unsubscribeAuthListener() {
    try { cloud?.authSubscription?.unsubscribe?.(); } catch {}
    if (cloud) cloud.authSubscription = null;
  }

async function disposeCloudClient() {
    await unsubscribeRealtime();
    unsubscribeAuthListener();
    try { await cloud?.client?.auth?.dispose?.(); } catch (e) { console.warn('Supabase auth cleanup failed', e); }
  }

function captureSafetyBackup(reason = 'manual safety backup') {
    try {
      localStorage.setItem(SAFETY_BACKUP_KEY, JSON.stringify({ reason, capturedAt: nowIso(), state: clone(state) }));
      return true;
    } catch (e) {
      runtimeWarnings = [...runtimeWarnings, `Safety backup failed: ${e.message || e}`].slice(-8);
      return false;
    }
  }

function prepareDestructiveAction(reason) {
    if (captureSafetyBackup(reason)) return true;
    return confirm('Diet Copilot could not create a safety backup on this device. Continue anyway?');
  }

function getSafetyBackup() { try { return JSON.parse(localStorage.getItem(SAFETY_BACKUP_KEY) || 'null'); } catch { return null; } }

function hasSafetyBackup() { return Boolean(getSafetyBackup()?.state); }

function restoreSafetyBackup() {
    const backup = getSafetyBackup();
    if (!backup?.state) { showToast('No safety backup is available'); return; }
    if (!confirm(`Restore the safety backup from ${new Date(backup.capturedAt).toLocaleString()}? Current local data will be replaced and cloud sync deactivated.`)) return;
    state = normalizeState(backup.state); state.syncQueue = []; clearCloudBaselines(); cloudConfig.activated = false; unsubscribeRealtime(); saveCloudConfig(); saveState(); render(); showToast('Safety backup restored; cloud sync deactivated');
  }

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


'use strict';

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

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return true; } catch {}
    }
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; area.style.pointerEvents = 'none';
    document.body.appendChild(area); area.select(); area.setSelectionRange(0, area.value.length);
    let ok = false; try { ok = document.execCommand?.('copy') === true; } catch {} area.remove();
    if (!ok) throw new Error('Clipboard access is unavailable');
    return true;
  }

function setView(view) { currentView = view; document.querySelectorAll('.nav-item').forEach(b => { const active = b.dataset.view === view; b.classList.toggle('active', active); if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); }); render(); window.scrollTo({ top: 0, behavior: 'auto' }); }

function render() {
    document.getElementById('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    if (currentView === 'today') renderToday(); else if (currentView === 'history') renderHistory(); else if (currentView === 'trends') renderTrends(); else renderSettings();
    updateSyncPill();
  }

