'use strict';

// Stable first-party auth persistence layer.
// Supabase already supports persistSession, but explicitly pinning the storage
// adapter/key avoids browser-specific reload issues and lets us migrate any
// previously stored default session into a Diet Copilot-owned key.
const DIET_AUTH_STORAGE_KEY = 'diet-copilot-auth-session-v1';
const DIET_AUTH_LEGACY_KEY = 'sb-mrrqsqawwxwebsdmrnre-auth-token';

function dietAuthStorageAvailable() {
  try {
    const key = '__diet_auth_storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const dietAuthStorage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { console.warn('Diet Copilot auth storage write failed', error); }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch (error) { console.warn('Diet Copilot auth storage remove failed', error); }
  }
};

function migrateDietAuthStorage() {
  if (!dietAuthStorageAvailable()) return false;
  const suffixes = ['', '-code-verifier', '-user'];
  for (const suffix of suffixes) {
    const from = `${DIET_AUTH_LEGACY_KEY}${suffix}`;
    const to = `${DIET_AUTH_STORAGE_KEY}${suffix}`;
    try {
      if (localStorage.getItem(to) == null && localStorage.getItem(from) != null) {
        localStorage.setItem(to, localStorage.getItem(from));
      }
    } catch {}
  }
  return true;
}

function applyCloudSession(session) {
  cloud.user = session?.user || null;
  cloud.status = cloud.user ? 'online' : 'configured';
  updateStatus();
  if (connectionDialog.open) renderConnection();
}

initCloud = async function initCloudPersistent(showDialog = false) {
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
    // Tear down an existing in-memory client without signing the user out.
    if (cloud.client) await disposeCloud();

    const hasPersistentStorage = migrateDietAuthStorage();
    const authOptions = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: DIET_AUTH_STORAGE_KEY
    };
    if (hasPersistentStorage) authOptions.storage = dietAuthStorage;

    cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, {
      auth: authOptions
    });

    let initialResolved = false;
    let resolveInitial;
    const initialSessionPromise = new Promise(resolve => { resolveInitial = resolve; });

    const { data: listener } = cloud.client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        initialResolved = true;
        applyCloudSession(session);
        resolveInitial(session || null);
        return;
      }

      const before = cloud.user?.id || null;
      applyCloudSession(session);

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

    // INITIAL_SESSION is the canonical storage-restoration event. Keep a
    // getSession fallback for browsers where it arrives unusually late.
    let session = null;
    try {
      session = await Promise.race([
        initialSessionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('auth-init-timeout')), 1800))
      ]);
    } catch {
      const { data, error } = await cloud.client.auth.getSession();
      if (error) throw error;
      session = data.session || null;
      applyCloudSession(session);
    }

    if (!initialResolved && session) applyCloudSession(session);

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
