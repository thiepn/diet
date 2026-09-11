'use strict';
  function normalizeState(input) {
    const s = { ...clone(defaultState), ...(input || {}) };
    s.profile = { ...clone(defaultState.profile), ...(s.profile || {}) };
    s.meals = Array.isArray(s.meals) ? s.meals : [];
    s.weights = Array.isArray(s.weights) ? s.weights : [];
    s.savedFoods = Array.isArray(s.savedFoods) ? s.savedFoods : [];
    s.savedMeals = Array.isArray(s.savedMeals) ? s.savedMeals : [];
    s.aiActions = Array.isArray(s.aiActions) ? s.aiActions : [];
    s.dayLogs = s.dayLogs || s.dayStatus || {};
    s.changes = Array.isArray(s.changes) ? s.changes : [];
    s.syncQueue = Array.isArray(s.syncQueue) ? s.syncQueue : [];
    s.cloudBaselines = s.cloudBaselines && typeof s.cloudBaselines === 'object' && !Array.isArray(s.cloudBaselines) ? s.cloudBaselines : {};

    s.dayLogs = Object.fromEntries(Object.entries(s.dayLogs).map(([date, value]) => {
      if (value && typeof value === 'object') {
        return [date, {
          id: isUuid(value.id) ? value.id : newId(),
          status: value.status || 'partial',
          calorieTarget: Number(value.calorieTarget ?? s.profile.calorieTarget),
          proteinTarget: Number(value.proteinTarget ?? s.profile.proteinTarget),
          notes: value.notes || '',
          createdAt: value.createdAt || nowIso(),
          updatedAt: value.updatedAt || value.createdAt || nowIso()
        }];
      }
      return [date, { id: newId(), status: String(value || (date === localDateKey() ? 'open' : 'partial')), calorieTarget: Number(s.profile.calorieTarget), proteinTarget: Number(s.profile.proteinTarget), notes: '', createdAt: nowIso(), updatedAt: nowIso() }];
    }));

    const mealIdMap = new Map();
    s.meals = s.meals.map(m => {
      const old = m.id;
      const id = isUuid(old) ? old : newId();
      if (old) mealIdMap.set(old, id);
      let items = Array.isArray(m.items) ? m.items.map(i => normalizeItem(i, { confidence: m.confidence, source: m.source })) : [];
      if (!items.length) items = [normalizeItem(null, { name: m.title || 'Meal', calories: m.calories, protein: m.protein, confidence: m.confidence, source: m.source })];
      const totals = sumItems(items);
      return {
        ...m,
        id,
        date: m.date || localDateKey(),
        type: m.type || m.mealType || 'Other',
        title: m.title || 'Meal',
        items,
        calories: totals.calories,
        protein: totals.protein,
        caloriesLow: m.caloriesLow ?? m.calories_low ?? (items.some(i => i.caloriesLow != null || i.caloriesHigh != null) ? items.reduce((a,i)=>a+Number(i.caloriesLow ?? i.calories ?? 0),0) : null),
        caloriesHigh: m.caloriesHigh ?? m.calories_high ?? (items.some(i => i.caloriesLow != null || i.caloriesHigh != null) ? items.reduce((a,i)=>a+Number(i.caloriesHigh ?? i.calories ?? 0),0) : null),
        confidence: m.confidence || 'medium',
        source: m.source || 'text_estimate',
        originalInput: m.originalInput || '',
        notes: m.notes || '',
        createdAt: m.createdAt || nowIso(),
        updatedAt: m.updatedAt || m.createdAt || nowIso()
      };
    });

    const weightByDate = new Map();
    s.weights.forEach(w => weightByDate.set(w.date || localDateKey(), { ...w, id: isUuid(w.id) ? w.id : newId(), weight: Number(w.weight), createdAt: w.createdAt || w.created_at || nowIso(), updatedAt: w.updatedAt || w.updated_at || w.createdAt || w.created_at || nowIso() }));
    s.weights = [...weightByDate.values()];

    s.savedFoods = s.savedFoods.map(f => ({
      id: isUuid(f.id) ? f.id : newId(), name: String(f.name || 'Saved food'), quantity: String(f.quantity || ''), calories: Number(f.calories || 0), protein: Number(f.protein || 0), confidence: f.confidence || 'high', source: f.source || 'manual_exact', favorite: Boolean(f.favorite), useCount: Number(f.useCount || 0), lastUsedAt: f.lastUsedAt || null, createdAt: f.createdAt || nowIso(), updatedAt: f.updatedAt || f.createdAt || nowIso()
    }));
    s.savedMeals = s.savedMeals.map(sm => ({
      id: isUuid(sm.id) ? sm.id : newId(), name: String(sm.name || 'Saved meal'), mealType: sm.mealType || sm.type || 'Other', items: (Array.isArray(sm.items) && sm.items.length ? sm.items : [normalizeItem(null, { name: sm.name || 'Meal', calories: sm.calories, protein: sm.protein })]).map(i => normalizeItem(i)), favorite: Boolean(sm.favorite), useCount: Number(sm.useCount || 0), lastUsedAt: sm.lastUsedAt || null, createdAt: sm.createdAt || nowIso(), updatedAt: sm.updatedAt || sm.createdAt || nowIso()
    }));

    s.aiActions = s.aiActions.map(a => ({ ...a, id: isUuid(a.id) ? a.id : newId(), entityId: a.entityId || a.entity_id || null, actionType: a.actionType || a.action_type || '', entityType: a.entityType || a.entity_type || '', requestId: a.requestId || a.request_id || '', before: a.before ?? a.before_data ?? null, after: a.after ?? a.after_data ?? null, undoneAt: a.undoneAt || a.undone_at || null, createdAt: a.createdAt || a.created_at || nowIso() }));
    s.changes = s.changes.map(c => ({ ...c, id: isUuid(c.id) ? c.id : newId(), entityId: mealIdMap.get(c.entityId) || c.entityId || '' }));
    s.version = APP_VERSION;
    delete s.dayStatus;
    return s;
  }

