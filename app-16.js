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
    const meal = { id: newId(), date: localDateKey(), type: sm.mealType, title: sm.name, items, calories: totals.calories, protein: totals.protein, caloriesLow: range.low, caloriesHigh: range.high, confidence: 'high', source: 'saved_food', originalInput: 'Quick log from saved meal', notes: '', createdAt: nowIso(), updatedAt: nowIso() };
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

  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => document.getElementById(btn.dataset.close).close()));
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  document.getElementById('weightQuickBtn').addEventListener('click', openWeightDialog);
  syncPill.addEventListener('click', () => setView('settings'));

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
