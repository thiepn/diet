'use strict';

function p2MealClass(type='') {
  const t = String(type).trim().toLowerCase();
  if (t.includes('breakfast') || t.includes('frühstück')) return 'breakfast';
  if (t.includes('lunch') || t.includes('mittag')) return 'lunch';
  if (t.includes('dinner') || t.includes('abend')) return 'dinner';
  if (t.includes('snack')) return 'snack';
  if (t.includes('drink') || t.includes('getränk')) return 'drink';
  return 'other';
}

function p2SourceMeta(meal) {
  const source = String(meal.source || '').toLowerCase();
  if (source === 'nutrition_label') return { label:'Label value', cls:'exact' };
  if (source === 'weighed') return { label:'Weighed', cls:'exact' };
  if (source === 'manual_exact') return { label:'Exact', cls:'exact' };
  if (source === 'ai_adjusted') return { label:'Adjusted', cls:'adjusted' };
  if (source === 'photo_estimate' || source === 'restaurant_estimate' || source === 'text_estimate') return { label:'Estimated', cls:'estimated' };
  return sourceQuality(meal) === 'exact' ? { label:'Exact', cls:'exact' } : { label:'Estimated', cls:'estimated' };
}

function p2WeightSub(todayWeight, latest) {
  if (todayWeight) return 'Morning weigh-in';
  if (latest) return `Latest · ${prettyDate(latest.date,{day:'numeric',month:'short'})}`;
  return 'No weigh-ins yet';
}

function p2LoadingState() {
  return `<div class="today-loading" aria-label="Loading today's dashboard">
    <div class="skeleton hero-skeleton"></div>
    <div class="today-metrics"><div class="skeleton tile-skeleton"></div><div class="skeleton tile-skeleton"></div></div>
    <div class="skeleton" style="min-height:112px"></div>
  </div>`;
}

function p2SignedOutState() {
  return `<section class="today-state">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg></div>
    <h2>Sign in to Diet Copilot</h2>
    <p>Your meals, calories, protein and weigh-ins are synced to your account and available on every device.</p>
    <button class="btn primary" type="button" data-open-account>Sign in</button>
  </section>`;
}

function p2ErrorState(message) {
  return `<section class="today-state today-error">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg></div>
    <h2>Couldn't refresh your dashboard</h2>
    <p>${esc(message || 'Your saved data is safe. Try refreshing the connection.')}</p>
    <button class="btn primary" type="button" data-retry-dashboard>Try again</button>
  </section>`;
}

function p2EmptyMeals() {
  return `<div class="today-empty-meals">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H7l-3 3V5Z"/><path d="M8 9h8M8 12h5"/></svg></div>
    <h3>No meals yet today</h3>
    <p>Send a meal description or photo to ChatGPT. Once it is logged, it will appear here automatically.</p>
  </div>`;
}

renderToday = function renderTodayP2() {
  if (cloud.status === 'syncing' && dashboard.source === 'empty') {
    app.innerHTML = p2LoadingState();
    return;
  }

  if (!cloud.user && dashboard.source === 'empty') {
    app.innerHTML = p2SignedOutState();
    app.querySelector('[data-open-account]')?.addEventListener('click', openConnection);
    return;
  }

  if (cloud.status === 'error' && dashboard.source === 'empty') {
    app.innerHTML = p2ErrorState(cloud.error);
    app.querySelector('[data-retry-dashboard]')?.addEventListener('click', () => refreshData());
    return;
  }

  const date = localDateKey();
  const meals = mealsFor(date);
  const totals = totalsFor(date);
  const target = targetsFor(date);
  const remain = target.calories - totals.calories;
  const todayWeight = weightFor(date);
  const latest = latestWeight();
  const proteinPct = target.protein ? Math.max(0, Math.min(100, totals.protein / target.protein * 100)) : 0;
  const kcalPctRaw = target.calories ? totals.calories / target.calories * 100 : 0;
  const kcalPct = Math.max(0, Math.min(100, kcalPctRaw));
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
  const weightValue = todayWeight?.weight ?? latest?.weight ?? null;

  app.innerHTML = `<div class="today-v2">
    <section class="calorie-hero-v2 ${remain < 0 ? 'over' : ''}" aria-label="Today's calorie summary">
      <div class="calorie-hero-kicker"><span>Today's calories</span><span class="date-chip">${esc(dateLabel)}</span></div>
      <div class="calorie-value-row"><strong>${fmt(totals.calories)}</strong><span>kcal</span></div>
      <div class="calorie-target-copy">of ${fmt(target.calories)} kcal target</div>
      <div class="calorie-progress" role="progressbar" aria-label="Calories" aria-valuemin="0" aria-valuemax="${Math.max(1,target.calories)}" aria-valuenow="${Math.max(0,totals.calories)}"><span style="width:${kcalPct}%"></span></div>
      <div class="calorie-footer">
        <div class="calorie-remaining">${remain >= 0 ? `${fmt(remain)} kcal remaining` : `${fmt(Math.abs(remain))} kcal over target`}</div>
        <div class="calorie-percent">${target.calories ? `${Math.round(kcalPctRaw)}% of target` : ''}</div>
      </div>
    </section>

    <div class="today-metrics">
      <section class="today-metric protein" aria-label="Protein summary">
        <div class="metric-v2-head"><span class="metric-v2-title">Protein</span><span class="metric-v2-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9v6M18 9v6M3 10v4M21 10v4M6 12h12"/></svg></span></div>
        <div class="metric-v2-value">${fmt(totals.protein,1)} g</div>
        <div class="metric-v2-sub">of ${fmt(target.protein)} g · ${Math.round(proteinPct)}%</div>
        <div class="protein-track" role="progressbar" aria-label="Protein" aria-valuemin="0" aria-valuemax="${Math.max(1,target.protein)}" aria-valuenow="${Math.max(0,totals.protein)}"><span style="width:${proteinPct}%"></span></div>
      </section>

      <section class="today-metric weight" aria-label="Weight summary">
        <div class="metric-v2-head"><span class="metric-v2-title">Weight</span><span class="metric-v2-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0"/><path d="m12 10 1.8-2.2"/></svg></span></div>
        <div class="metric-v2-value">${weightValue == null ? '—' : `${fmt(weightValue,1)} kg`}</div>
        <div class="metric-v2-sub">${esc(p2WeightSub(todayWeight,latest))}</div>
      </section>
    </div>

    <section class="today-meals-section">
      <div class="today-meals-head"><div><h2>Today's meals</h2><p>${meals.length ? `${fmt(totals.calories)} kcal · ${fmt(totals.protein,1)} g protein` : 'Meals logged through ChatGPT'}</p></div>${meals.length ? `<span class="meal-count-chip">${meals.length} ${meals.length===1?'meal':'meals'}</span>` : ''}</div>
      <div class="meal-list-v2">${meals.length ? meals.map(mealCard).join('') : p2EmptyMeals()}</div>
    </section>
  </div>`;
};

mealCard = function mealCardP2(m) {
  const range = m.caloriesLow != null && m.caloriesHigh != null && Number(m.caloriesLow) !== Number(m.caloriesHigh) ? `${fmt(m.caloriesLow)}–${fmt(m.caloriesHigh)} kcal` : null;
  const sourceMeta = p2SourceMeta(m);
  const cls = p2MealClass(m.type);
  const time = m.eatenAt ? new Date(m.eatenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
  const items = Array.isArray(m.items) ? m.items : [];
  const rows = items.map(i => `<div class="meal-detail-row"><div class="meal-detail-main"><strong>${esc(i.name || 'Food')}</strong>${i.quantity ? `<small>${esc(i.quantity)}</small>` : ''}</div><div class="meal-detail-cal">${fmt(i.calories)} kcal</div></div>`).join('');
  const metaBits = [range ? `<span class="meal-estimate-range">Likely ${range}</span>` : '', m.notes ? esc(m.notes) : ''].filter(Boolean).join('<br>');

  return `<details class="meal-v2 ${cls}">
    <summary>
      <div class="meal-summary-main">
        <div class="meal-kicker"><span class="meal-dot" aria-hidden="true"></span><span class="meal-type-v2">${esc(m.type || 'Meal')}</span>${time ? `<span class="meal-time-v2">${esc(time)}</span>` : ''}</div>
        <div class="meal-name-v2">${esc(m.title || 'Meal')}</div>
        <div class="meal-meta-v2"><span class="meal-protein-v2">${fmt(m.protein,1)} g protein</span><span>·</span><span class="meal-source-v2 ${sourceMeta.cls}">${esc(sourceMeta.label)}</span></div>
      </div>
      <div class="meal-summary-side"><strong>${fmt(m.calories)}</strong><small>kcal</small><svg class="meal-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></div>
    </summary>
    <div class="meal-details-v2">
      ${rows || `<div class="meal-detail-row"><div class="meal-detail-main"><strong>No item breakdown</strong><small>Only the meal total was recorded.</small></div></div>`}
      ${metaBits ? `<div class="meal-details-meta"><strong>${sourceMeta.label}</strong><br>${metaBits}</div>` : ''}
    </div>
  </details>`;
};
