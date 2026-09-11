'use strict';

function bootstrapDietCopilot() {
  state = loadState();
  cloud = createCloudState();
  cloudConfig = loadCloudConfig();

  document.getElementById('addMealItemBtn').addEventListener('click', () => { mealEditorItems.push(normalizeItem(null, { name: '', calories: 0, protein: 0 })); renderItemEditor('mealItemsEditor', mealEditorItems, 'meal'); });

  document.getElementById('addSavedMealItemBtn').addEventListener('click', () => { savedMealEditorItems.push(normalizeItem(null, { name: '', calories: 0, protein: 0 })); renderItemEditor('savedMealItemsEditor', savedMealEditorItems, 'savedMeal'); });

  document.querySelectorAll('#quickTabs [data-quick]').forEach(b => b.addEventListener('click', () => { quickMode = b.dataset.quick; renderQuickLog(); }));

  document.getElementById('mealForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('mealId').value || newId(), existing = state.meals.find(m => m.id === id), date = document.getElementById('mealDate').value, day = ensureDayLog(date, false);
      const confidence = document.getElementById('mealConfidence').value, source = document.getElementById('mealSource').value, title = document.getElementById('mealTitle').value.trim();
      const items = cleanEditorItems(mealEditorItems, title, { confidence, source }).map(i => ({ ...i, confidence: i.confidence || confidence, source: i.source || source }));
      if (!items.length) { showToast('Add at least one food item before saving'); return; }
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
      if (!items.length) { showToast('Add at least one item to the saved meal'); return; }
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

  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => document.getElementById(btn.dataset.close).close()));

  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

  document.getElementById('weightQuickBtn').addEventListener('click', openWeightDialog);

  syncPill.addEventListener('click', () => setView('settings'));

  window.addEventListener('online', async () => { cloud.status = cloud.user ? 'connected' : (cloudConfig.url ? 'configured' : 'local'); updateSyncPill(); if (currentView === 'settings') renderSettings(); if (cloud.user && cloudConfig.activated) { await flushQueue(false); if (!state.syncQueue.length && !cloud.remotePending) await downloadCloudData(false, { silent: true, force: true }); } });

  window.addEventListener('offline', () => { if (cloudConfig.url || cloud.user) cloud.status = 'offline'; updateSyncPill(); if (currentView === 'settings') renderSettings(); });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; if (currentView === 'settings') renderSettings(); });

  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; showToast('Diet Copilot installed'); if (currentView === 'settings') renderSettings(); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed', err));

  [...new Set(state.meals.map(m => m.date))].forEach(date => ensureDayLog(date, false));

  saveState();

  render();

  initCloud(false);
}
bootstrapDietCopilot();

