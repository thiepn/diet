'use strict';
  function renderQuickLog() {
    document.querySelectorAll('#quickTabs [data-quick]').forEach(b => b.classList.toggle('active', b.dataset.quick === quickMode));
    const host = document.getElementById('quickLogContent');
    if (quickMode === 'usuals') {
      const meals = sortUsuals(state.savedMeals), foods = sortUsuals(state.savedFoods);
      host.innerHTML = (meals.length || foods.length) ? `${meals.map(sm => { const t = sumItems(sm.items); return `<button class="quick-row" data-quick-saved-meal="${sm.id}"><div><strong>${sm.favorite ? '★ ' : ''}${escapeHtml(sm.name)}</strong><small>${escapeHtml(sm.mealType)} · ${sm.items.length} items</small></div><span>${fmt(t.calories)} kcal</span></button>`; }).join('')}${foods.map(f => `<button class="quick-row" data-quick-food="${f.id}"><div><strong>${f.favorite ? '★ ' : ''}${escapeHtml(f.name)}</strong><small>${escapeHtml(f.quantity || 'Default portion')} · saved food</small></div><span>${fmt(f.calories)} kcal</span></button>`).join('')}` : `<div class="empty"><strong>No usuals yet</strong>Create saved foods or meals in History → Library.</div>`;
    } else if (quickMode === 'yesterday') {
      const meals = mealsFor(offsetDateKey(-1)); host.innerHTML = meals.length ? meals.map(m => `<button class="quick-row" data-copy-meal="${m.id}"><div><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.type)} · copy to today</small></div><span>${fmt(mealTotals(m).calories)} kcal</span></button>`).join('') : `<div class="empty"><strong>No meals yesterday</strong>There is nothing to repeat from yesterday.</div>`;
    } else {
      const meals = recentMeals(10); host.innerHTML = meals.length ? meals.map(m => `<button class="quick-row" data-copy-meal="${m.id}"><div><strong>${escapeHtml(m.title)}</strong><small>${prettyDate(m.date, { day: 'numeric', month: 'short' })} · ${escapeHtml(m.type)}</small></div><span>${fmt(mealTotals(m).calories)} kcal</span></button>`).join('') : `<div class="empty"><strong>No recent meals</strong>Your latest meals will appear here.</div>`;
    }
    host.querySelectorAll('[data-quick-saved-meal]').forEach(b => b.addEventListener('click', () => { logSavedMeal(b.dataset.quickSavedMeal); quickLogDialog.close(); }));
    host.querySelectorAll('[data-quick-food]').forEach(b => b.addEventListener('click', () => { logSavedFood(b.dataset.quickFood); quickLogDialog.close(); }));
    host.querySelectorAll('[data-copy-meal]').forEach(b => b.addEventListener('click', () => { copyMealToToday(b.dataset.copyMeal); quickLogDialog.close(); }));
  }

  function openSavedFoodDialog(id = null) {
    const f = id ? state.savedFoods.find(x => x.id === id) : null;
    document.getElementById('savedFoodDialogTitle').textContent = f ? 'Edit saved food' : 'New saved food'; document.getElementById('savedFoodId').value = f?.id || ''; document.getElementById('savedFoodName').value = f?.name || ''; document.getElementById('savedFoodQuantity').value = f?.quantity || ''; document.getElementById('savedFoodCalories').value = f?.calories ?? ''; document.getElementById('savedFoodProtein').value = f?.protein ?? ''; document.getElementById('savedFoodConfidence').value = f?.confidence || 'high'; document.getElementById('savedFoodSource').value = f?.source || 'manual_exact'; document.getElementById('savedFoodFavorite').checked = Boolean(f?.favorite); document.getElementById('deleteSavedFoodBtn').classList.toggle('hidden', !f); savedFoodDialog.showModal(); setTimeout(() => document.getElementById('savedFoodName').focus(), 30);
  }
  function openSavedMealDialog(id = null, seed = null) {
    const sm = id ? state.savedMeals.find(x => x.id === id) : seed;
    document.getElementById('savedMealDialogTitle').textContent = id ? 'Edit saved meal' : 'New saved meal'; document.getElementById('savedMealId').value = id || ''; document.getElementById('savedMealName').value = sm?.name || ''; document.getElementById('savedMealType').value = sm?.mealType || guessMealType(); document.getElementById('savedMealFavorite').checked = Boolean(sm?.favorite); document.getElementById('deleteSavedMealBtn').classList.toggle('hidden', !id); savedMealEditorItems = (sm?.items?.length ? clone(sm.items) : [normalizeItem(null, { name: '', calories: 0, protein: 0 })]).map(i => normalizeItem(i)); renderItemEditor('savedMealItemsEditor', savedMealEditorItems, 'savedMeal'); savedMealDialog.showModal(); setTimeout(() => document.getElementById('savedMealName').focus(), 30);
  }
