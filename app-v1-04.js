'use strict';

function renderTrends() {
    const completeDates = [...new Set(state.meals.map(m => m.date))].filter(d => getStatus(d) === 'complete').sort();
    const recent = completeDates.slice(-14), avgCalories = average(recent.map(d => totalsFor(d).calories)), avgProtein = average(recent.map(d => totalsFor(d).protein));
    const adherence = recent.length ? average(recent.map(d => { const target = targetsFor(d).calories; return Math.max(0, 100 - Math.abs(totalsFor(d).calories - target) / Math.max(1, target) * 100); })) : 0;
    const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-30), latest = weights.at(-1)?.weight;
    const moving = rollingWeightAverages(weights, 7), fullTrend = moving.filter(x => x.count === 7), delta = fullTrend.length > 1 ? fullTrend.at(-1).value - fullTrend[0].value : null;
    const reuseCount = state.savedFoods.reduce((a, f) => a + Number(f.useCount || 0), 0) + state.savedMeals.reduce((a, m) => a + Number(m.useCount || 0), 0);
    app.innerHTML = `<section class="section flush-top"><div class="section-head"><div><p class="eyebrow">Signal over noise</p><h2>Trends</h2></div></div>
      <div class="card-grid"><div class="stat-card"><small>Current weight</small><strong>${latest != null ? `${fmt(latest, 1)} kg` : '—'}</strong><div class="delta">${delta == null ? 'Need 8+ weigh-ins for trend change' : `${delta > 0 ? '+' : ''}${fmt(delta, 1)} kg 7-entry trend change`}</div></div><div class="stat-card"><small>Avg calories</small><strong>${recent.length ? fmt(avgCalories) : '—'}</strong><div class="delta">${recent.length} complete days</div></div><div class="stat-card"><small>Avg protein</small><strong>${recent.length ? `${fmt(avgProtein, 1)} g` : '—'}</strong><div class="delta">Date-aware targets</div></div><div class="stat-card"><small>Quick logs used</small><strong>${fmt(reuseCount)}</strong><div class="delta">Saved foods + meals</div></div></div>
      <div class="chart-card"><div class="chart-head"><h3>Weight · last 30 entries</h3><span>7-entry trend</span></div>${renderWeightChart(weights, moving)}</div>
      <div class="data-note">Calorie adherence is ${recent.length ? `${fmt(adherence)}% across complete days` : 'waiting for complete days'}. Partial days stay excluded so missing meals do not look like successful dieting.</div></section>`;
  }

function rollingWeightAverages(weights, n) { return weights.map((w, i) => { const slice = weights.slice(Math.max(0, i - n + 1), i + 1); return { date: w.date, value: average(slice.map(x => x.weight)), count: slice.length }; }); }

function renderWeightChart(weights, moving) {
    if (weights.length < 2) return `<div class="empty"><strong>Not enough data</strong>Log at least two weigh-ins to draw a trend.</div>`;
    const width = 660, height = 180, pad = 26, all = [...weights.map(w => Number(w.weight)), ...moving.map(w => Number(w.value))]; let min = Math.min(...all), max = Math.max(...all); if (min === max) { min -= .5; max += .5; }
    const point = (value, i, len) => ({ x: pad + i * ((width - pad * 2) / Math.max(1, len - 1)), y: height - pad - ((Number(value) - min) / (max - min)) * (height - pad * 2) });
    const raw = weights.map((w, i) => ({ ...point(w.weight, i, weights.length), w })), trend = moving.map((w, i) => ({ ...point(w.value, i, moving.length), w }));
    const path = arr => arr.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `<svg class="chart" role="img" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Weight trend chart"><line class="gridline" x1="${pad}" x2="${width - pad}" y1="${pad}" y2="${pad}"/><line class="gridline" x1="${pad}" x2="${width - pad}" y1="${height - pad}" y2="${height - pad}"/><path class="raw-line" d="${path(raw)}"/><path class="line" d="${path(trend)}"/>${raw.map(p => `<circle class="point" cx="${p.x}" cy="${p.y}" r="3.5"/>`).join('')}<text x="${pad}" y="15">${fmt(max, 1)} kg</text><text x="${pad}" y="${height - 4}">${fmt(min, 1)} kg</text></svg>`;
  }


'use strict';

function localIntegrityReport() {
    const checks = [];
    const add = (name, level, detail) => checks.push({ name, level, detail });
    const dupes = values => { const seen = new Set(), d = new Set(); values.filter(Boolean).forEach(v => seen.has(v) ? d.add(v) : seen.add(v)); return [...d]; };
    let storageOk = true;
    try { const k = '__diet_copilot_storage_test__'; localStorage.setItem(k, 'ok'); storageOk = localStorage.getItem(k) === 'ok'; localStorage.removeItem(k); } catch { storageOk = false; }
    add('Browser storage', storageOk ? 'pass' : 'fail', storageOk ? 'Read/write available' : 'localStorage is unavailable or full');
    add('App data version', state.version === STATE_VERSION ? 'pass' : 'fail', `State v${state.version || '?'} · expected v${STATE_VERSION}`);

    const collections = [
      ['Meals', state.meals.map(x => x.id)],
      ['Meal items', state.meals.flatMap(m => (m.items || []).map(x => x.id))],
      ['Weights', state.weights.map(x => x.id)],
      ['Saved foods', state.savedFoods.map(x => x.id)],
      ['Saved meals', state.savedMeals.map(x => x.id)],
      ['Saved meal items', state.savedMeals.flatMap(m => (m.items || []).map(x => x.id))]
    ];
    collections.forEach(([name, ids]) => { const d = dupes(ids); add(`${name} IDs`, d.length ? 'fail' : 'pass', d.length ? `${d.length} duplicate ID${d.length === 1 ? '' : 's'}` : `${ids.length} unique`); });

    const invalidMeals = state.meals.filter(m => !/^\d{4}-\d{2}-\d{2}$/.test(m.date || '') || !(m.items || []).length || (m.items || []).some(i => !Number.isFinite(Number(i.calories)) || Number(i.calories) < 0 || !Number.isFinite(Number(i.protein)) || Number(i.protein) < 0));
    add('Meal integrity', invalidMeals.length ? 'fail' : 'pass', invalidMeals.length ? `${invalidMeals.length} invalid meal record${invalidMeals.length === 1 ? '' : 's'}` : `${state.meals.length} meals structurally valid`);
    const missingDays = [...new Set(state.meals.map(m => m.date).filter(d => !state.dayLogs[d]))];
    add('Daily-log links', missingDays.length ? 'warn' : 'pass', missingDays.length ? `${missingDays.length} meal date${missingDays.length === 1 ? '' : 's'} need a daily log` : 'All meal dates have daily logs');
    const badStatuses = Object.entries(state.dayLogs).filter(([,d]) => !['open','complete','partial'].includes(d?.status));
    add('Day statuses', badStatuses.length ? 'fail' : 'pass', badStatuses.length ? `${badStatuses.length} invalid status${badStatuses.length === 1 ? '' : 'es'}` : `${Object.keys(state.dayLogs).length} day logs valid`);
    const badWeights = state.weights.filter(w => !Number.isFinite(Number(w.weight)) || Number(w.weight) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || ''));
    add('Weight records', badWeights.length ? 'fail' : 'pass', badWeights.length ? `${badWeights.length} invalid weigh-in${badWeights.length === 1 ? '' : 's'}` : `${state.weights.length} weigh-ins valid`);

    const queueKeys = state.syncQueue.map(q => `${q.table}:${q.rowId || q.id}`), queueDupes = dupes(queueKeys);
    const badQueue = state.syncQueue.filter(q => !['upsert','delete'].includes(q.kind) || !q.table || !q.rowId);
    add('Sync queue', badQueue.length || queueDupes.length ? 'fail' : 'pass', badQueue.length || queueDupes.length ? `${badQueue.length} malformed · ${queueDupes.length} duplicate` : `${state.syncQueue.length} queued operation${state.syncQueue.length === 1 ? '' : 's'}`);
    add('Connectivity', isOnline() ? 'pass' : 'warn', isOnline() ? 'Browser reports online' : 'Offline — local tracking still works');
    if (runtimeWarnings.length) add('Runtime warnings', 'warn', runtimeWarnings.at(-1));
    else add('Runtime warnings', 'pass', 'None in this session');
    return { generatedAt: nowIso(), checks, failures: checks.filter(x => x.level === 'fail').length, warnings: checks.filter(x => x.level === 'warn').length };
  }

function releaseCheckMarkup() {
    if (!qaReport) return `<div class="release-check-empty">Run a health check whenever data or sync behavior looks suspicious.</div>`;
    const local = qaReport.local, cloudCheck = qaReport.cloud;
    const failed = local.failures + (cloudCheck?.level === 'fail' ? 1 : 0), warnings = local.warnings + (cloudCheck?.level === 'warn' ? 1 : 0);
    const label = failed ? `${failed} issue${failed === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'Checks passed';
    const tagClass = failed ? 'danger-tag' : warnings ? 'warn' : 'success';
    const cloudRow = cloudCheck ? `<div class="check-row-status ${cloudCheck.level}"><span>Cloud / schema</span><strong>${escapeHtml(cloudCheck.detail)}</strong></div>` : '';
    return `<div class="release-check-head"><span class="tag ${tagClass}">${escapeHtml(label)}</span><small>${new Date(qaReport.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div><div class="check-list">${local.checks.map(c => `<div class="check-row-status ${c.level}"><span>${escapeHtml(c.name)}</span><strong>${escapeHtml(c.detail)}</strong></div>`).join('')}${cloudRow}</div>`;
  }

