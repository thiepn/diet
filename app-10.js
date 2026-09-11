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
    app.querySelector('#retryFailedBtn')?.addEventListener('click', retryFailedSync);
    app.querySelector('#targetsForm')?.addEventListener('submit', e => {
      e.preventDefault(); const cal = Number(app.querySelector('#settingsCalories').value), protein = Number(app.querySelector('#settingsProtein').value), before = clone(state.profile);
      state.profile.calorieTarget = cal; state.profile.proteinTarget = protein;
      const date = localDateKey(), day = ensureDayLog(date, false); day.calorieTarget = cal; day.proteinTarget = protein; day.updatedAt = nowIso(); state.dayLogs[date] = day;
      logChange('update', 'profile', 'profile', before, state.profile); queueProfile(); queueUpsertDay(date); saveState(); showToast('Targets saved from today'); flushQueue();
    });
    app.querySelector('#cloudConfigForm')?.addEventListener('submit', async e => {
      e.preventDefault(); const nextUrl = app.querySelector('#cloudUrl').value.trim().replace(/\/$/, ''), nextKey = app.querySelector('#cloudKey').value.trim(), sameProject = nextUrl === cloudConfig.url && nextKey === cloudConfig.key;
      if (isUnsafeSupabaseKey(nextKey)) { showToast('Refused secret/service-role key — use a publishable key'); return; }
      cloudConfig.url = nextUrl; cloudConfig.key = nextKey; if (!sameProject) { cloudConfig.activated = false; clearCloudBaselines(); cloud.remotePending = false; } saveCloudConfig(); await initCloud(true); renderSettings();
    });
    app.querySelector('#forgetCloudBtn')?.addEventListener('click', async () => { if (!confirm('Forget the Supabase connection on this device? Local diet data will stay; pending transport operations will be cleared.')) return; await unsubscribeRealtime(); cloudConfig = { url: '', key: '', activated: false }; state.syncQueue = []; clearCloudBaselines(); saveCloudConfig(); saveState(); cloud = { client: null, user: null, status: 'local', busy: false, lastSyncAt: null, error: null, channel: null, remotePending: false, remoteEventCount: 0, deferredRefresh: false, health: null, healthCheckedAt: null }; updateSyncPill(); renderSettings(); });
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
    app.querySelector('#resetBtn')?.addEventListener('click', () => { if (!confirm('Reset local Diet Copilot data on this device? Cloud data is not deleted.')) return; state = clone(defaultState); saveState(); showToast('Local data reset'); render(); });
  }
