'use strict';
  function buildLocalAiContext(days = 14) {
    const endDate = localDateKey(), n = Math.max(1, Math.min(Number(days || 14), 90));
    const dates = Array.from({ length: n }, (_, i) => offsetDateKey(-(n - 1 - i)));
    const todayTotals = totalsFor(endDate), todayTargets = targetsFor(endDate);
    return {
      generated_at: nowIso(), end_date: endDate, days_requested: n,
      profile: clone(state.profile),
      today: { log_date: endDate, status: getStatus(endDate), calorie_target: todayTargets.calories, protein_target: todayTargets.protein, calories_consumed: todayTotals.calories, protein_consumed: todayTotals.protein, calories_remaining: todayTargets.calories - todayTotals.calories, meal_count: mealsFor(endDate).length },
      recent_days: dates.filter(d => state.dayLogs[d] || mealsFor(d).length).map(d => { const t = totalsFor(d), target = targetsFor(d); return { log_date: d, status: getStatus(d), calorie_target: target.calories, protein_target: target.protein, calories_consumed: t.calories, protein_consumed: t.protein, meal_count: mealsFor(d).length, calories_remaining: target.calories - t.calories }; }),
      recent_weights: [...state.weights].sort((a,b)=>a.date.localeCompare(b.date)).slice(-30),
      today_meals: mealsFor(endDate).map(m => ({ id:m.id, log_date:m.date, meal_type:m.type, title:m.title, calories:mealTotals(m).calories, protein:mealTotals(m).protein, calories_low:mealRange(m).low, calories_high:mealRange(m).high, confidence:m.confidence, source:m.source, original_input:m.originalInput, notes:m.notes, updated_at:m.updatedAt, items:clone(m.items) })),
      saved_foods: sortUsuals(state.savedFoods).slice(0,30),
      saved_meals: sortUsuals(state.savedMeals).slice(0,20),
      recent_ai_actions: [...state.aiActions].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,10)
    };
  }

  async function copyAiContext() {
    let payload;
    try {
      if (cloud.client && cloud.user && cloudConfig.activated) {
        const { data, error } = await cloud.client.rpc('get_diet_context', { p_end_date: localDateKey(), p_days: 14 });
        if (error) throw error;
        payload = data;
      } else payload = buildLocalAiContext(14);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast('14-day AI context copied');
    } catch (e) { showToast(`AI context failed: ${e.message || e}`); }
  }

  async function refreshAiActions(silent = false) {
    if (!cloud.client || !cloud.user || !cloudConfig.activated) { if (!silent) showToast('Cloud bridge is not active'); return; }
    try {
      const { data, error } = await cloud.client.from('ai_actions').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      state.aiActions = (data || []).map(a => ({ id:a.id, requestId:a.request_id, actionType:a.action_type, entityType:a.entity_type, entityId:a.entity_id, before:a.before_data, after:a.after_data, undoneAt:a.undone_at, createdAt:a.created_at }));
      saveState(); if (currentView === 'settings') renderSettings(); if (!silent) showToast('AI activity refreshed');
    } catch (e) { if (!silent) showToast(`AI activity failed: ${e.message || e}`); }
  }

  async function undoAiAction(id) {
    if (!cloud.client || !cloud.user || !cloudConfig.activated) return;
    if (state.syncQueue.length) { showToast('Sync local changes before undoing an AI action'); return; }
    if (!confirm('Undo this AI database action?')) return;
    setCloudBusy(true);
    try {
      const { error } = await cloud.client.rpc('undo_ai_action', { p_action_id: id }); if (error) throw error;
      cloud.remotePending = false; await downloadCloudData(false, { silent: true, force: true }); await refreshAiActions(true); showToast('AI action undone');
    } catch (e) { showToast(`Undo failed: ${e.message || e}`); }
    finally { cloud.busy = false; updateSyncPill(); if (currentView === 'settings') renderSettings(); }
  }

  async function resolveRemoteConflict(choice) {
    if (!cloud.client || !cloud.user) return;
    if (choice === 'cloud') {
      if (!confirm('Discard unsynced local changes and replace this device with cloud data?')) return;
      state.syncQueue = []; saveState(); cloud.remotePending = false; cloud.remoteEventCount = 0; await downloadCloudData(false, { silent: false, force: true });
      return;
    }
    await flushQueue(true, true);
    if (state.syncQueue.length) { showToast('Some local changes still failed to sync'); return; }
    cloud.remotePending = false; cloud.remoteEventCount = 0; await downloadCloudData(false, { silent: true, force: true }); showToast('Local edits won on edited rows; other cloud changes loaded');
  }

  async function installPwa() {
    if (window.matchMedia?.('(display-mode: standalone)').matches) { showToast('App is already installed'); return; }
    if (!deferredInstallPrompt) { showToast('Use your browser menu → Add to Home screen / Install app'); return; }
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; if (currentView === 'settings') renderSettings();
  }
