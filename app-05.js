'use strict';
  function renderHistory() {
    app.innerHTML = `<section class="section flush-top"><div class="section-head"><div><p class="eyebrow">Persistent record & reusable foods</p><h2>${historyMode === 'history' ? 'History' : 'Library'}</h2></div></div><div class="segmented history-segment"><button data-history-mode="history" class="${historyMode === 'history' ? 'active' : ''}">History</button><button data-history-mode="library" class="${historyMode === 'library' ? 'active' : ''}">Library</button></div><div id="historyModeContent"></div></section>`;
    app.querySelectorAll('[data-history-mode]').forEach(btn => btn.addEventListener('click', () => { historyMode = btn.dataset.historyMode; renderHistory(); }));
    if (historyMode === 'history') renderHistoryList(); else renderLibrary();
  }

  function renderHistoryList() {
    const host = app.querySelector('#historyModeContent');
    const allDates = [...new Set([...state.meals.map(m => m.date), ...state.weights.map(w => w.date), ...Object.keys(state.dayLogs)])].sort().reverse();
    const q = historyQuery.trim().toLowerCase();
    const matches = allDates.filter(date => !q || prettyDate(date, { year: 'numeric', month: 'long', day: 'numeric' }).toLowerCase().includes(q) || mealsFor(date).some(m => [m.title, m.type, m.notes, m.originalInput, ...(m.items || []).map(i => i.name)].join(' ').toLowerCase().includes(q)));
    const dates = matches.slice(0, historyLimit), more = Math.max(0, matches.length - dates.length);
    host.innerHTML = `<input class="search" id="historySearch" type="search" placeholder="Search foods, meals, dates..." value="${escapeHtml(historyQuery)}"/><div id="historyList">${dates.length ? dates.map(historyDay).join('') : `<div class="empty"><strong>No matching history</strong>Your meal and weight history will appear here.</div>`}</div>${more ? `<button class="btn ghost history-more" id="historyMoreBtn">Show ${Math.min(HISTORY_PAGE_SIZE, more)} more · ${more} remaining</button>` : ''}`;
    const search = host.querySelector('#historySearch');
    search.addEventListener('input', e => { historyQuery = e.target.value; historyLimit = HISTORY_PAGE_SIZE; renderHistory(); requestAnimationFrame(() => { const el = app.querySelector('#historySearch'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); });
    host.querySelector('#historyMoreBtn')?.addEventListener('click', () => { historyLimit += HISTORY_PAGE_SIZE; renderHistoryList(); });
    host.querySelectorAll('[data-history-meal]').forEach(el => el.addEventListener('click', () => openMealDialog(el.dataset.historyMeal)));
  }

  function historyDay(date) {
    const meals = mealsFor(date), totals = totalsFor(date), weight = state.weights.find(w => w.date === date), status = getStatus(date), t = targetsFor(date);
    return `<details class="history-day"><summary><div class="history-date">${prettyDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div><div class="history-total">${fmt(totals.calories)} kcal</div><div class="history-meta">${status}${weight ? ` · ${fmt(weight.weight, 1)} kg` : ''}</div><div class="history-meta">${fmt(totals.protein, 1)} g · target ${fmt(t.calories)}</div></summary><div class="history-body">${meals.length ? meals.map(m => `<button class="history-meal" data-history-meal="${m.id}"><span>${escapeHtml(m.type)} · ${escapeHtml(m.title)} <small>${(m.items || []).length} item${(m.items || []).length === 1 ? '' : 's'}</small></span><strong>${fmt(mealTotals(m).calories)}</strong></button>`).join('') : `<div class="muted mini-pad">No meals logged.</div>`}</div></details>`;
  }

  function renderLibrary() {
    const host = app.querySelector('#historyModeContent');
    const foods = sortUsuals(state.savedFoods), meals = sortUsuals(state.savedMeals);
    host.innerHTML = `<div class="library-toolbar"><button class="btn primary" id="newSavedFoodBtn">+ Saved food</button><button class="btn ghost" id="newSavedMealBtn">+ Saved meal</button></div>
      <div class="library-section"><div class="library-heading"><h3>Saved meals</h3><span>${meals.length}</span></div>${meals.length ? `<div class="library-list">${meals.map(savedMealCard).join('')}</div>` : `<div class="empty"><strong>No saved meals</strong>Save a repeated meal from the meal editor or create one here.</div>`}</div>
      <div class="library-section"><div class="library-heading"><h3>Saved foods</h3><span>${foods.length}</span></div>${foods.length ? `<div class="library-list">${foods.map(savedFoodCard).join('')}</div>` : `<div class="empty"><strong>No saved foods</strong>Add packaged foods or repeatable staples once, then log them in one tap.</div>`}</div>`;
    host.querySelector('#newSavedFoodBtn').addEventListener('click', () => openSavedFoodDialog());
    host.querySelector('#newSavedMealBtn').addEventListener('click', () => openSavedMealDialog());
    host.querySelectorAll('[data-edit-food]').forEach(b => b.addEventListener('click', () => openSavedFoodDialog(b.dataset.editFood)));
    host.querySelectorAll('[data-use-food]').forEach(b => b.addEventListener('click', () => logSavedFood(b.dataset.useFood)));
    host.querySelectorAll('[data-edit-saved-meal]').forEach(b => b.addEventListener('click', () => openSavedMealDialog(b.dataset.editSavedMeal)));
    host.querySelectorAll('[data-use-saved-meal]').forEach(b => b.addEventListener('click', () => logSavedMeal(b.dataset.useSavedMeal)));
  }

  function savedFoodCard(f) {
    return `<article class="library-card"><button class="library-edit" data-edit-food="${f.id}"><div><h4>${f.favorite ? '★ ' : ''}${escapeHtml(f.name)}</h4><small>${escapeHtml(f.quantity || 'Default portion')} · ${fmt(f.protein, 1)} g protein · used ${f.useCount || 0}×</small></div><strong>${fmt(f.calories)} kcal</strong></button><button class="library-use" data-use-food="${f.id}">Log</button></article>`;
  }
