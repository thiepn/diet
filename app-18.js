'use strict';
  async function signUp(email, password) { if (!cloud.client) return; setCloudBusy(true); const { data, error } = await cloud.client.auth.signUp({ email, password }); setCloudBusy(false); if (error) { showToast(error.message); return; } cloud.user = data.user || null; showToast(data.session ? 'Account created and signed in' : 'Account created — check email if confirmation is enabled'); renderSettings(); }
  async function signOut() { if (!cloud.client) return; if (state.syncQueue.length && !confirm('There are unsynced local changes. Sign out anyway? They remain in local data, but this cloud link will be deactivated so they cannot sync into a different account by mistake.')) return; await unsubscribeRealtime(); await cloud.client.auth.signOut(); cloud.user = null; cloud.status = 'configured'; cloudConfig.activated = false; state.syncQueue = []; clearCloudBaselines(); saveCloudConfig(); saveState(); updateSyncPill(); renderSettings(); showToast('Signed out; cloud sync deactivated'); }
  function setCloudBusy(v) { cloud.busy = v; cloud.status = v ? 'syncing' : (cloud.user ? 'connected' : 'configured'); updateSyncPill(); }

  async function flushQueue(force = false, allowConflictOverwrite = false) {
    if (!cloud.client || !cloud.user || (!cloudConfig.activated && !force) || cloud.busy || !state.syncQueue.length) return;
    if (!isOnline()) { cloud.status = 'offline'; updateSyncPill(); if (currentView === 'settings') renderSettings(); return; }
    const now = Date.now(), ready = state.syncQueue.filter(op => force || (Number(op.attempts || 0) < 5 && (!op.nextRetryAt || new Date(op.nextRetryAt).getTime() <= now)));
    if (!ready.length) { scheduleSyncRetry(); return; }
    setCloudBusy(true); let completed = 0, failed = null;
    try {
      for (const op of ready) {
        if (!allowConflictOverwrite && BASELINE_TABLES.has(op.table) && op.expectedUpdatedAt) {
          const remoteUpdatedAt = await fetchRemoteUpdatedAt(op);
          if (!sameServerVersion(remoteUpdatedAt, op.expectedUpdatedAt)) {
            const q = state.syncQueue.find(x => x.id === op.id);
            if (q) { q.conflict = true; q.attempts = 5; q.lastError = `${op.table}: cloud row changed since this device last synced`; q.nextRetryAt = null; }
            cloud.remotePending = true; cloud.remoteEventCount = Number(cloud.remoteEventCount || 0) + 1;
            saveState(); failed = q?.lastError || 'Cloud conflict'; break;
          }
        }
        let query;
        if (op.kind === 'delete') {
          query = op.table === 'profiles' ? cloud.client.from(op.table).delete().eq('user_id', cloud.user.id) : cloud.client.from(op.table).delete().eq('id', op.rowId);
          const { error } = await query;
          if (error) throw error;
          setCloudBaseline(op.table, op.rowId, null);
        } else {
          const payload = { ...op.payload, user_id: cloud.user.id };
          const onConflict = op.table === 'profiles' ? 'user_id' : op.table === 'daily_logs' ? 'user_id,log_date' : op.table === 'weight_entries' ? 'user_id,entry_date' : 'id';
          const selectCols = op.table === 'profiles' ? 'user_id,updated_at' : 'id,updated_at';
          const { data, error } = await cloud.client.from(op.table).upsert(payload, { onConflict }).select(selectCols).maybeSingle();
          if (error) throw error;
          setCloudBaseline(op.table, op.rowId, data?.updated_at || op.payload?.updated_at || nowIso());
        }
        state.syncQueue = state.syncQueue.filter(q => q.id !== op.id); completed++; saveState();
      }
      if (failed) {
        cloud.status = cloud.remotePending ? 'conflict' : 'error'; cloud.error = failed;
        if (!cloud.remotePending) scheduleSyncRetry();
        showToast(cloud.remotePending ? 'Sync conflict detected — choose a resolution in Settings' : `Sync paused: ${failed}`);
      } else { cloud.status = 'synced'; cloud.lastSyncAt = nowIso(); cloud.error = null; if (completed) showToast(`Synced ${completed} change${completed === 1 ? '' : 's'}`); }
    } catch (e) {
      const current = ready.find(op => state.syncQueue.some(q => q.id === op.id));
      const q = current ? state.syncQueue.find(x => x.id === current.id) : null;
      if (q) { q.attempts = Number(q.attempts || 0) + 1; q.lastError = `${q.table}: ${e.message || e}`; const delays = [5000,15000,60000,300000]; q.nextRetryAt = new Date(Date.now() + delays[Math.min(q.attempts - 1, delays.length - 1)]).toISOString(); }
      saveState(); cloud.status = 'error'; cloud.error = e.message || String(e); scheduleSyncRetry(); showToast(`Sync paused: ${cloud.error}`);
    } finally { cloud.busy = false; updateSyncPill(); if (currentView === 'settings') renderSettings(); drainDeferredRefresh(); }
  }

  function scheduleSyncRetry() {
    clearTimeout(syncRetryTimer);
    if (!cloud.client || !cloud.user || !cloudConfig.activated || !state.syncQueue.length) return;
    const times = state.syncQueue.filter(q => Number(q.attempts || 0) < 5).map(q => q.nextRetryAt ? new Date(q.nextRetryAt).getTime() : Date.now()).filter(Number.isFinite);
    if (!times.length) return;
    const wait = Math.max(1000, Math.min(300000, Math.min(...times) - Date.now()));
    syncRetryTimer = setTimeout(() => flushQueue(false), wait);
  }
