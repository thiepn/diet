'use strict';

function logSavedFood(id) {
    const f = state.savedFoods.find(x => x.id === id); if (!f) return;
    const item = normalizeItem({ name: f.name, quantity: f.quantity, calories: f.calories, protein: f.protein, confidence: f.confidence, source: 'saved_food', savedFoodId: f.id });
    const meal = { id: newId(), date: localDateKey(), type: guessMealType(), title: f.name, items: [item], calories: f.calories, protein: f.protein, caloriesLow: item.caloriesLow ?? null, caloriesHigh: item.caloriesHigh ?? null, confidence: f.confidence, source: 'saved_food', originalInput: 'Quick log from saved food', notes: '', createdAt: nowIso(), updatedAt: nowIso() };
    markSavedFoodUsed(f); persistQuickMeal(meal); showToast(`${f.name} logged`);
  }

function logSavedMeal(id) {
    const sm = state.savedMeals.find(x => x.id === id); if (!sm) return;
    const items = clone(sm.items).map(i => ({ ...i, id: newId(), source: i.source || 'saved_food' })), totals = sumItems(items), range = rangeForItems(items);
    const meal = { id: newId(), date: localDateKey(), type: sm.mealType, title: sm.name, items, calories: totals.calories, protein: totals.protein, caloriesLow: range.low, caloriesHigh: range.high, confidence: aggregateConfidence(items), source: 'saved_food', originalInput: 'Quick log from saved meal', notes: '', createdAt: nowIso(), updatedAt: nowIso() };
    markSavedMealUsed(sm); persistQuickMeal(meal); showToast(`${sm.name} logged`);
  }

function copyMealToToday(id) {
    const old = state.meals.find(x => x.id === id); if (!old) return;
    const items = clone(old.items).map(i => ({ ...i, id: newId() })), totals = sumItems(items), range = rangeForItems(items);
    const meal = { ...clone(old), id: newId(), date: localDateKey(), items, calories: totals.calories, protein: totals.protein, caloriesLow: range.low, caloriesHigh: range.high, originalInput: `Repeated from ${old.date}`, createdAt: nowIso(), updatedAt: nowIso() };
    persistQuickMeal(meal); showToast(`${old.title} repeated`);
  }

function persistQuickMeal(meal) {
    const day = ensureDayLog(meal.date, false); state.meals.push(meal); logChange('create', 'meal', meal.id, null, meal); queueUpsertDay(meal.date); queueMeal(meal, day.id); queueMealItems(meal, null); saveState(); render(); flushQueue();
  }

function markSavedFoodUsed(f) { const before = clone(f); f.useCount = Number(f.useCount || 0) + 1; f.lastUsedAt = nowIso(); f.updatedAt = nowIso(); logChange('use', 'saved_food', f.id, before, f); queueSavedFood(f); saveState(); }

function markSavedMealUsed(sm) { const before = clone(sm); sm.useCount = Number(sm.useCount || 0) + 1; sm.lastUsedAt = nowIso(); sm.updatedAt = nowIso(); logChange('use', 'saved_meal', sm.id, before, sm); queueSavedMeal(sm, before); saveState(); }

function queueOp(op) {
    if (!cloudConfig.activated) return;
    const existing = op.rowId ? state.syncQueue.find(q => q.table === op.table && q.rowId === op.rowId) : null;
    const expectedUpdatedAt = existing?.expectedUpdatedAt ?? (op.rowId ? getCloudBaseline(op.table, op.rowId) : null) ?? null;
    if (op.rowId) state.syncQueue = state.syncQueue.filter(q => !(q.table === op.table && q.rowId === op.rowId));
    // A row created only on this device and deleted before first sync never needs a remote delete.
    if (existing?.kind === 'upsert' && op.kind === 'delete' && !expectedUpdatedAt) return;
    state.syncQueue.push({ id: newId(), at: nowIso(), attempts: 0, lastError: null, nextRetryAt: null, conflict: false, expectedUpdatedAt, ...op });
  }

function queueProfile() { queueOp({ kind: 'upsert', table: 'profiles', rowId: 'profile', payload: { calorie_target: Number(state.profile.calorieTarget), protein_target: Number(state.profile.proteinTarget), goal_weight: state.profile.goalWeight ?? null, updated_at: nowIso() } }); }

function queueUpsertDay(date) { const d = state.dayLogs[date]; if (!d) return; queueOp({ kind: 'upsert', table: 'daily_logs', rowId: d.id, payload: { id: d.id, log_date: date, calorie_target: Number(d.calorieTarget), protein_target: Number(d.proteinTarget), status: d.status || 'open', notes: d.notes || null, created_at: d.createdAt || nowIso(), updated_at: d.updatedAt || nowIso() } }); }

function queueMeal(m, dayId) { const t = mealTotals(m); queueOp({ kind: 'upsert', table: 'meals', rowId: m.id, payload: { id: m.id, daily_log_id: dayId, meal_type: m.type, title: m.title, calories: Number(t.calories), protein: Number(t.protein), confidence: m.confidence || 'medium', source: m.source || 'text_estimate', original_input: m.originalInput || null, notes: m.notes || null, calories_low: mealRange(m).low, calories_high: mealRange(m).high, eaten_at: `${m.date}T12:00:00`, created_at: m.createdAt || nowIso(), updated_at: m.updatedAt || nowIso() } }); }

function queueMealItems(next, previous) {
    const nextIds = new Set((next.items || []).map(i => i.id));
    (previous?.items || []).filter(i => !nextIds.has(i.id)).forEach(i => queueDelete('meal_items', i.id));
    (next.items || []).forEach((i, idx) => queueOp({ kind: 'upsert', table: 'meal_items', rowId: i.id, payload: { id: i.id, meal_id: next.id, saved_food_id: i.savedFoodId || null, name: i.name, quantity_text: i.quantity || null, calories: Number(i.calories || 0), protein: Number(i.protein || 0), calories_low: i.caloriesLow ?? null, calories_high: i.caloriesHigh ?? null, confidence: i.confidence || next.confidence || 'medium', source: i.source || next.source || 'text_estimate', sort_order: idx, updated_at: nowIso() } }));
  }

function queueWeight(w) { queueOp({ kind: 'upsert', table: 'weight_entries', rowId: w.id, payload: { id: w.id, entry_date: w.date, weight: Number(w.weight), notes: w.notes || null, created_at: w.createdAt || nowIso(), updated_at: w.updatedAt || nowIso() } }); }


'use strict';

function queueSavedFood(f) { queueOp({ kind: 'upsert', table: 'saved_foods', rowId: f.id, payload: { id: f.id, name: f.name, quantity_text: f.quantity || null, calories: Number(f.calories || 0), protein: Number(f.protein || 0), confidence: f.confidence || 'high', source: f.source || 'manual_exact', favorite: Boolean(f.favorite), use_count: Number(f.useCount || 0), last_used_at: f.lastUsedAt || null, created_at: f.createdAt || nowIso(), updated_at: f.updatedAt || nowIso() } }); }

function queueSavedMeal(sm, previous) {
    queueOp({ kind: 'upsert', table: 'saved_meals', rowId: sm.id, payload: { id: sm.id, name: sm.name, meal_type: sm.mealType, favorite: Boolean(sm.favorite), use_count: Number(sm.useCount || 0), last_used_at: sm.lastUsedAt || null, created_at: sm.createdAt || nowIso(), updated_at: sm.updatedAt || nowIso() } });
    const nextIds = new Set((sm.items || []).map(i => i.id)); (previous?.items || []).filter(i => !nextIds.has(i.id)).forEach(i => queueDelete('saved_meal_items', i.id));
    (sm.items || []).forEach((i, idx) => queueOp({ kind: 'upsert', table: 'saved_meal_items', rowId: i.id, payload: { id: i.id, saved_meal_id: sm.id, saved_food_id: i.savedFoodId || null, name: i.name, quantity_text: i.quantity || null, calories: Number(i.calories || 0), protein: Number(i.protein || 0), calories_low: i.caloriesLow ?? null, calories_high: i.caloriesHigh ?? null, confidence: i.confidence || 'high', source: i.source || 'saved_food', sort_order: idx, updated_at: nowIso() } }));
  }

function queueDelete(table, id) {
    if (table === 'meals') state.syncQueue = state.syncQueue.filter(q => !(q.table === 'meal_items' && q.payload?.meal_id === id));
    if (table === 'saved_meals') state.syncQueue = state.syncQueue.filter(q => !(q.table === 'saved_meal_items' && q.payload?.saved_meal_id === id));
    if (table === 'saved_foods') state.syncQueue.forEach(q => { if ((q.table === 'meal_items' || q.table === 'saved_meal_items') && q.payload?.saved_food_id === id) q.payload.saved_food_id = null; });
    queueOp({ kind: 'delete', table, rowId: id });
  }

async function verifyCloudSchema(showFeedback = false) {
    if (!cloud.client || !cloud.user) return false;
    if (!isOnline()) { if (showFeedback) showToast('Offline — cloud schema cannot be verified yet'); return false; }
    try {
      const { data, error } = await cloud.client.rpc('diet_copilot_healthcheck');
      if (error) throw error;
      const caps = data?.capabilities || {};
      const required = ['get_diet_context','search_diet_history','log_meal_from_ai','update_meal_from_ai','delete_meal_from_ai','log_weight_from_ai','undo_ai_action'];
      const missing = required.filter(k => caps[k] !== true);
      if (Number(data?.schema_version) < DB_SCHEMA_VERSION || missing.length) throw new Error(`Diet Copilot cloud schema v${DB_SCHEMA_VERSION} required${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
      cloud.health = data; cloud.healthCheckedAt = nowIso(); return true;
    } catch (e) {
      cloud.status = 'error'; cloud.error = `Cloud schema check failed: ${e.message || e}`; updateSyncPill(); if (showFeedback) showToast('Install the required Diet Copilot Supabase schema before enabling sync'); return false;
    }
  }

async function initCloud(showFeedback = false) {
    cloud.error = null;
    if (!cloudConfig.url || !cloudConfig.key) { await disposeCloudClient(); cloud = createCloudState(); updateSyncPill(); return; }
    if (!window.supabase?.createClient) { cloud.status = 'error'; cloud.error = 'Supabase SDK did not load'; updateSyncPill(); if (showFeedback) showToast('Supabase SDK could not load; local mode still works'); return; }
    try {
      await disposeCloudClient();
      cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data, error } = await cloud.client.auth.getSession(); if (error) throw error; cloud.user = data.session?.user || null; cloud.status = cloud.user ? 'connected' : 'configured';
      const { data: authListener } = cloud.client.auth.onAuthStateChange((_event, session) => {
        const previousUserId = cloud.user?.id || null;
        cloud.user = session?.user || null;
        cloud.status = cloud.user ? 'connected' : 'configured';
        updateSyncPill();
        if (!cloud.user) unsubscribeRealtime();
        else if (cloudConfig.activated && cloud.user.id !== previousUserId) subscribeRealtime();
        if (currentView === 'settings') renderSettings();
      });
      cloud.authSubscription = authListener?.subscription || null;
      updateSyncPill(); if (showFeedback) showToast(cloud.user ? 'Supabase connected' : 'Supabase configured — sign in next');
      if (cloud.user && cloudConfig.activated) { if (isOnline() && !(await verifyCloudSchema(showFeedback))) return; await flushQueue(); if (!state.syncQueue.length && !cloud.remotePending) await downloadCloudData(false, { silent: true }); subscribeRealtime(); }
    } catch (e) { cloud.status = 'error'; cloud.error = e.message || String(e); updateSyncPill(); if (showFeedback) showToast(`Cloud connection failed: ${cloud.error}`); }
  }

async function signIn(email, password) { if (!cloud.client) return; setCloudBusy(true); const { data, error } = await cloud.client.auth.signInWithPassword({ email, password }); setCloudBusy(false); if (error) { showToast(error.message); return; } cloud.user = data.user; cloud.status = 'connected'; showToast('Signed in'); renderSettings(); if (cloudConfig.activated) { if (isOnline() && !(await verifyCloudSchema(true))) return; await flushQueue(); if (!state.syncQueue.length && !cloud.remotePending) await downloadCloudData(false, { silent: true }); subscribeRealtime(); } }


