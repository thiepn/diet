'use strict';

// A6 final THIEPN Account bootstrap for Diet Copilot.
// Supabase's project-scoped browser key is the single persisted auth authority
// shared by first-party THIEPN apps on thiepn.dev. Diet Copilot must not keep a
// second access/refresh-token copy in app-specific storage.
const DIET_AUTH_STORAGE_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
const LEGACY_DIET_AUTH_BACKUP_KEY = 'diet-copilot-thiepn-auth-token-backup-v2';
const LEGACY_DIET_AUTH_DB = 'diet-copilot-auth-vault';

function cleanupLegacyDietAuthArtifacts() {
  // Targeted cleanup only. Never clear all localStorage because Diet Copilot
  // keeps legitimate user/application state alongside auth metadata.
  try { localStorage.removeItem(LEGACY_DIET_AUTH_BACKUP_KEY); } catch {}
  try {
    if ('indexedDB' in window) indexedDB.deleteDatabase(LEGACY_DIET_AUTH_DB);
  } catch {}
}

function applyCloudSession(session) {
  cloud.user = session?.user || null;
  cloud.status = cloud.user ? 'online' : 'configured';
  updateStatus();
  if (connectionDialog.open) renderConnection();
}

cleanupLegacyDietAuthArtifacts();

initCloud = async function initCloudFinal(showDialog = false) {
  cloud.error = null;

  if (!configured()) {
    await disposeCloud();
    cloud.status = 'cache';
    updateStatus();
    if (showDialog) openConnection();
    return;
  }

  if (!window.supabase?.createClient) {
    cloud.status = 'error';
    cloud.error = 'Supabase SDK failed to load';
    updateStatus();
    return;
  }

  try {
    if (cloud.client) await disposeCloud();

    cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: DIET_AUTH_STORAGE_KEY
      }
    });

    const { data: stored, error: storedError } = await cloud.client.auth.getSession();
    if (storedError) throw storedError;
    applyCloudSession(stored.session || null);

    const { data: listener } = cloud.client.auth.onAuthStateChange((event, nextSession) => {
      const before = cloud.user?.id || null;
      applyCloudSession(nextSession);

      if (event === 'SIGNED_IN' && cloud.user && cloud.user.id !== before) {
        queueMicrotask(() => {
          refreshData({ silent: true });
          subscribeRealtime();
        });
      }

      if (event === 'SIGNED_OUT' && cloud.channel) {
        cloud.client.removeChannel(cloud.channel).catch(() => {});
        cloud.channel = null;
      }
    });
    cloud.authSubscription = listener?.subscription || null;

    if (cloud.user) {
      await refreshData({ silent: true });
      await subscribeRealtime();
    }

    updateStatus();
    if (showDialog) openConnection();
  } catch (error) {
    cloud.status = 'error';
    cloud.error = error?.message || String(error);
    updateStatus();
    if (showDialog) openConnection();
  }
};
