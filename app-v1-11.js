'use strict';

async function downloadCloudData(confirmReplace = true, options = {}) {
    if (!cloud.client || !cloud.user) return; if (!isOnline()) { if (!options.silent) showToast('You are offline — cloud data cannot be downloaded yet'); cloud.status = 'offline'; updateSyncPill(); return; } if ((!cloud.health || Number(cloud.health.schema_version) < DB_SCHEMA_VERSION) && !(await verifyCloudSchema(!options.silent))) return; if (confirmReplace && !confirm('Replace this device\'s local Diet Copilot data with the current cloud dataset? A local safety backup will be created first.')) return;
    if (confirmReplace && !prepareDestructiveAction('before cloud download')) return;
    if (state.syncQueue.length && !confirmReplace && !options.force) return;
    setCloudBusy(true);
    try {
      const [p, d, m, mi, w, sf, sm, smi, aa] = await Promise.all([
        cloud.client.from('profiles').select('*').maybeSingle(), cloud.client.from('daily_logs').select('*').order('log_date'), cloud.client.from('meals').select('*').order('created_at'), cloud.client.from('meal_items').select('*').order('sort_order'), cloud.client.from('weight_entries').select('*').order('entry_date'), cloud.client.from('saved_foods').select('*').order('name'), cloud.client.from('saved_meals').select('*').order('name'), cloud.client.from('saved_meal_items').select('*').order('sort_order'), cloud.client.from('ai_actions').select('*').order('created_at', { ascending: false }).limit(50)
      ]);
      for (const res of [p, d, m, mi, w, sf, sm, smi, aa]) if (res.error) throw res.error;
      const remoteHasData = Boolean(p.data || d.data?.length || m.data?.length || w.data?.length || sf.data?.length || sm.data?.length);
      if (!remoteHasData) { if (confirmReplace) showToast('Cloud account has no diet data yet'); cloud.status = 'connected'; return; }
      const dayLogs = {}, dayDateById = {}, itemsByMeal = {}, itemsBySavedMeal = {};
      (d.data || []).forEach(x => { dayLogs[x.log_date] = { id: x.id, status: x.status, calorieTarget: Number(x.calorie_target), proteinTarget: Number(x.protein_target), notes: x.notes || '', createdAt: x.created_at, updatedAt: x.updated_at }; dayDateById[x.id] = x.log_date; });
      (mi.data || []).forEach(x => { (itemsByMeal[x.meal_id] ||= []).push(normalizeItem({ id: x.id, name: x.name, quantity: x.quantity_text || '', calories: Number(x.calories), protein: Number(x.protein), caloriesLow: x.calories_low, caloriesHigh: x.calories_high, confidence: x.confidence, source: x.source, savedFoodId: x.saved_food_id })); });
      (smi.data || []).forEach(x => { (itemsBySavedMeal[x.saved_meal_id] ||= []).push(normalizeItem({ id: x.id, name: x.name, quantity: x.quantity_text || '', calories: Number(x.calories), protein: Number(x.protein), caloriesLow: x.calories_low, caloriesHigh: x.calories_high, confidence: x.confidence, source: x.source, savedFoodId: x.saved_food_id })); });
      const next = clone(defaultState); next.profile = { ...next.profile, calorieTarget: Number(p.data?.calorie_target ?? 2300), proteinTarget: Number(p.data?.protein_target ?? 160), goalWeight: p.data?.goal_weight == null ? null : Number(p.data.goal_weight), targetsConfirmed: Boolean(p.data || remoteHasData) }; next.dayLogs = dayLogs;
      next.meals = (m.data || []).map(x => { const items = itemsByMeal[x.id]?.length ? itemsByMeal[x.id] : [normalizeItem(null, { name: x.title, calories: x.calories, protein: x.protein, confidence: x.confidence, source: x.source })]; const t = sumItems(items); return { id: x.id, date: dayDateById[x.daily_log_id] || String(x.eaten_at || '').slice(0, 10) || localDateKey(), type: x.meal_type, title: x.title, items, calories: t.calories, protein: t.protein, caloriesLow: x.calories_low, caloriesHigh: x.calories_high, confidence: x.confidence, source: x.source, originalInput: x.original_input || '', notes: x.notes || '', createdAt: x.created_at, updatedAt: x.updated_at }; });
      next.weights = (w.data || []).map(x => ({ id: x.id, date: x.entry_date, weight: Number(x.weight), notes: x.notes || '', createdAt: x.created_at, updatedAt: x.updated_at || x.created_at }));
      next.savedFoods = (sf.data || []).map(x => ({ id: x.id, name: x.name, quantity: x.quantity_text || '', calories: Number(x.calories), protein: Number(x.protein), confidence: x.confidence, source: x.source, favorite: Boolean(x.favorite), useCount: Number(x.use_count || 0), lastUsedAt: x.last_used_at, createdAt: x.created_at, updatedAt: x.updated_at }));
      next.savedMeals = (sm.data || []).map(x => ({ id: x.id, name: x.name, mealType: x.meal_type, items: itemsBySavedMeal[x.id] || [], favorite: Boolean(x.favorite), useCount: Number(x.use_count || 0), lastUsedAt: x.last_used_at, createdAt: x.created_at, updatedAt: x.updated_at }));
      next.aiActions = (aa.data || []).map(a => ({ id:a.id, requestId:a.request_id, actionType:a.action_type, entityType:a.entity_type, entityId:a.entity_id, before:a.before_data, after:a.after_data, undoneAt:a.undone_at, createdAt:a.created_at }));
      next.syncQueue = []; next.version = STATE_VERSION; state = normalizeState(next); cloudConfig.activated = true; saveCloudConfig();
      clearCloudBaselines();
      if (p.data?.updated_at) setCloudBaseline('profiles', 'profile', p.data.updated_at);
      (d.data || []).forEach(x => setCloudBaseline('daily_logs', x.id, x.updated_at));
      (m.data || []).forEach(x => setCloudBaseline('meals', x.id, x.updated_at));
      (mi.data || []).forEach(x => setCloudBaseline('meal_items', x.id, x.updated_at));
      (w.data || []).forEach(x => setCloudBaseline('weight_entries', x.id, x.updated_at || x.created_at));
      (sf.data || []).forEach(x => setCloudBaseline('saved_foods', x.id, x.updated_at));
      (sm.data || []).forEach(x => setCloudBaseline('saved_meals', x.id, x.updated_at));
      (smi.data || []).forEach(x => setCloudBaseline('saved_meal_items', x.id, x.updated_at));
      // Backfill item rows for meals created under V0.2, which only stored aggregate totals.
      state.meals.filter(meal => !(itemsByMeal[meal.id]?.length)).forEach(meal => queueMealItems(meal, null));
      saveState(); cloud.status = 'synced'; cloud.lastSyncAt = nowIso(); cloud.remotePending = false; cloud.remoteEventCount = 0; cloud.deferredRefresh = false; render(); if (confirmReplace && !options.silent) showToast('Cloud data loaded');
    } catch (e) { cloud.status = 'error'; cloud.error = e.message || String(e); if (!options.silent) showToast(`Download failed: ${cloud.error}`); }
    finally { cloud.busy = false; updateSyncPill(); if (currentView === 'settings') renderSettings(); if (state.syncQueue.length) setTimeout(() => flushQueue(), 0); }
  }


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

function exportJson() {
    const blob = new Blob([JSON.stringify({ exportedAt: nowIso(), appVersion: RELEASE_VERSION, stateVersion: STATE_VERSION, state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `diet-copilot-backup-${localDateKey()}.json`; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('Backup exported');
  }

async function importJson(e) { const file = e.target.files?.[0]; if (!file) return; try { const parsed = JSON.parse(await file.text()), candidate = parsed.state || parsed; if (!candidate.meals || !candidate.weights) throw new Error('Not a Diet Copilot backup'); if (!confirm('Replace local data with this backup? Cloud data is unchanged until you upload/sync.')) return; if (!prepareDestructiveAction('before JSON import')) return; state = normalizeState(candidate); state.syncQueue = []; clearCloudBaselines(); cloudConfig.activated = false; await unsubscribeRealtime(); saveCloudConfig(); saveState(); render(); showToast('Backup imported; cloud sync deactivated until you choose a sync direction'); } catch (err) { showToast(`Import failed: ${err.message}`); } finally { e.target.value = ''; } }

async function copyDebugSummary() { const summary = { releaseVersion: RELEASE_VERSION, stateVersion: STATE_VERSION, databaseSchemaVersion: DB_SCHEMA_VERSION, mode: cloud.user ? (cloudConfig.activated ? 'cloud-active' : 'cloud-connected') : 'local', online: isOnline(), meals: state.meals.length, mealItems: state.meals.reduce((a, m) => a + (m.items?.length || 0), 0), savedFoods: state.savedFoods.length, savedMeals: state.savedMeals.length, weights: state.weights.length, dayLogs: Object.keys(state.dayLogs).length, pendingSync: state.syncQueue.length, failedSync: state.syncQueue.filter(q => q.lastError).length, conflicts: state.syncQueue.filter(q => q.conflict).length, cloudBaselines: Object.keys(state.cloudBaselines || {}).length, aiActions: state.aiActions.length, remotePending: cloud.remotePending, cloudStatus: cloud.status, cloudError: cloud.error, cloudHealth: cloud.health, lastReleaseCheck: qaReport, runtimeWarnings }; try { await copyText(JSON.stringify(summary, null, 2)); showToast('Diagnostic summary copied'); } catch { showToast('Could not copy diagnostic summary'); } }

