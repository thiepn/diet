'use strict';

function renderToday() {
    const date = localDateKey(), totals = totalsFor(date), t = targetsFor(date), remaining = t.calories - totals.calories;
    const kcalPct = t.calories ? Math.min(100, (totals.calories / t.calories) * 100) : 0, proteinPct = t.protein ? Math.min(100, (totals.protein / t.protein) * 100) : 0;
    const meals = mealsFor(date), status = getStatus(date), weight = state.weights.find(w => w.date === date)?.weight;
    const usualCount = state.savedFoods.length + state.savedMeals.length;
    const yesterdayCount = mealsFor(offsetDateKey(-1)).length;
    const last = recentMeals(1)[0];
    const needsTargetSetup = !state.profile.targetsConfirmed;
    app.innerHTML = `
      ${needsTargetSetup ? `<section class="setup-banner" role="note"><div><strong>Set your daily targets</strong><span>The current ${fmt(state.profile.calorieTarget)} kcal / ${fmt(state.profile.proteinTarget)} g values are defaults. Confirm your own targets before relying on “remaining calories.”</span></div><button class="btn primary small-btn" id="setupTargetsBtn">Set targets</button></section>` : ''}
      <section class="hero">
        <div class="hero-top"><div><p class="eyebrow">Calories consumed</p><div class="kcal-number">${fmt(totals.calories)}</div><p class="kcal-sub">of ${fmt(t.calories)} kcal</p></div><div class="remaining-pill ${remaining < 0 ? 'over' : ''}">${remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}</div></div>
        <div class="progress ${remaining < 0 ? 'over' : ''}"><span style="width:${kcalPct}%"></span></div>
        <div class="metric-row"><strong>Protein</strong><small>${fmt(totals.protein, 1)} / ${fmt(t.protein)} g</small><div class="mini-progress"><span style="width:${proteinPct}%"></span></div></div>
        <div class="hero-foot"><span>${weight ? `${fmt(weight, 1)} kg today` : 'No weigh-in today'}</span><span>${needsTargetSetup ? 'Default target' : 'Target snapshot'} · ${fmt(t.calories)} kcal</span></div>
      </section>
      <section class="quick-start">
        <div class="section-head compact-head"><div><p class="eyebrow">Less typing</p><h2>Quick log</h2></div></div>
        <div class="quick-actions">
          <button class="quick-action" data-open-quick="usuals"><strong>Usuals</strong><small>${usualCount ? `${usualCount} saved` : 'Save repeated foods'}</small></button>
          <button class="quick-action" data-open-quick="yesterday"><strong>Yesterday</strong><small>${yesterdayCount ? `${yesterdayCount} meals` : 'Nothing logged'}</small></button>
          <button class="quick-action" data-open-quick="recent" ${last ? '' : 'disabled'}><strong>Recent</strong><small>${last ? escapeHtml(last.title) : 'No meals yet'}</small></button>
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Today</h2><div class="status-switch" aria-label="Day status">${['open', 'complete', 'partial'].map(s => `<button data-status="${s}" aria-pressed="${status === s}" class="${status === s ? 'active' : ''}">${s}</button>`).join('')}</div></div>
        <div class="meal-list">${meals.length ? meals.map(mealCard).join('') : `<div class="empty"><strong>No food logged yet</strong>Add a meal, repeat a recent one, or use a saved usual.</div>`}</div>
        <button class="fab" id="addMealBtn">+ Add meal</button>
      </section>`;
    app.querySelector('#setupTargetsBtn')?.addEventListener('click', () => { setView('settings'); requestAnimationFrame(() => app.querySelector('#settingsCalories')?.focus()); });
    app.querySelector('#addMealBtn').addEventListener('click', () => openMealDialog());
    app.querySelectorAll('.meal-card').forEach(card => card.addEventListener('click', () => openMealDialog(card.dataset.id)));
    app.querySelectorAll('[data-open-quick]').forEach(btn => btn.addEventListener('click', () => openQuickLog(btn.dataset.openQuick)));
    app.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', () => {
      const log = ensureDayLog(date, false), before = clone(log); log.status = btn.dataset.status; log.updatedAt = nowIso(); state.dayLogs[date] = log;
      logChange('update', 'daily_log', log.id, before, log); queueUpsertDay(date); saveState(); renderToday(); flushQueue();
    }));
  }

function mealCard(m) {
    const source = (m.source || 'text_estimate').replaceAll('_', ' '), totals = mealTotals(m), range = mealRange(m);
    const itemNames = (m.items || []).slice(0, 3).map(i => i.name).filter(Boolean).join(' · '), extra = Math.max(0, (m.items || []).length - 3);
    const rangeText = range.low != null && range.high != null && Number(range.low) !== Number(range.high) ? `<div class="estimate-range">likely ${fmt(range.low)}–${fmt(range.high)} kcal</div>` : '';
    return `<button class="meal-card" data-id="${m.id}"><div><h3>${escapeHtml(m.type)} · ${escapeHtml(m.title)}</h3><div class="meta">${itemNames ? escapeHtml(itemNames) + (extra ? ` +${extra}` : '') + ' · ' : ''}${fmt(totals.protein, 1)} g protein</div><div class="confidence"><span class="dot ${escapeHtml(m.confidence || 'medium')}"></span>${escapeHtml(m.confidence || 'medium')} confidence · ${escapeHtml(source)}</div>${rangeText}</div><div class="cal">${fmt(totals.calories)} kcal</div></button>`;
  }

function renderHistory() {
    app.innerHTML = `<section class="section flush-top"><div class="section-head"><div><p class="eyebrow">Persistent record & reusable foods</p><h2>${historyMode === 'history' ? 'History' : 'Library'}</h2></div></div><div class="segmented history-segment"><button data-history-mode="history" class="${historyMode === 'history' ? 'active' : ''}">History</button><button data-history-mode="library" class="${historyMode === 'library' ? 'active' : ''}">Library</button></div><div id="historyModeContent"></div></section>`;
    app.querySelectorAll('[data-history-mode]').forEach(btn => btn.addEventListener('click', () => { historyMode = btn.dataset.historyMode; renderHistory(); }));
    if (historyMode === 'history') renderHistoryList(); else renderLibrary();
  }


'use strict';

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

function savedMealCard(sm) {
    const t = sumItems(sm.items);
    return `<article class="library-card"><button class="library-edit" data-edit-saved-meal="${sm.id}"><div><h4>${sm.favorite ? '★ ' : ''}${escapeHtml(sm.name)}</h4><small>${escapeHtml(sm.mealType)} · ${sm.items.length} item${sm.items.length === 1 ? '' : 's'} · used ${sm.useCount || 0}×</small></div><strong>${fmt(t.calories)} kcal</strong></button><button class="library-use" data-use-saved-meal="${sm.id}">Log</button></article>`;
  }

