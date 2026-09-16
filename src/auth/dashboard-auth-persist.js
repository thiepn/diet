'use strict';

// A6 final THIEPN Account bootstrap for Diet Copilot.
// Supabase's project-scoped browser key is the single persisted auth authority
// shared by first-party THIEPN apps on thiepn.dev. Diet Copilot must not keep a
// second access/refresh-token copy in app-specific storage.
const DIET_AUTH_STORAGE_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
const LEGACY_DIET_AUTH_BACKUP_KEY = 'diet-copilot-thiepn-auth-token-backup-v2';
const LEGACY_DIET_AUTH_DB = 'diet-copilot-auth-vault';
const DIET_OAUTH_QUERY_KEYS = ['code', 'sb_flow_id', 'error', 'error_code', 'error_description'];

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

function dietReadWebOAuthCallback() {
  const url = new URL(location.href);
  return {
    url,
    code: url.searchParams.get('code'),
    flowId: url.searchParams.get('sb_flow_id'),
    error: url.searchParams.get('error_description') || url.searchParams.get('error_code') || url.searchParams.get('error')
  };
}

function dietStripWebOAuthCallback(url) {
  try {
    const clean = new URL(url.href);
    for (const key of DIET_OAUTH_QUERY_KEYS) clean.searchParams.delete(key);
    const next = `${clean.pathname}${clean.search}${clean.hash}`;
    history.replaceState(null, '', next || clean.pathname);
  } catch {}
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

    // The web callback is exchanged explicitly below. This guarantees that the
    // exact canonical Diet client which owns the PKCE verifier performs the
    // exchange, instead of relying on implicit URL detection during startup.
    cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: DIET_AUTH_STORAGE_KEY
      }
    });

    const callback = dietReadWebOAuthCallback();
    let initialSession = null;

    if (callback.error) {
      dietStripWebOAuthCallback(callback.url);
      throw new Error(callback.error);
    }

    if (callback.code) {
      const exchangeOptions = callback.flowId ? { flowId: callback.flowId } : undefined;
      const { data: exchanged, error: exchangeError } = await cloud.client.auth.exchangeCodeForSession(
        callback.code,
        exchangeOptions
      );
      dietStripWebOAuthCallback(callback.url);
      if (exchangeError) throw exchangeError;
      if (!exchanged?.session?.user) {
        throw new Error('Google sign-in completed, but Diet Copilot did not receive a session.');
      }
      initialSession = exchanged.session;
    } else {
      const { data: stored, error: storedError } = await cloud.client.auth.getSession();
      if (storedError) throw storedError;
      initialSession = stored.session || null;
    }

    applyCloudSession(initialSession);

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
