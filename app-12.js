'use strict';
  function openMealDialog(id = null, seed = null) {
    const m = id ? state.meals.find(x => x.id === id) : seed;
    document.getElementById('mealDialogTitle').textContent = id ? 'Edit meal' : 'Add meal';
    document.getElementById('mealId').value = id || '';
    document.getElementById('mealDate').value = m?.date || localDateKey();
    document.getElementById('mealType').value = m?.type || guessMealType();
    document.getElementById('mealTitle').value = m?.title || '';
    document.getElementById('mealConfidence').value = m?.confidence || 'medium';
    document.getElementById('mealSource').value = m?.source || 'text_estimate';
    document.getElementById('mealOriginalInput').value = m?.originalInput || '';
    document.getElementById('mealNotes').value = m?.notes || '';
    document.getElementById('saveAsTemplate').checked = false;
    mealEditorItems = (m?.items?.length ? clone(m.items) : [normalizeItem(null, { name: '', calories: 0, protein: 0 })]).map(i => normalizeItem(i));
    renderItemEditor('mealItemsEditor', mealEditorItems, 'meal');
    document.getElementById('deleteMealBtn').classList.toggle('hidden', !id);
    mealDialog.showModal();
    setTimeout(() => document.getElementById('mealTitle').focus(), 30);
  }

  function renderItemEditor(containerId, items, mode) {
    const host = document.getElementById(containerId); if (!host) return;
    host.innerHTML = items.map((item, idx) => `<div class="item-row" data-index="${idx}"><div class="item-row-main"><input data-item-field="name" value="${escapeHtml(item.name || '')}" placeholder="Food name" maxlength="120"/><input data-item-field="quantity" value="${escapeHtml(item.quantity || '')}" placeholder="Amount e.g. 200 g" maxlength="80"/></div><div class="item-row-numbers"><label><span>kcal</span><input data-item-field="calories" type="number" min="0" step="1" value="${Number(item.calories || 0)}"/></label><label><span>protein</span><input data-item-field="protein" type="number" min="0" step="0.1" value="${Number(item.protein || 0)}"/></label><button type="button" class="item-remove" data-remove-item="${idx}" aria-label="Remove item">×</button></div></div>`).join('');
    host.querySelectorAll('[data-item-field]').forEach(input => input.addEventListener('input', e => {
      const row = e.target.closest('.item-row'), idx = Number(row.dataset.index), field = e.target.dataset.itemField;
      items[idx][field] = ['calories', 'protein'].includes(field) ? Number(e.target.value || 0) : e.target.value;
      if (field === 'calories') { items[idx].caloriesLow = null; items[idx].caloriesHigh = null; }
      updateEditorTotals(mode);
    }));
    host.querySelectorAll('[data-remove-item]').forEach(btn => btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeItem);
      if (items.length === 1) items[0] = normalizeItem(null, { name: '', calories: 0, protein: 0 }); else items.splice(idx, 1);
      renderItemEditor(containerId, items, mode); updateEditorTotals(mode);
    }));
    updateEditorTotals(mode);
  }
  function updateEditorTotals(mode) {
    const items = mode === 'meal' ? mealEditorItems : savedMealEditorItems, t = sumItems(items);
    const prefix = mode === 'meal' ? 'meal' : 'savedMeal';
    const cal = document.getElementById(`${prefix}CaloriesTotal`), pro = document.getElementById(`${prefix}ProteinTotal`);
    if (cal) cal.textContent = fmt(t.calories); if (pro) pro.textContent = fmt(t.protein, 1);
  }
  function cleanEditorItems(items, fallbackName, fallback = {}) {
    const cleaned = items.filter(i => String(i.name || '').trim() || Number(i.calories || 0) || Number(i.protein || 0)).map(i => normalizeItem({ ...i, name: String(i.name || fallbackName || 'Food').trim(), confidence: i.confidence || fallback.confidence, source: i.source || fallback.source }));
    return cleaned.length ? cleaned : [normalizeItem(null, { name: fallbackName || 'Meal', calories: 0, protein: 0, confidence: fallback.confidence, source: fallback.source })];
  }
  function guessMealType() { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner'; }
  function openWeightDialog() { const date = localDateKey(), existing = state.weights.find(w => w.date === date); document.getElementById('weightValue').value = existing?.weight ?? ''; document.getElementById('weightDate').value = date; document.getElementById('weightNotes').value = existing?.notes || ''; weightDialog.showModal(); setTimeout(() => document.getElementById('weightValue').focus(), 30); }

  function openQuickLog(mode = 'usuals') { quickMode = mode; renderQuickLog(); quickLogDialog.showModal(); }
