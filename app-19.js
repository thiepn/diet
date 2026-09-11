'use strict';
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

