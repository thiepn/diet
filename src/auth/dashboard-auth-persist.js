'use strict';

// A6 final THIEPN Account bootstrap for Diet Copilot.
// Supabase's project-scoped browser key is the single persisted auth authority
// shared by first-party THIEPN apps on thiepn.dev. Diet Copilot must not keep a
// second access/refresh-token copy in app-specific storage.
const DIET_AUTH_STORAGE_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
const LEGACY_DIET_AUTH_BACKUP_KEY = 'diet-copilot-thiepn-auth-token-backup-v2';
const LEGACY_DIET_AUTH_DB = 'diet-copilot-auth-vault';
const DIET_OAUTH_QUERY_KEYS = ['code', 'sb_flow_id', 'error', 'error_code', 'error_description'];
const DIET_PKCE_BACKUP_KEY = 'diet-copilot:pkce-verifier-backup-v2';
const DIET_PKCE_BACKUP_LEGACY_KEY = 'diet-copilot:pkce-verifier-backup-v1';
const DIET_AUTH_FALLBACK_PREFIX = 'diet-copilot:auth-fallback:';
const DIET_PKCE_BACKUP_TTL_MS = 15 * 60 * 1000;

function cleanupLegacyDietAuthArtifacts() {
  // Targeted cleanup only. Never clear all localStorage because Diet Copilot
  // keeps legitimate user/application state alongside auth metadata.
  try { localStorage.removeItem(LEGACY_DIET_AUTH_BACKUP_KEY); } catch {}
  try { sessionStorage.removeItem(DIET_PKCE_BACKUP_LEGACY_KEY); } catch {}
  try {
    if ('indexedDB' in window) indexedDB.deleteDatabase(LEGACY_DIET_AUTH_DB);
  } catch {}
}

function dietRawAuthStorageGet(key) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  } catch {}
  try { return sessionStorage.getItem(`${DIET_AUTH_FALLBACK_PREFIX}${key}`); }
  catch { return null; }
}

function dietRawAuthStorageSet(key, value) {
  let stored = false;
  try {
    localStorage.setItem(key, value);
    stored = true;
  } catch {}
  if (!stored) {
    try {
      sessionStorage.setItem(`${DIET_AUTH_FALLBACK_PREFIX}${key}`, value);
      stored = true;
    } catch {}
  }
  if (!stored) throw new Error('Browser storage is unavailable. Google sign-in cannot continue.');
}

function dietRawAuthStorageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(`${DIET_AUTH_FALLBACK_PREFIX}${key}`); } catch {}
}

function dietReadBrowserPkceBackup() {
  try {
    const raw = sessionStorage.getItem(DIET_PKCE_BACKUP_KEY);
    if (!raw) return null;
    const backup = JSON.parse(raw);
    if (!backup || typeof backup !== 'object' || typeof backup.entries !== 'object') return null;
    const createdAt = Number(backup.createdAt || 0);
    if (!createdAt || Date.now() - createdAt > DIET_PKCE_BACKUP_TTL_MS) {
      sessionStorage.removeItem(DIET_PKCE_BACKUP_KEY);
      return null;
    }
    return backup;
  } catch {
    return null;
  }
}

function dietWriteBrowserPkceBackup(backup) {
  try {
    sessionStorage.setItem(DIET_PKCE_BACKUP_KEY, JSON.stringify(backup));
    return true;
  } catch {
    return false;
  }
}

function dietMirrorPkceStorageEntry(key, value) {
  if (!String(key).endsWith('-code-verifier')) return;
  const current = dietReadBrowserPkceBackup() || { flowId: null, createdAt: Date.now(), entries: {} };
  current.createdAt = Date.now();
  current.entries[key] = value;
  dietWriteBrowserPkceBackup(current);
}

// Supabase writes every auth value through this adapter. PKCE verifier writes
// are mirrored at write-time into tab-scoped sessionStorage. If another client
// or navigation removes a verifier before callback exchange, getItem restores
// the exact value Supabase originally wrote.
const dietAuthStorage = Object.freeze({
  getItem(key) {
    let value = dietRawAuthStorageGet(key);
    if (value == null && String(key).endsWith('-code-verifier')) {
      const backupValue = dietReadBrowserPkceBackup()?.entries?.[key];
      if (typeof backupValue === 'string') {
        dietRawAuthStorageSet(key, backupValue);
        value = backupValue;
      }
    }
    return value;
  },
  setItem(key, value) {
    dietRawAuthStorageSet(key, value);
    dietMirrorPkceStorageEntry(key, value);
  },
  removeItem(key) {
    // Do not delete the tab-scoped PKCE mirror here. Supabase may remove a
    // verifier while handling a failed/partial exchange. Diet clears the mirror
    // only after a successful session or an explicit cancelled/failed flow.
    dietRawAuthStorageRemove(key);
  }
});

function dietClearBrowserPkceBackup() {
  try { sessionStorage.removeItem(DIET_PKCE_BACKUP_KEY); } catch {}
  try { sessionStorage.removeItem(DIET_PKCE_BACKUP_LEGACY_KEY); } catch {}
}

function dietTagBrowserPkceBackupFlow(flowId = '') {
  if (!flowId) return;
  const current = dietReadBrowserPkceBackup() || { flowId: null, createdAt: Date.now(), entries: {} };
  current.flowId = flowId;
  current.createdAt = Date.now();
  dietWriteBrowserPkceBackup(current);
}

function dietRestoreBrowserPkceVerifier(flowIdHint = '') {
  const backup = dietReadBrowserPkceBackup();
  if (!backup) return flowIdHint || null;
  for (const [key, value] of Object.entries(backup.entries || {})) {
    if (!String(key).startsWith(`${DIET_AUTH_STORAGE_KEY}-`)) continue;
    if (!String(key).endsWith('-code-verifier')) continue;
    if (typeof value !== 'string') continue;
    if (dietRawAuthStorageGet(key) == null) dietRawAuthStorageSet(key, value);
  }
  return (typeof backup.flowId === 'string' && backup.flowId) || flowIdHint || null;
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

function dietPkceVerifierMissing(error) {
  const text = `${error?.name || ''} ${error?.message || error || ''}`;
  return /PKCE code verifier not found|AuthPKCECodeVerifierMissingError/i.test(text);
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

    const callback = dietReadWebOAuthCallback();
    const restoredFlowId = callback.code
      ? dietRestoreBrowserPkceVerifier(callback.flowId || '')
      : null;

    // One canonical web client owns both normal session persistence and PKCE.
    // The custom storage adapter mirrors verifier writes at source instead of
    // attempting to discover them after signInWithOAuth returns.
    cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: DIET_AUTH_STORAGE_KEY,
        storage: dietAuthStorage
      }
    });
    cloud.client.__dietAuthStorageV2 = true;

    let initialSession = null;

    if (callback.error) {
      dietStripWebOAuthCallback(callback.url);
      dietClearBrowserPkceBackup();
      if (typeof dietClearBrowserOAuthRelayState === 'function') dietClearBrowserOAuthRelayState();
      throw new Error(callback.error);
    }

    if (callback.code) {
      const effectiveFlowId = callback.flowId || restoredFlowId || null;
      let result = await cloud.client.auth.exchangeCodeForSession(
        callback.code,
        effectiveFlowId ? { flowId: effectiveFlowId } : undefined
      );

      if (result.error && effectiveFlowId && dietPkceVerifierMissing(result.error)) {
        // The adapter can restore the mirrored legacy slot on demand. This
        // fallback is only attempted for a missing-verifier error.
        result = await cloud.client.auth.exchangeCodeForSession(callback.code);
      }

      dietStripWebOAuthCallback(callback.url);
      if (result.error) throw result.error;
      if (!result.data?.session?.user) {
        throw new Error('Google sign-in completed, but Diet Copilot did not receive a session.');
      }
      initialSession = result.data.session;
      dietClearBrowserPkceBackup();
      if (typeof dietClearBrowserOAuthRelayState === 'function') dietClearBrowserOAuthRelayState();
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
