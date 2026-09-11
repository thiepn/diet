'use strict';
  function savedMealCard(sm) {
    const t = sumItems(sm.items);
    return `<article class="library-card"><button class="library-edit" data-edit-saved-meal="${sm.id}"><div><h4>${sm.favorite ? '★ ' : ''}${escapeHtml(sm.name)}</h4><small>${escapeHtml(sm.mealType)} · ${sm.items.length} item${sm.items.length === 1 ? '' : 's'} · used ${sm.useCount || 0}×</small></div><strong>${fmt(t.calories)} kcal</strong></button><button class="library-use" data-use-saved-meal="${sm.id}">Log</button></article>`;
  }

  function renderTrends() {
    const completeDates = [...new Set(state.meals.map(m => m.date))].filter(d => getStatus(d) === 'complete').sort();
    const recent = completeDates.slice(-14), avgCalories = average(recent.map(d => totalsFor(d).calories)), avgProtein = average(recent.map(d => totalsFor(d).protein));
    const adherence = recent.length ? average(recent.map(d => { const target = targetsFor(d).calories; return Math.max(0, 100 - Math.abs(totalsFor(d).calories - target) / Math.max(1, target) * 100); })) : 0;
    const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-30), latest = weights.at(-1)?.weight;
    const moving = rollingWeightAverages(weights, 7), delta = moving.length > 1 ? moving.at(-1).value - moving[0].value : null;
    const reuseCount = state.savedFoods.reduce((a, f) => a + Number(f.useCount || 0), 0) + state.savedMeals.reduce((a, m) => a + Number(m.useCount || 0), 0);
    app.innerHTML = `<section class="section flush-top"><div class="section-head"><div><p class="eyebrow">Signal over noise</p><h2>Trends</h2></div></div>
      <div class="card-grid"><div class="stat-card"><small>Current weight</small><strong>${latest != null ? `${fmt(latest, 1)} kg` : '—'}</strong><div class="delta">${delta == null ? 'Log more weigh-ins' : `${delta > 0 ? '+' : ''}${fmt(delta, 1)} kg trend change`}</div></div><div class="stat-card"><small>Avg calories</small><strong>${recent.length ? fmt(avgCalories) : '—'}</strong><div class="delta">${recent.length} complete days</div></div><div class="stat-card"><small>Avg protein</small><strong>${recent.length ? `${fmt(avgProtein, 1)} g` : '—'}</strong><div class="delta">Date-aware targets</div></div><div class="stat-card"><small>Quick logs used</small><strong>${fmt(reuseCount)}</strong><div class="delta">Saved foods + meals</div></div></div>
      <div class="chart-card"><div class="chart-head"><h3>Weight · last 30 entries</h3><span>7-entry trend</span></div>${renderWeightChart(weights, moving)}</div>
      <div class="data-note">Calorie adherence is ${recent.length ? `${fmt(adherence)}% across complete days` : 'waiting for complete days'}. Partial days stay excluded so missing meals do not look like successful dieting.</div></section>`;
  }
  function rollingWeightAverages(weights, n) { return weights.map((w, i) => { const slice = weights.slice(Math.max(0, i - n + 1), i + 1); return { date: w.date, value: average(slice.map(x => x.weight)) }; }); }
  function renderWeightChart(weights, moving) {
    if (weights.length < 2) return `<div class="empty"><strong>Not enough data</strong>Log at least two weigh-ins to draw a trend.</div>`;
    const width = 660, height = 180, pad = 26, all = [...weights.map(w => Number(w.weight)), ...moving.map(w => Number(w.value))]; let min = Math.min(...all), max = Math.max(...all); if (min === max) { min -= .5; max += .5; }
    const point = (value, i, len) => ({ x: pad + i * ((width - pad * 2) / Math.max(1, len - 1)), y: height - pad - ((Number(value) - min) / (max - min)) * (height - pad * 2) });
    const raw = weights.map((w, i) => ({ ...point(w.weight, i, weights.length), w })), trend = moving.map((w, i) => ({ ...point(w.value, i, moving.length), w }));
    const path = arr => arr.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Weight trend chart"><line class="gridline" x1="${pad}" x2="${width - pad}" y1="${pad}" y2="${pad}"/><line class="gridline" x1="${pad}" x2="${width - pad}" y1="${height - pad}" y2="${height - pad}"/><path class="raw-line" d="${path(raw)}"/><path class="line" d="${path(trend)}"/>${raw.map(p => `<circle class="point" cx="${p.x}" cy="${p.y}" r="3.5"/>`).join('')}<text x="${pad}" y="15">${fmt(max, 1)} kg</text><text x="${pad}" y="${height - 4}">${fmt(min, 1)} kg</text></svg>`;
  }
