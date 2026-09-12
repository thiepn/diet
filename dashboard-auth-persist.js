'use strict';

// Diet Copilot auth persistence.
// Supabase normally persists auth in localStorage. Some desktop/browser setups
// can lose or fail to restore that state on reload, so Diet Copilot keeps an
// independent first-party IndexedDB recovery copy of the session tokens.
// No password is ever stored.
const DIET_AUTH_STORAGE_KEY = 'diet-copilot-auth-session-v1';
const DIET_AUTH_LEGACY_KEY = 'sb-mrrqsqawwxwebsdmrnre-auth-token';
const DIET_AUTH_BACKUP_KEY = 'diet-copilot-auth-token-backup-v1';
const DIET_AUTH_DB = 'diet-copilot-auth-vault';
const DIET_AUTH_STORE = 'sessions';
const DIET_AUTH_RECORD = 'primary';

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
    try { localStorage.setItem(key, value); }
    catch (error) { console.warn('Diet Copilot auth storage write failed', error); }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); }
    catch (error) { console.warn('Diet Copilot auth storage remove failed', error); }
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

function dietAuthOpenVault() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DIET_AUTH_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DIET_AUTH_STORE)) {
        db.createObjectStore(DIET_AUTH_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function dietAuthVaultPut(value) {
  try {
    const db = await dietAuthOpenVault();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DIET_AUTH_STORE, 'readwrite');
      tx.objectStore(DIET_AUTH_STORE).put(value, DIET_AUTH_RECORD);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
    });
    db.close();
    return true;
  } catch (error) {
    console.warn('Diet Copilot IndexedDB auth backup failed', error);
    return false;
  }
}

async function dietAuthVaultGet() {
  try {
    const db = await dietAuthOpenVault();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(DIET_AUTH_STORE, 'readonly');
      const request = tx.objectStore(DIET_AUTH_STORE).get(DIET_AUTH_RECORD);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
    });
    db.close();
    return value;
  } catch {
    return null;
  }
}

async function dietAuthVaultDelete() {
  try {
    const db = await dietAuthOpenVault();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DIET_AUTH_STORE, 'readwrite');
      tx.objectStore(DIET_AUTH_STORE).delete(DIET_AUTH_RECORD);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed'));
    });
    db.close();
  } catch {}
}

function dietAuthTokenRecord(session) {
  if (!session?.access_token || !session?.refresh_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || null,
    saved_at: Date.now()
  };
}

async function persistDietAuthRecovery(session) {
  const record = dietAuthTokenRecord(session);
  if (!record) return;
  try { localStorage.setItem(DIET_AUTH_BACKUP_KEY, JSON.stringify(record)); } catch {}
  await dietAuthVaultPut(record);
}

async function readDietAuthRecovery() {
  let local = null;
  try {
    local = JSON.parse(localStorage.getItem(DIET_AUTH_BACKUP_KEY) || 'null');
  } catch {}
  if (local?.access_token && local?.refresh_token) return local;
  const vault = await dietAuthVaultGet();
  return vault?.access_token && vault?.refresh_token ? vault : null;
}

async function clearDietAuthRecovery() {
  try { localStorage.removeItem(DIET_AUTH_BACKUP_KEY); } catch {}
  await dietAuthVaultDelete();
}

function applyCloudSession(session) {
  cloud.user = session?.user || null;
  cloud.status = cloud.user ? 'online' : 'configured';
  updateStatus();
  if (connectionDialog.open) renderConnection();
}

async function recoverDietAuthSession(client) {
  const recovery = await readDietAuthRecovery();
  if (!recovery) return null;
  try {
    const { data, error } = await client.auth.setSession({
      access_token: recovery.access_token,
      refresh_token: recovery.refresh_token
    });
    if (error) throw error;
    if (data.session) {
      await persistDietAuthRecovery(data.session);
      return data.session;
    }
  } catch (error) {
    console.warn('Diet Copilot auth recovery failed', error);
    await clearDietAuthRecovery();
  }
  return null;
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
    // Tear down only an already-existing in-memory client. auth.dispose() does
    // not sign out or remove persisted credentials.
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
      if (session && ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        persistDietAuthRecovery(session).catch(()=>{});
      }
      if (event === 'SIGNED_OUT') {
        clearDietAuthRecovery().catch(()=>{});
      }

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

    // First use Supabase's normal persisted-session restoration.
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
    }

    // If the browser lost/failed to restore Supabase's normal localStorage
    // state, recover the refresh/access token pair from our IndexedDB vault.
    if (!session) {
      session = await recoverDietAuthSession(cloud.client);
    }

    if (!initialResolved || session) applyCloudSession(session);

    if (session) await persistDietAuthRecovery(session);

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
