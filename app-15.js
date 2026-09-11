'use strict';
  function restoreDeletedMeal() { if (!lastDeleted) return; state.meals.push(lastDeleted); const day = ensureDayLog(lastDeleted.date, false); logChange('restore', 'meal', lastDeleted.id, null, lastDeleted); queueUpsertDay(lastDeleted.date); queueMeal(lastDeleted, day.id); queueMealItems(lastDeleted, null); saveState(); lastDeleted = null; render(); flushQueue(); }

  document.getElementById('savedFoodForm').addEventListener('submit', e => {
    e.preventDefault(); const id = document.getElementById('savedFoodId').value || newId(), existing = state.savedFoods.find(f => f.id === id);
    const next = { id, name: document.getElementById('savedFoodName').value.trim(), quantity: document.getElementById('savedFoodQuantity').value.trim(), calories: Number(document.getElementById('savedFoodCalories').value || 0), protein: Number(document.getElementById('savedFoodProtein').value || 0), confidence: document.getElementById('savedFoodConfidence').value, source: document.getElementById('savedFoodSource').value, favorite: document.getElementById('savedFoodFavorite').checked, useCount: existing?.useCount || 0, lastUsedAt: existing?.lastUsedAt || null, createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() };
    if (existing) state.savedFoods[state.savedFoods.findIndex(f => f.id === id)] = next; else state.savedFoods.push(next);
    logChange(existing ? 'update' : 'create', 'saved_food', id, existing || null, next); queueSavedFood(next); saveState(); savedFoodDialog.close(); render(); showToast(existing ? 'Saved food updated' : 'Saved food created'); flushQueue();
  });
  document.getElementById('deleteSavedFoodBtn').addEventListener('click', () => {
    const id = document.getElementById('savedFoodId').value, f = state.savedFoods.find(x => x.id === id); if (!f || !confirm(`Delete saved food “${f.name}”? Existing meal history stays.`)) return;
    state.savedFoods = state.savedFoods.filter(x => x.id !== id); state.meals.forEach(m => m.items?.forEach(i => { if (i.savedFoodId === id) i.savedFoodId = null; })); state.savedMeals.forEach(sm => sm.items?.forEach(i => { if (i.savedFoodId === id) i.savedFoodId = null; })); logChange('delete', 'saved_food', id, f, null); queueDelete('saved_foods', id); saveState(); savedFoodDialog.close(); render(); showToast('Saved food deleted'); flushQueue();
  });

  document.getElementById('savedMealForm').addEventListener('submit', e => {
    e.preventDefault(); const id = document.getElementById('savedMealId').value || newId(), existing = state.savedMeals.find(sm => sm.id === id), items = cleanEditorItems(savedMealEditorItems, document.getElementById('savedMealName').value.trim(), { confidence: 'high', source: 'saved_food' });
    const next = { id, name: document.getElementById('savedMealName').value.trim(), mealType: document.getElementById('savedMealType').value, items, favorite: document.getElementById('savedMealFavorite').checked, useCount: existing?.useCount || 0, lastUsedAt: existing?.lastUsedAt || null, createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() };
    if (existing) state.savedMeals[state.savedMeals.findIndex(sm => sm.id === id)] = next; else state.savedMeals.push(next);
    logChange(existing ? 'update' : 'create', 'saved_meal', id, existing || null, next); queueSavedMeal(next, existing); saveState(); savedMealDialog.close(); render(); showToast(existing ? 'Saved meal updated' : 'Saved meal created'); flushQueue();
  });
  document.getElementById('deleteSavedMealBtn').addEventListener('click', () => {
    const id = document.getElementById('savedMealId').value, sm = state.savedMeals.find(x => x.id === id); if (!sm || !confirm(`Delete saved meal “${sm.name}”? Logged meals stay.`)) return;
    state.savedMeals = state.savedMeals.filter(x => x.id !== id); logChange('delete', 'saved_meal', id, sm, null); queueDelete('saved_meals', id); saveState(); savedMealDialog.close(); render(); showToast('Saved meal deleted'); flushQueue();
  });

  document.getElementById('weightForm').addEventListener('submit', e => {
    e.preventDefault(); const date = document.getElementById('weightDate').value, existing = state.weights.find(w => w.date === date), next = { id: existing?.id || newId(), date, weight: Number(document.getElementById('weightValue').value), notes: document.getElementById('weightNotes').value.trim(), createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() };
    if (existing) state.weights[state.weights.findIndex(w => w.id === existing.id)] = next; else state.weights.push(next); logChange(existing ? 'update' : 'create', 'weight', next.id, existing || null, next); queueWeight(next); saveState(); weightDialog.close(); render(); showToast(existing ? 'Weight updated' : 'Weight logged'); flushQueue();
  });

  function createOrUpdateTemplateFromMeal(meal) {
    const match = state.savedMeals.find(sm => sm.name.trim().toLowerCase() === meal.title.trim().toLowerCase());
    const before = match ? clone(match) : null;
    const next = { id: match?.id || newId(), name: meal.title, mealType: meal.type, items: clone(meal.items).map(i => ({ ...i, id: newId() })), favorite: match?.favorite || false, useCount: match?.useCount || 0, lastUsedAt: match?.lastUsedAt || null, createdAt: match?.createdAt || nowIso(), updatedAt: nowIso() };
    if (match) state.savedMeals[state.savedMeals.findIndex(sm => sm.id === match.id)] = next; else state.savedMeals.push(next);
    logChange(match ? 'update' : 'create', 'saved_meal', next.id, before, next); queueSavedMeal(next, before);
  }
