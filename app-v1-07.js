'use strict';

function renderAiAction(a) {
    const label = String(a.actionType || '').replaceAll('_',' ') || 'AI action';
    const when = a.createdAt ? new Date(a.createdAt).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
    return `<div class="ai-action-row"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(when)}${a.undoneAt ? ' · undone' : ''}</small></div>${!a.undoneAt && a.id && cloud.user ? `<button class="btn ghost small-btn" data-undo-ai="${a.id}">Undo</button>` : ''}</div>`;
  }

function cloudStatusTag() {
    if ((cloudConfig.url || cloud.user) && !isOnline()) return '<span class="tag warn">Offline</span>';
    if (cloud.remotePending) return '<span class="tag danger-tag">Conflict</span>';
    if (cloud.status === 'synced') return '<span class="tag success">Synced</span>';
    if (cloud.status === 'syncing') return '<span class="tag warn">Syncing</span>';
    if (cloud.status === 'error') return '<span class="tag danger-tag">Error</span>';
    if (cloud.user) return '<span class="tag success">Connected</span>';
    if (cloudConfig.url && cloudConfig.key) return '<span class="tag">Configured</span>';
    return '<span class="tag">Local</span>';
  }

function bindSettings() {
    app.querySelector('#runReleaseCheckBtn')?.addEventListener('click', () => runReleaseCheck(true));
    app.querySelector('#repairLocalBtn')?.addEventListener('click', repairLocalData);
    app.querySelector('#restoreMigrationBtn')?.addEventListener('click', restoreMigrationBackup);
    app.querySelector('#restoreSafetyBtn')?.addEventListener('click', restoreSafetyBackup);
    app.querySelector('#retryFailedBtn')?.addEventListener('click', retryFailedSync);
    app.querySelector('#targetsForm')?.addEventListener('submit', e => {
      e.preventDefault(); const cal = Number(app.querySelector('#settingsCalories').value), protein = Number(app.querySelector('#settingsProtein').value), before = clone(state.profile);
      state.profile.calorieTarget = cal; state.profile.proteinTarget = protein; state.profile.targetsConfirmed = true;
      const date = localDateKey(), day = ensureDayLog(date, false); day.calorieTarget = cal; day.proteinTarget = protein; day.updatedAt = nowIso(); state.dayLogs[date] = day;
      logChange('update', 'profile', 'profile', before, state.profile); queueProfile(); queueUpsertDay(date); saveState(); showToast('Targets saved from today'); flushQueue();
    });
    app.querySelector('#cloudConfigForm')?.addEventListener('submit', async e => {
      e.preventDefault(); const nextUrl = app.querySelector('#cloudUrl').value.trim().replace(/\/$/, ''), nextKey = app.querySelector('#cloudKey').value.trim(), sameProject = nextUrl === cloudConfig.url && nextKey === cloudConfig.key;
      if (isUnsafeSupabaseKey(nextKey)) { showToast('Refused secret/service-role key — use a publishable key'); return; }
      cloudConfig.url = nextUrl; cloudConfig.key = nextKey; if (!sameProject) { cloudConfig.activated = false; clearCloudBaselines(); cloud.remotePending = false; } saveCloudConfig(); await initCloud(true); renderSettings();
    });
    app.querySelector('#forgetCloudBtn')?.addEventListener('click', async () => { if (!confirm('Forget the Supabase connection on this device? Local diet data will stay; pending transport operations will be cleared.')) return; await disposeCloudClient(); cloudConfig = { url: '', key: '', activated: false }; state.syncQueue = []; clearCloudBaselines(); saveCloudConfig(); saveState(); cloud = createCloudState(); updateSyncPill(); renderSettings(); });
    app.querySelector('#authForm')?.addEventListener('submit', async e => { e.preventDefault(); await signIn(app.querySelector('#authEmail').value.trim(), app.querySelector('#authPassword').value); });
    app.querySelector('#signUpBtn')?.addEventListener('click', async () => { const email = app.querySelector('#authEmail')?.value.trim(), pass = app.querySelector('#authPassword')?.value; if (!email || !pass) { showToast('Enter email and password first'); return; } await signUp(email, pass); });
    app.querySelector('#signOutBtn')?.addEventListener('click', signOut);
    app.querySelector('#syncNowBtn')?.addEventListener('click', async () => { await flushQueue(true); if (cloudConfig.activated) await downloadCloudData(false, { silent: true }); });
    app.querySelector('#uploadCloudBtn')?.addEventListener('click', uploadLocalData);
    app.querySelector('#downloadCloudBtn')?.addEventListener('click', () => downloadCloudData(true));
    app.querySelector('#exportBtn')?.addEventListener('click', exportJson);
    app.querySelector('#importFile')?.addEventListener('change', importJson);
    app.querySelector('#copyDebugBtn')?.addEventListener('click', copyDebugSummary);
    app.querySelector('#copyAiContextBtn')?.addEventListener('click', copyAiContext);
    app.querySelector('#refreshAiBtn')?.addEventListener('click', refreshAiActions);
    app.querySelectorAll('[data-undo-ai]').forEach(btn => btn.addEventListener('click', () => undoAiAction(btn.dataset.undoAi)));
    app.querySelector('#keepLocalBtn')?.addEventListener('click', () => resolveRemoteConflict('local'));
    app.querySelector('#useCloudBtn')?.addEventListener('click', () => resolveRemoteConflict('cloud'));
    app.querySelector('#installAppBtn')?.addEventListener('click', installPwa);
    app.querySelector('#resetBtn')?.addEventListener('click', () => {
      if (!confirm('Reset local Diet Copilot data on this device? Cloud data is not deleted. A safety backup will be kept.')) return;
      if (!prepareDestructiveAction('before local reset')) return;
      state = clone(defaultState); cloudConfig.activated = false; unsubscribeRealtime(); saveCloudConfig(); saveState(); showToast('Local data reset; cloud sync deactivated'); render();
    });
  }


'use strict';

function buildLocalAiContext(days = 14) {
    const endDate = localDateKey(), n = Math.max(1, Math.min(Number(days || 14), 90));
    const dates = Array.from({ length: n }, (_, i) => offsetDateKey(-(n - 1 - i)));
    const todayTotals = totalsFor(endDate), todayTargets = targetsFor(endDate);
    return {
      generated_at: nowIso(), end_date: endDate, days_requested: n,
      profile: clone(state.profile),
      today: { log_date: endDate, status: getStatus(endDate), calorie_target: todayTargets.calories, protein_target: todayTargets.protein, calories_consumed: todayTotals.calories, protein_consumed: todayTotals.protein, calories_remaining: todayTargets.calories - todayTotals.calories, meal_count: mealsFor(endDate).length },
      recent_days: dates.filter(d => state.dayLogs[d] || mealsFor(d).length).map(d => { const t = totalsFor(d), target = targetsFor(d); return { log_date: d, status: getStatus(d), calorie_target: target.calories, protein_target: target.protein, calories_consumed: t.calories, protein_consumed: t.protein, meal_count: mealsFor(d).length, calories_remaining: target.calories - t.calories }; }),
      recent_weights: [...state.weights].sort((a,b)=>a.date.localeCompare(b.date)).slice(-30),
      today_meals: mealsFor(endDate).map(m => ({ id:m.id, log_date:m.date, meal_type:m.type, title:m.title, calories:mealTotals(m).calories, protein:mealTotals(m).protein, calories_low:mealRange(m).low, calories_high:mealRange(m).high, confidence:m.confidence, source:m.source, original_input:m.originalInput, notes:m.notes, updated_at:m.updatedAt, items:clone(m.items) })),
      saved_foods: sortUsuals(state.savedFoods).slice(0,30),
      saved_meals: sortUsuals(state.savedMeals).slice(0,20),
      recent_ai_actions: [...state.aiActions].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,10)
    };
  }

async function copyAiContext() {
    let payload;
    try {
      if (cloud.client && cloud.user && cloudConfig.activated) {
        const { data, error } = await cloud.client.rpc('get_diet_context', { p_end_date: localDateKey(), p_days: 14 });
        if (error) throw error;
        payload = data;
      } else payload = buildLocalAiContext(14);
      await copyText(JSON.stringify(payload, null, 2));
      showToast('14-day AI context copied');
    } catch (e) { showToast(`AI context failed: ${e.message || e}`); }
  }

async function refreshAiActions(silent = false) {
    if (!cloud.client || !cloud.user || !cloudConfig.activated) { if (!silent) showToast('Cloud bridge is not active'); return; }
    try {
      const { data, error } = await cloud.client.from('ai_actions').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      state.aiActions = (data || []).map(a => ({ id:a.id, requestId:a.request_id, actionType:a.action_type, entityType:a.entity_type, entityId:a.entity_id, before:a.before_data, after:a.after_data, undoneAt:a.undone_at, createdAt:a.created_at }));
      saveState(); if (currentView === 'settings') renderSettings(); if (!silent) showToast('AI activity refreshed');
    } catch (e) { if (!silent) showToast(`AI activity failed: ${e.message || e}`); }
  }

async function undoAiAction(id) {
    if (!cloud.client || !cloud.user || !cloudConfig.activated) return;
    if (state.syncQueue.length) { showToast('Sync local changes before undoing an AI action'); return; }
    if (!confirm('Undo this AI database action?')) return;
    setCloudBusy(true);
    try {
      const { error } = await cloud.client.rpc('undo_ai_action', { p_action_id: id }); if (error) throw error;
      cloud.remotePending = false; await downloadCloudData(false, { silent: true, force: true }); await refreshAiActions(true); showToast('AI action undone');
    } catch (e) { showToast(`Undo failed: ${e.message || e}`); }
    finally { cloud.busy = false; updateSyncPill(); if (currentView === 'settings') renderSettings(); }
  }

async function resolveRemoteConflict(choice) {
    if (!cloud.client || !cloud.user) return;
    if (choice === 'cloud') {
      if (!confirm('Discard unsynced local changes and replace this device with cloud data?')) return;
      if (!prepareDestructiveAction('before cloud conflict resolution')) return;
      state.syncQueue = []; saveState(); cloud.remotePending = false; cloud.remoteEventCount = 0; await downloadCloudData(false, { silent: false, force: true });
      return;
    }
    await flushQueue(true, true);
    if (state.syncQueue.length) { showToast('Some local changes still failed to sync'); return; }
    cloud.remotePending = false; cloud.remoteEventCount = 0; await downloadCloudData(false, { silent: true, force: true }); showToast('Local edits won on edited rows; other cloud changes loaded');
  }

async function installPwa() {
    if (window.matchMedia?.('(display-mode: standalone)').matches) { showToast('App is already installed'); return; }
    if (!deferredInstallPrompt) { showToast('Use your browser menu → Add to Home screen / Install app'); return; }
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; if (currentView === 'settings') renderSettings();
  }


