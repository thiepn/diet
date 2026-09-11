'use strict';
  function setView(view) { currentView = view; document.querySelectorAll('.nav-item').forEach(b => { const active = b.dataset.view === view; b.classList.toggle('active', active); if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); }); render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function render() {
    document.getElementById('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    if (currentView === 'today') renderToday(); else if (currentView === 'history') renderHistory(); else if (currentView === 'trends') renderTrends(); else renderSettings();
    updateSyncPill();
  }

  function renderToday() {
    const date = localDateKey(), totals = totalsFor(date), t = targetsFor(date), remaining = t.calories - totals.calories;
    const kcalPct = t.calories ? Math.min(100, (totals.calories / t.calories) * 100) : 0, proteinPct = t.protein ? Math.min(100, (totals.protein / t.protein) * 100) : 0;
    const meals = mealsFor(date), status = getStatus(date), weight = state.weights.find(w => w.date === date)?.weight;
    const usualCount = state.savedFoods.length + state.savedMeals.length;
    const yesterdayCount = mealsFor(offsetDateKey(-1)).length;
    const last = recentMeals(1)[0];
    app.innerHTML = `
      <section class="hero">
        <div class="hero-top"><div><p class="eyebrow">Calories consumed</p><div class="kcal-number">${fmt(totals.calories)}</div><p class="kcal-sub">of ${fmt(t.calories)} kcal</p></div><div class="remaining-pill ${remaining < 0 ? 'over' : ''}">${remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}</div></div>
        <div class="progress ${remaining < 0 ? 'over' : ''}"><span style="width:${kcalPct}%"></span></div>
        <div class="metric-row"><strong>Protein</strong><small>${fmt(totals.protein, 1)} / ${fmt(t.protein)} g</small><div class="mini-progress"><span style="width:${proteinPct}%"></span></div></div>
        <div class="hero-foot"><span>${weight ? `${fmt(weight, 1)} kg today` : 'No weigh-in today'}</span><span>Target snapshot · ${fmt(t.calories)} kcal</span></div>
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
        <div class="section-head"><h2>Today</h2><div class="status-switch" aria-label="Day status">${['open', 'complete', 'partial'].map(s => `<button data-status="${s}" class="${status === s ? 'active' : ''}">${s}</button>`).join('')}</div></div>
        <div class="meal-list">${meals.length ? meals.map(mealCard).join('') : `<div class="empty"><strong>No food logged yet</strong>Add a meal, repeat a recent one, or use a saved usual.</div>`}</div>
        <button class="fab" id="addMealBtn">+ Add meal</button>
      </section>`;
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
