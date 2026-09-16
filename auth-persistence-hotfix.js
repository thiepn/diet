'use strict';

// Static10 compatibility repair. The consolidated source contains the canonical
// implementation; this layer only exists so the persistence fix can ship even
// when the full bundle rebuild queue is delayed. Once the canonical persistence
// assertion exists in diet-app.js, this file intentionally becomes a no-op.
(() => {
  if (typeof dietAssertSessionPersisted === 'function') return;
  if (typeof dietRawAuthStorageGet !== 'function' ||
      typeof dietRawAuthStorageSet !== 'function' ||
      typeof dietRawAuthStorageRemove !== 'function' ||
      typeof applyCloudSession !== 'function') return;

  const authKey = 'sb-hycegznamzjhwinegaai-auth-token';
  const fallbackPrefix = 'diet-copilot:auth-fallback:';

  function persistentGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }

  function persistentSet(key, value) {
    try {
      localStorage.setItem(key, value);
      if (localStorage.getItem(key) !== value) {
        throw new Error('Persistent auth storage verification failed.');
      }
    } catch {
      throw new Error('Persistent browser storage is unavailable. Diet Copilot cannot keep you signed in on this device.');
    }
  }

  function persistentRemove(key) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(`${fallbackPrefix}${key}`); } catch {}
  }

  function verifySession(session) {
    if (!session?.user?.id) return;
    const raw = persistentGet(authKey);
    if (!raw) {
      throw new Error('Diet Copilot received a session, but could not persist it. Enable persistent site storage to stay signed in.');
    }
    try {
      const stored = JSON.parse(raw);
      if (stored?.user?.id !== session.user.id || !stored?.refresh_token) {
        throw new Error('Persisted session verification failed.');
      }
    } catch {
      throw new Error('Diet Copilot could not verify the persisted login session. Sign in again after enabling persistent site storage.');
    }
  }

  // Recover a session that an older build put in tab-only storage while this
  // tab is still alive. Never keep a second long-lived token copy afterward.
  try {
    const fallbackKey = `${fallbackPrefix}${authKey}`;
    const transient = sessionStorage.getItem(fallbackKey);
    if (transient !== null && persistentGet(authKey) === null) {
      persistentSet(authKey, transient);
    }
    sessionStorage.removeItem(fallbackKey);
  } catch (error) {
    console.warn('Diet Copilot could not migrate transient auth storage', error);
  }

  // dietAuthStorage calls these bindings dynamically, so replacing the three
  // primitives upgrades the already-created Supabase client as well as future
  // clients without creating another token authority.
  dietRawAuthStorageGet = persistentGet;
  dietRawAuthStorageSet = persistentSet;
  dietRawAuthStorageRemove = persistentRemove;

  const applyCloudSessionBeforePersistenceRepair = applyCloudSession;
  applyCloudSession = function applyCloudSessionPersistent(session) {
    if (session?.user?.id) verifySession(session);
    return applyCloudSessionBeforePersistenceRepair(session);
  };

  window.DietAuthPersistenceHotfix = Object.freeze({
    version: 'static10',
    storage: 'localStorage-only',
    verify: () => {
      const raw = persistentGet(authKey);
      return Boolean(raw);
    }
  });
})();
