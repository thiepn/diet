'use strict';

// THIEPN Account auth persistence for Diet Copilot.
// All THIEPN apps on thiepn.dev use Supabase's standard project-scoped storage
// key so a valid session can be reused across app paths. Diet Copilot keeps an
// additional first-party IndexedDB recovery copy for browsers that restore
// localStorage unreliably. No password is ever stored.
const DIET_AUTH_STORAGE_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
const DIET_AUTH_BACKUP_KEY = 'diet-copilot-thiepn-auth-token-backup-v2';
const DIET_AUTH_DB = 'diet-copilot-auth-vault';
const DIET_AUTH_STORE = 'sessions';
const DIET_AUTH_RECORD = 'thiepn-account-v1';

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
    catch (error) { console.warn('THIEPN Account auth storage write failed', error); }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); }
    catch (error) { console.warn('THIEPN Account auth storage remove failed', error); }
  }
};

function prepareDietAuthStorage() {
  // Do not migrate Diet Copilot's previous project tokens. They were issued by
  // a different Supabase project and must never be promoted into THIEPN Account.
  return dietAuthStorageAvailable();
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
      if (!db.objectStoreNames.contains(DIET_AUTH_STORE)) db.createObjectStore(DIET_AUTH_STORE);
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
  try { local = JSON.parse(localStorage.getItem(DIET_AUTH_BACKUP_KEY) || 'null'); } catch {}
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
  cloud.accountHandoff = window.dietAccountPlatform?.adoptSession(session) || {
    signedIn: Boolean(cloud.user),
    requiresAdditionalVerification: false,
    assuranceLevel: 'aal1'
  };
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
    // Only discard the THIEPN Account backup after Supabase has rejected the
    // stored token pair. A transient empty startup state is not a logout.
    console.warn('THIEPN Account auth recovery rejected', error);
    await clearDietAuthRecovery();
  }
  return null;
}

// Used by explicit Sign out UI only. Do not call this from transient auth
// events during page startup.
window.clearDietAuthRecovery = clearDietAuthRecovery;

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
    if (cloud.client) await disposeCloud();

    const hasPersistentStorage = prepareDietAuthStorage();
    const authOptions = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: DIET_AUTH_STORAGE_KEY
    };
    if (hasPersistentStorage) authOptions.storage = dietAuthStorage;

    cloud.client = window.supabase.createClient(cloudConfig.url, cloudConfig.key, { auth: authOptions });

    // Critical ordering for Zen/Firefox:
    // 1) read the shared THIEPN Account session
    // 2) if empty, recover from Diet Copilot's same-project recovery vault
    // 3) only then register the normal auth listener / render signed-out state
    let session = null;
    const { data: stored, error: storedError } = await cloud.client.auth.getSession();
    if (storedError) throw storedError;
    session = stored.session || null;

    if (!session) session = await recoverDietAuthSession(cloud.client);

    applyCloudSession(session);
    if (session) await persistDietAuthRecovery(session);

    const { data: listener } = cloud.client.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession && ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        persistDietAuthRecovery(nextSession).catch(()=>{});
      }

      const before = cloud.user?.id || null;
      applyCloudSession(nextSession);

      if (event === 'SIGNED_IN' && cloud.user && cloud.user.id !== before) {
        queueMicrotask(() => {
          refreshData({ silent: true });
          subscribeRealtime();
        });
      }

      if (event === 'SIGNED_OUT' && cloud.channel) {
        cloud.client.removeChannel(cloud.channel).catch(()=>{});
        cloud.channel = null;
      }
      // Deliberately do not erase the recovery vault here. Firefox/Zen can
      // produce transient signed-out states during client/bootstrap lifecycle.
      // The explicit Sign out button owns permanent recovery-data deletion.
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
