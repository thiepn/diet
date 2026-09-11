'use strict';
  async function runReleaseCheck(showFeedback = true) {
    qaReport = { generatedAt: nowIso(), local: localIntegrityReport(), cloud: null };
    if (currentView === 'settings') renderSettings();
    if (cloud.client && cloud.user && cloudConfig.activated) {
      if (!isOnline()) qaReport.cloud = { level: 'warn', detail: 'Offline — cloud schema not checked' };
      else {
        try {
          const { data, error } = await cloud.client.rpc('diet_copilot_healthcheck');
          if (error) throw error;
          cloud.health = data; cloud.healthCheckedAt = nowIso();
          const versionOk = Number(data?.schema_version) >= 5;
          const integrity = data?.integrity || {};
          const orphanTotal = Object.values(integrity).reduce((a,v) => a + (Number(v) || 0), 0);
          qaReport.cloud = { level: versionOk && orphanTotal === 0 ? 'pass' : 'fail', detail: versionOk ? (orphanTotal ? `${orphanTotal} cloud integrity issue${orphanTotal === 1 ? '' : 's'}` : `Schema v${data.schema_version} · RLS/RPC reachable`) : `Schema v${data?.schema_version ?? '?'} — install V0.5 upgrade` };
        } catch (e) {
          qaReport.cloud = { level: 'fail', detail: `Health check failed: ${e.message || e}. Run the V0.5 SQL upgrade.` };
        }
      }
    } else if (cloudConfig.url || cloud.user) qaReport.cloud = { level: 'warn', detail: 'Cloud configured but not fully activated' };
    else qaReport.cloud = { level: 'pass', detail: 'Local-only mode; no cloud dependency' };
    qaReport.generatedAt = nowIso();
    if (currentView === 'settings') renderSettings();
    if (showFeedback) showToast(qaReport.local.failures || qaReport.cloud?.level === 'fail' ? 'Release check found issues' : 'Release check complete');
  }

  async function repairLocalData() {
    if (!confirm('Normalize local Diet Copilot data and repair safe structural issues? A repair backup will be saved first.')) return;
    try { localStorage.setItem(REPAIR_BACKUP_KEY, JSON.stringify({ capturedAt: nowIso(), state })); } catch {}
    state = normalizeState(state);
    [...new Set(state.meals.map(m => m.date))].forEach(date => ensureDayLog(date, false));
    const latest = new Map(); state.syncQueue.forEach(op => latest.set(`${op.table}:${op.rowId || op.id}`, op)); state.syncQueue = [...latest.values()];
    saveState(); render(); await runReleaseCheck(false); showToast('Safe local repairs applied');
  }

  async function retryFailedSync() {
    if (!cloud.client || !cloud.user) { showToast('Sign in to retry cloud sync'); return; }
    let changed = 0;
    state.syncQueue.forEach(q => { if (q.lastError && !q.conflict) { q.attempts = 0; q.lastError = null; q.nextRetryAt = null; changed++; } });
    saveState(); if (!changed) { showToast('No retryable failed operations'); return; }
    await flushQueue(true);
  }

  function restoreMigrationBackup() {
    let backup;
    try { backup = JSON.parse(localStorage.getItem(MIGRATION_BACKUP_KEY) || 'null'); } catch {}
    if (!backup?.state) { showToast('No pre-V0.5 migration backup found'); return; }
    if (!confirm(`Restore the local backup captured from ${backup.sourceKey || 'the previous version'}? Current local data will be replaced and automatic cloud sync disabled.`)) return;
    state = normalizeState(backup.state); state.syncQueue = []; clearCloudBaselines(); cloudConfig.activated = false; saveCloudConfig(); saveState(); render(); showToast('Pre-V0.5 local backup restored');
  }

