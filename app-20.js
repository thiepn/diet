'use strict';
  async function downloadCloudData(confirmReplace = true, options = {}) {
    if (!cloud.client || !cloud.user) return; if (!isOnline()) { if (!options.silent) showToast('You are offline — cloud data cannot be downloaded yet'); cloud.status = 'offline'; updateSyncPill(); return; } if ((!cloud.health || Number(cloud.health.schema_version) < 5) && !(await verifyCloudSchema(!options.silent))) return; if (confirmReplace && !confirm('Replace this device\'s local Diet Copilot data with the current cloud dataset? Export a backup first if needed.')) return;
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
      const next = clone(defaultState); next.profile = { ...next.profile, calorieTarget: Number(p.data?.calorie_target ?? 2300), proteinTarget: Number(p.data?.protein_target ?? 160), goalWeight: p.data?.goal_weight == null ? null : Number(p.data.goal_weight) }; next.dayLogs = dayLogs;
      next.meals = (m.data || []).map(x => { const items = itemsByMeal[x.id]?.length ? itemsByMeal[x.id] : [normalizeItem(null, { name: x.title, calories: x.calories, protein: x.protein, confidence: x.confidence, source: x.source })]; const t = sumItems(items); return { id: x.id, date: dayDateById[x.daily_log_id] || String(x.eaten_at || '').slice(0, 10) || localDateKey(), type: x.meal_type, title: x.title, items, calories: t.calories, protein: t.protein, caloriesLow: x.calories_low, caloriesHigh: x.calories_high, confidence: x.confidence, source: x.source, originalInput: x.original_input || '', notes: x.notes || '', createdAt: x.created_at, updatedAt: x.updated_at }; });
      next.weights = (w.data || []).map(x => ({ id: x.id, date: x.entry_date, weight: Number(x.weight), notes: x.notes || '', createdAt: x.created_at, updatedAt: x.updated_at || x.created_at }));
      next.savedFoods = (sf.data || []).map(x => ({ id: x.id, name: x.name, quantity: x.quantity_text || '', calories: Number(x.calories), protein: Number(x.protein), confidence: x.confidence, source: x.source, favorite: Boolean(x.favorite), useCount: Number(x.use_count || 0), lastUsedAt: x.last_used_at, createdAt: x.created_at, updatedAt: x.updated_at }));
      next.savedMeals = (sm.data || []).map(x => ({ id: x.id, name: x.name, mealType: x.meal_type, items: itemsBySavedMeal[x.id] || [], favorite: Boolean(x.favorite), useCount: Number(x.use_count || 0), lastUsedAt: x.last_used_at, createdAt: x.created_at, updatedAt: x.updated_at }));
      next.aiActions = (aa.data || []).map(a => ({ id:a.id, requestId:a.request_id, actionType:a.action_type, entityType:a.entity_type, entityId:a.entity_id, before:a.before_data, after:a.after_data, undoneAt:a.undone_at, createdAt:a.created_at }));
      next.syncQueue = []; next.version = APP_VERSION; state = normalizeState(next); cloudConfig.activated = true; saveCloudConfig();
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
