'use strict';
  function localIntegrityReport() {
    const checks = [];
    const add = (name, level, detail) => checks.push({ name, level, detail });
    const dupes = values => { const seen = new Set(), d = new Set(); values.filter(Boolean).forEach(v => seen.has(v) ? d.add(v) : seen.add(v)); return [...d]; };
    let storageOk = true;
    try { const k = '__diet_copilot_storage_test__'; localStorage.setItem(k, 'ok'); storageOk = localStorage.getItem(k) === 'ok'; localStorage.removeItem(k); } catch { storageOk = false; }
    add('Browser storage', storageOk ? 'pass' : 'fail', storageOk ? 'Read/write available' : 'localStorage is unavailable or full');
    add('App data version', state.version === APP_VERSION ? 'pass' : 'fail', `State v${state.version || '?'} · expected v${APP_VERSION}`);

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
    if (!qaReport) return `<div class="release-check-empty">Run the release check after an upgrade or whenever sync/data behavior looks suspicious.</div>`;
    const local = qaReport.local, cloudCheck = qaReport.cloud;
    const failed = local.failures + (cloudCheck?.level === 'fail' ? 1 : 0), warnings = local.warnings + (cloudCheck?.level === 'warn' ? 1 : 0);
    const label = failed ? `${failed} issue${failed === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'Checks passed';
    const tagClass = failed ? 'danger-tag' : warnings ? 'warn' : 'success';
    const cloudRow = cloudCheck ? `<div class="check-row-status ${cloudCheck.level}"><span>Cloud / schema</span><strong>${escapeHtml(cloudCheck.detail)}</strong></div>` : '';
    return `<div class="release-check-head"><span class="tag ${tagClass}">${escapeHtml(label)}</span><small>${new Date(qaReport.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div><div class="check-list">${local.checks.map(c => `<div class="check-row-status ${c.level}"><span>${escapeHtml(c.name)}</span><strong>${escapeHtml(c.detail)}</strong></div>`).join('')}${cloudRow}</div>`;
  }
