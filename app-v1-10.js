'use strict';

async function signUp(email, password) { if (!cloud.client) return; setCloudBusy(true); const { data, error } = await cloud.client.auth.signUp({ email, password }); setCloudBusy(false); if (error) { showToast(error.message); return; } cloud.user = data.user || null; showToast(data.session ? 'Account created and signed in' : 'Account created — check email if confirmation is enabled'); renderSettings(); }

async function signOut() { if (!cloud.client) return; if (state.syncQueue.length && !confirm('There are unsynced local changes. Sign out anyway? They remain in local data, but this cloud link will be deactivated so they cannot sync into a different account by mistake.')) return; await unsubscribeRealtime(); await cloud.client.auth.signOut(); cloud.user = null; cloud.status = 'configured'; cloudConfig.activated = false; state.syncQueue = []; clearCloudBaselines(); saveCloudConfig(); saveState(); updateSyncPill(); renderSettings(); showToast('Signed out; cloud sync deactivated'); }

function setCloudBusy(v) { cloud.busy = v; cloud.status = v ? 'syncing' : (cloud.user ? 'connected' : 'configured'); updateSyncPill(); }

async function flushQueue(force = false, allowConflictOverwrite = false) {
    if (!cloud.client || !cloud.user || (!cloudConfig.activated && !force) || cloud.busy || !state.syncQueue.length) return;
    if (!isOnline()) { cloud.status = 'offline'; updateSyncPill(); if (currentView === 'settings') renderSettings(); return; }
    const now = Date.now(), ready = state.syncQueue.filter(op => force || (Number(op.attempts || 0) < 5 && (!op.nextRetryAt || new Date(op.nextRetryAt).getTime() <= now)));
    if (!ready.length) { scheduleSyncRetry(); return; }
    setCloudBusy(true); let completed = 0, failed = null;
    try {
      for (const op of ready) {
        if (!allowConflictOverwrite && BASELINE_TABLES.has(op.table) && op.expectedUpdatedAt) {
          const remoteUpdatedAt = await fetchRemoteUpdatedAt(op);
          if (!sameServerVersion(remoteUpdatedAt, op.expectedUpdatedAt)) {
            const q = state.syncQueue.find(x => x.id === op.id);
            if (q) { q.conflict = true; q.attempts = 5; q.lastError = `${op.table}: cloud row changed since this device last synced`; q.nextRetryAt = null; }
            cloud.remotePending = true; cloud.remoteEventCount = Number(cloud.remoteEventCount || 0) + 1;
            saveState(); failed = q?.lastError || 'Cloud conflict'; break;
          }
        }
        let query;
        if (op.kind === 'delete') {
          query = op.table === 'profiles' ? cloud.client.from(op.table).delete().eq('user_id', cloud.user.id) : cloud.client.from(op.table).delete().eq('id', op.rowId);
          const { error } = await query;
          if (error) throw error;
          setCloudBaseline(op.table, op.rowId, null);
        } else {
          const payload = { ...op.payload, user_id: cloud.user.id };
          const onConflict = op.table === 'profiles' ? 'user_id' : op.table === 'daily_logs' ? 'user_id,log_date' : op.table === 'weight_entries' ? 'user_id,entry_date' : 'id';
          const selectCols = op.table === 'profiles' ? 'user_id,updated_at' : 'id,updated_at';
          const { data, error } = await cloud.client.from(op.table).upsert(payload, { onConflict }).select(selectCols).maybeSingle();
          if (error) throw error;
          setCloudBaseline(op.table, op.rowId, data?.updated_at || op.payload?.updated_at || nowIso());
        }
        state.syncQueue = state.syncQueue.filter(q => q.id !== op.id); completed++; saveState();
      }
      if (failed) {
        cloud.status = cloud.remotePending ? 'conflict' : 'error'; cloud.error = failed;
        if (!cloud.remotePending) scheduleSyncRetry();
        showToast(cloud.remotePending ? 'Sync conflict detected — choose a resolution in Settings' : `Sync paused: ${failed}`);
      } else { cloud.status = 'synced'; cloud.lastSyncAt = nowIso(); cloud.error = null; if (completed) showToast(`Synced ${completed} change${completed === 1 ? '' : 's'}`); }
    } catch (e) {
      const current = ready.find(op => state.syncQueue.some(q => q.id === op.id));
      const q = current ? state.syncQueue.find(x => x.id === current.id) : null;
      if (q) { q.attempts = Number(q.attempts || 0) + 1; q.lastError = `${q.table}: ${e.message || e}`; const delays = [5000,15000,60000,300000]; q.nextRetryAt = new Date(Date.now() + delays[Math.min(q.attempts - 1, delays.length - 1)]).toISOString(); }
      saveState(); cloud.status = 'error'; cloud.error = e.message || String(e); scheduleSyncRetry(); showToast(`Sync paused: ${cloud.error}`);
    } finally { cloud.busy = false; updateSyncPill(); if (currentView === 'settings') renderSettings(); drainDeferredRefresh(); }
  }

function scheduleSyncRetry() {
    clearTimeout(syncRetryTimer);
    if (!cloud.client || !cloud.user || !cloudConfig.activated || !state.syncQueue.length) return;
    const times = state.syncQueue.filter(q => Number(q.attempts || 0) < 5).map(q => q.nextRetryAt ? new Date(q.nextRetryAt).getTime() : Date.now()).filter(Number.isFinite);
    if (!times.length) return;
    const wait = Math.max(1000, Math.min(300000, Math.min(...times) - Date.now()));
    syncRetryTimer = setTimeout(() => flushQueue(false), wait);
  }

async function uploadLocalData() {
    if (!cloud.client || !cloud.user) return; if (!isOnline()) { showToast('You are offline — cloud upload will be available after reconnecting'); return; } if (!(await verifyCloudSchema(true))) return; if (!confirm('Replace this account\'s cloud Diet Copilot dataset with the data currently on this device?')) return;
    setCloudBusy(true);
    try {
      const uid = cloud.user.id;
      for (const table of ['ai_actions', 'change_log', 'saved_meals', 'saved_foods', 'weight_entries', 'daily_logs', 'profiles']) { const { error } = await cloud.client.from(table).delete().eq('user_id', uid); if (error) throw error; }
      let r = await cloud.client.from('profiles').upsert({ user_id: uid, calorie_target: Number(state.profile.calorieTarget), protein_target: Number(state.profile.proteinTarget), goal_weight: state.profile.goalWeight ?? null, updated_at: nowIso() }, { onConflict: 'user_id' }); if (r.error) throw r.error;
      const dates = [...new Set([...Object.keys(state.dayLogs), ...state.meals.map(m => m.date)])]; dates.forEach(d => ensureDayLog(d, false));
      const dayRows = Object.entries(state.dayLogs).map(([date, d]) => ({ id: d.id, user_id: uid, log_date: date, calorie_target: Number(d.calorieTarget), protein_target: Number(d.proteinTarget), status: d.status || 'partial', notes: d.notes || null, created_at: d.createdAt || nowIso(), updated_at: d.updatedAt || nowIso() }));
      if (dayRows.length) { r = await cloud.client.from('daily_logs').upsert(dayRows, { onConflict: 'user_id,log_date' }); if (r.error) throw r.error; }
      const dayByDate = Object.fromEntries(Object.entries(state.dayLogs).map(([date, d]) => [date, d.id]));
      const foodRows = state.savedFoods.map(f => ({ id: f.id, user_id: uid, name: f.name, quantity_text: f.quantity || null, calories: Number(f.calories), protein: Number(f.protein), confidence: f.confidence, source: f.source, favorite: Boolean(f.favorite), use_count: Number(f.useCount || 0), last_used_at: f.lastUsedAt || null, created_at: f.createdAt || nowIso(), updated_at: f.updatedAt || nowIso() }));
      if (foodRows.length) { r = await cloud.client.from('saved_foods').upsert(foodRows, { onConflict: 'id' }); if (r.error) throw r.error; }
      const mealRows = state.meals.map(m => { const t = mealTotals(m); return { id: m.id, user_id: uid, daily_log_id: dayByDate[m.date], meal_type: m.type, title: m.title, calories: Number(t.calories), protein: Number(t.protein), confidence: m.confidence || 'medium', source: m.source || 'text_estimate', original_input: m.originalInput || null, notes: m.notes || null, calories_low: mealRange(m).low, calories_high: mealRange(m).high, eaten_at: `${m.date}T12:00:00`, created_at: m.createdAt || nowIso(), updated_at: m.updatedAt || nowIso() }; });
      if (mealRows.length) { r = await cloud.client.from('meals').upsert(mealRows, { onConflict: 'id' }); if (r.error) throw r.error; }
      const mealItemRows = state.meals.flatMap(m => (m.items || []).map((i, idx) => ({ id: i.id, user_id: uid, meal_id: m.id, saved_food_id: i.savedFoodId || null, name: i.name, quantity_text: i.quantity || null, calories: Number(i.calories || 0), protein: Number(i.protein || 0), calories_low: i.caloriesLow ?? null, calories_high: i.caloriesHigh ?? null, confidence: i.confidence || m.confidence || 'medium', source: i.source || m.source || 'text_estimate', sort_order: idx, updated_at: nowIso() })));
      if (mealItemRows.length) { r = await cloud.client.from('meal_items').upsert(mealItemRows, { onConflict: 'id' }); if (r.error) throw r.error; }
      const weightRows = state.weights.map(w => ({ id: w.id, user_id: uid, entry_date: w.date, weight: Number(w.weight), notes: w.notes || null, created_at: w.createdAt || nowIso(), updated_at: w.updatedAt || nowIso() }));
      if (weightRows.length) { r = await cloud.client.from('weight_entries').upsert(weightRows, { onConflict: 'user_id,entry_date' }); if (r.error) throw r.error; }
      const savedMealRows = state.savedMeals.map(sm => ({ id: sm.id, user_id: uid, name: sm.name, meal_type: sm.mealType, favorite: Boolean(sm.favorite), use_count: Number(sm.useCount || 0), last_used_at: sm.lastUsedAt || null, created_at: sm.createdAt || nowIso(), updated_at: sm.updatedAt || nowIso() }));
      if (savedMealRows.length) { r = await cloud.client.from('saved_meals').upsert(savedMealRows, { onConflict: 'id' }); if (r.error) throw r.error; }
      const savedMealItemRows = state.savedMeals.flatMap(sm => sm.items.map((i, idx) => ({ id: i.id, user_id: uid, saved_meal_id: sm.id, saved_food_id: i.savedFoodId || null, name: i.name, quantity_text: i.quantity || null, calories: Number(i.calories || 0), protein: Number(i.protein || 0), calories_low: i.caloriesLow ?? null, calories_high: i.caloriesHigh ?? null, confidence: i.confidence || 'high', source: i.source || 'saved_food', sort_order: idx, updated_at: nowIso() })));
      if (savedMealItemRows.length) { r = await cloud.client.from('saved_meal_items').upsert(savedMealItemRows, { onConflict: 'id' }); if (r.error) throw r.error; }
      state.syncQueue = []; state.aiActions = []; clearCloudBaselines(); cloudConfig.activated = true; saveCloudConfig(); saveState(); cloud.status = 'synced'; cloud.lastSyncAt = nowIso(); await subscribeRealtime(); await downloadCloudData(false, { silent: true, force: true }); showToast('Local data uploaded; automatic sync enabled');
    } catch (e) { cloud.status = 'error'; cloud.error = e.message || String(e); showToast(`Upload failed: ${cloud.error}`); }
    finally { cloud.busy = false; updateSyncPill(); if (currentView === 'settings') renderSettings(); drainDeferredRefresh(); }
  }
