'use strict';
  async function subscribeRealtime() {
    if (!cloud.client || !cloud.user || !cloudConfig.activated) return;
    await unsubscribeRealtime();
    let channel = cloud.client.channel(`diet-copilot-${cloud.user.id}`);
    ['profiles', 'daily_logs', 'meals', 'meal_items', 'weight_entries', 'saved_foods', 'saved_meals', 'saved_meal_items', 'ai_actions'].forEach(table => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRemoteRefresh);
    });
    cloud.channel = channel.subscribe();
  }
  async function unsubscribeRealtime() { if (cloud?.client && cloud?.channel) { try { await cloud.client.removeChannel(cloud.channel); } catch {} } if (cloud) cloud.channel = null; }
  function scheduleRemoteRefresh() {
    if (!cloudConfig.activated) return;
    if (cloud.busy) { cloud.deferredRefresh = true; return; }
    if (state.syncQueue.length) {
      cloud.remotePending = true; cloud.remoteEventCount = Number(cloud.remoteEventCount || 0) + 1; updateSyncPill(); if (currentView === 'settings') renderSettings(); return;
    }
    clearTimeout(remoteRefreshTimer); remoteRefreshTimer = setTimeout(() => { if (!cloud.busy && !state.syncQueue.length) downloadCloudData(false, { silent: true, force: true }); }, 650);
  }

  function drainDeferredRefresh() {
    if (!cloud.deferredRefresh || cloud.busy || state.syncQueue.length || !cloudConfig.activated || !cloud.user) return;
    cloud.deferredRefresh = false;
    clearTimeout(remoteRefreshTimer); remoteRefreshTimer = setTimeout(() => { if (!cloud.busy && !state.syncQueue.length) downloadCloudData(false, { silent: true, force: true }); }, 350);
  }

  function updateSyncPill() {
    if (!syncPill) return; let label = 'Local', cls = 'local';
    if ((cloudConfig.url || cloud.user) && !isOnline()) { label = state.syncQueue.length ? `Offline · ${state.syncQueue.length}` : 'Offline'; cls = 'configured'; } else if (cloud.remotePending) { label = 'Conflict'; cls = 'error'; } else if (cloud.status === 'syncing') { label = 'Syncing'; cls = 'syncing'; } else if (cloud.status === 'error') { label = 'Sync error'; cls = 'error'; } else if (cloud.user && cloudConfig.activated) { label = state.syncQueue.length ? `${state.syncQueue.length} pending` : 'Cloud'; cls = state.syncQueue.length ? 'syncing' : 'cloud'; } else if (cloud.user) { label = 'Connected'; cls = 'cloud'; } else if (cloudConfig.url && cloudConfig.key) { label = 'Sign in'; cls = 'configured'; }
    syncPill.innerHTML = `<span class="sync-dot ${cls}"></span><span>${escapeHtml(label)}</span>`;
  }

  function exportJson() { const blob = new Blob([JSON.stringify({ exportedAt: nowIso(), appVersion: APP_VERSION, state }, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `diet-copilot-backup-${localDateKey()}.json`; a.click(); URL.revokeObjectURL(url); showToast('Backup exported'); }
  async function importJson(e) { const file = e.target.files?.[0]; if (!file) return; try { const parsed = JSON.parse(await file.text()), candidate = parsed.state || parsed; if (!candidate.meals || !candidate.weights) throw new Error('Not a Diet Copilot backup'); if (!confirm('Replace local data with this backup? Cloud data is unchanged until you upload/sync.')) return; state = normalizeState(candidate); state.syncQueue = []; clearCloudBaselines(); cloudConfig.activated = false; saveCloudConfig(); saveState(); render(); showToast('Backup imported; cloud sync deactivated until you choose a sync direction'); } catch (err) { showToast(`Import failed: ${err.message}`); } finally { e.target.value = ''; } }
  async function copyDebugSummary() { const summary = { version: APP_VERSION, mode: cloud.user ? (cloudConfig.activated ? 'cloud-active' : 'cloud-connected') : 'local', online: isOnline(), meals: state.meals.length, mealItems: state.meals.reduce((a, m) => a + (m.items?.length || 0), 0), savedFoods: state.savedFoods.length, savedMeals: state.savedMeals.length, weights: state.weights.length, dayLogs: Object.keys(state.dayLogs).length, pendingSync: state.syncQueue.length, failedSync: state.syncQueue.filter(q => q.lastError).length, conflicts: state.syncQueue.filter(q => q.conflict).length, cloudBaselines: Object.keys(state.cloudBaselines || {}).length, aiActions: state.aiActions.length, remotePending: cloud.remotePending, cloudStatus: cloud.status, cloudError: cloud.error, cloudHealth: cloud.health, lastReleaseCheck: qaReport, runtimeWarnings }; try { await navigator.clipboard.writeText(JSON.stringify(summary, null, 2)); showToast('Diagnostic summary copied'); } catch { showToast(JSON.stringify(summary)); } }

  window.addEventListener('online', async () => { cloud.status = cloud.user ? 'connected' : (cloudConfig.url ? 'configured' : 'local'); updateSyncPill(); if (currentView === 'settings') renderSettings(); if (cloud.user && cloudConfig.activated) { await flushQueue(false); if (!state.syncQueue.length && !cloud.remotePending) await downloadCloudData(false, { silent: true, force: true }); } });
  window.addEventListener('offline', () => { if (cloudConfig.url || cloud.user) cloud.status = 'offline'; updateSyncPill(); if (currentView === 'settings') renderSettings(); });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; if (currentView === 'settings') renderSettings(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; showToast('Diet Copilot installed'); if (currentView === 'settings') renderSettings(); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed', err));

  [...new Set(state.meals.map(m => m.date))].forEach(date => ensureDayLog(date, false)); saveState();
  render(); initCloud(false);
