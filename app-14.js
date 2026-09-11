'use strict';
  function logChange(action, entity, entityId, before, after) {
    const item = { id: newId(), action, entity, entityId: String(entityId || ''), before: before || null, after: after || null, at: nowIso() }; state.changes.unshift(item); state.changes = state.changes.slice(0, 300);
    queueOp({ kind: 'upsert', table: 'change_log', payload: { id: item.id, entity: item.entity, entity_id: item.entityId, action: item.action, before_data: item.before, after_data: item.after, created_at: item.at } });
  }

  document.getElementById('addMealItemBtn').addEventListener('click', () => { mealEditorItems.push(normalizeItem(null, { name: '', calories: 0, protein: 0 })); renderItemEditor('mealItemsEditor', mealEditorItems, 'meal'); });
  document.getElementById('addSavedMealItemBtn').addEventListener('click', () => { savedMealEditorItems.push(normalizeItem(null, { name: '', calories: 0, protein: 0 })); renderItemEditor('savedMealItemsEditor', savedMealEditorItems, 'savedMeal'); });
  document.querySelectorAll('#quickTabs [data-quick]').forEach(b => b.addEventListener('click', () => { quickMode = b.dataset.quick; renderQuickLog(); }));

  document.getElementById('mealForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('mealId').value || newId(), existing = state.meals.find(m => m.id === id), date = document.getElementById('mealDate').value, day = ensureDayLog(date, false);
    const confidence = document.getElementById('mealConfidence').value, source = document.getElementById('mealSource').value, title = document.getElementById('mealTitle').value.trim();
    const items = cleanEditorItems(mealEditorItems, title, { confidence, source }).map(i => ({ ...i, confidence: i.confidence || confidence, source: i.source || source }));
    const totals = sumItems(items), range = rangeForItems(items);
    const next = { id, date, type: document.getElementById('mealType').value, title, items, calories: totals.calories, protein: totals.protein, caloriesLow: range.low, caloriesHigh: range.high, confidence, source, originalInput: document.getElementById('mealOriginalInput').value.trim(), notes: document.getElementById('mealNotes').value.trim(), createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() };
    if (existing) { const idx = state.meals.findIndex(m => m.id === id); state.meals[idx] = next; logChange('update', 'meal', id, existing, next); } else { state.meals.push(next); logChange('create', 'meal', id, null, next); }
    queueUpsertDay(date); queueMeal(next, day.id); queueMealItems(next, existing);
    if (document.getElementById('saveAsTemplate').checked) createOrUpdateTemplateFromMeal(next);
    saveState(); mealDialog.close(); render(); showToast(existing ? 'Meal updated' : 'Meal added'); flushQueue();
  });

  document.getElementById('deleteMealBtn').addEventListener('click', () => {
    const id = document.getElementById('mealId').value, meal = state.meals.find(m => m.id === id); if (!meal) return;
    lastDeleted = clone(meal); state.meals = state.meals.filter(m => m.id !== id); logChange('delete', 'meal', id, meal, null); queueDelete('meals', id); saveState(); mealDialog.close(); render(); showToast('Meal deleted', 'Undo', restoreDeletedMeal); flushQueue();
  });
