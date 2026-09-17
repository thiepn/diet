'use strict';

// Static10c compatibility repair. This layer hardens the existing Diet auth
// adapter without creating a second Supabase client. Long-lived sessions prefer
// localStorage and fall back to secure first-party cookies when localStorage is
// unavailable. Temporary PKCE state remains tab-scoped. After the adapter is
// installed, Diet performs one post-bootstrap session rehydration so a session
// stored in the cookie fallback is visible on a fresh tab before the UI settles
// into the signed-out state.
(() => {
  if (window.DietAuthPersistenceHotfix?.version === 'static10c') return;
  if (typeof dietRawAuthStorageGet !== 'function' ||
      typeof dietRawAuthStorageSet !== 'function' ||
      typeof dietRawAuthStorageRemove !== 'function' ||
      typeof applyCloudSession !== 'function') return;

  const authKey = 'sb-hycegznamzjhwinegaai-auth-token';
  const fallbackPrefix = 'diet-copilot:auth-fallback:';
  const cookiePrefix = 'diet-auth-v2-';
  const cookieChunkSize = 2800;
  const sessionMaxAge = 60 * 60 * 24 * 365;
  let rehydratePromise = null;

  function isPkceKey(key) {
    return String(key).includes('code-verifier');
  }

  function cookieBase(key) {
    return `${cookiePrefix}${encodeURIComponent(String(key))}`;
  }

  function cookieRead(name) {
    try {
      const prefix = `${name}=`;
      for (const part of String(document.cookie || '').split('; ')) {
        if (part.startsWith(prefix)) return part.slice(prefix.length);
      }
    } catch {}
    return null;
  }

  function cookieWrite(name, value, maxAge) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  }

  function cookieDelete(name) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }

  function cookieStorageRemove(key) {
    const base = cookieBase(key);
    const rawCount = cookieRead(`${base}.n`);
    const count = Math.max(0, Math.min(24, Number.parseInt(rawCount || '0', 10) || 0));
    cookieDelete(`${base}.n`);
    for (let i = 0; i < Math.max(count, 8); i++) cookieDelete(`${base}.${i}`);
  }

  function cookieStorageGet(key) {
    const base = cookieBase(key);
    const count = Number.parseInt(cookieRead(`${base}.n`) || '', 10);
    if (!Number.isInteger(count) || count < 1 || count > 24) return null;
    let encoded = '';
    for (let i = 0; i < count; i++) {
      const chunk = cookieRead(`${base}.${i}`);
      if (chunk == null) return null;
      encoded += chunk;
    }
    try { return decodeURIComponent(encoded); }
    catch { return null; }
  }

  function cookieStorageSet(key, value) {
    cookieStorageRemove(key);
    const encoded = encodeURIComponent(String(value));
    const chunks = [];
    for (let i = 0; i < encoded.length; i += cookieChunkSize) {
      chunks.push(encoded.slice(i, i + cookieChunkSize));
    }
    if (!chunks.length || chunks.length > 24) {
      throw new Error('The login session is too large for persistent cookie storage.');
    }
    const base = cookieBase(key);
    cookieWrite(`${base}.n`, String(chunks.length), sessionMaxAge);
    chunks.forEach((chunk, index) => cookieWrite(`${base}.${index}`, chunk, sessionMaxAge));
    if (cookieStorageGet(key) !== String(value)) {
      cookieStorageRemove(key);
      throw new Error('Persistent cookie storage verification failed.');
    }
  }

  function localStorageGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }

  function localStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return localStorage.getItem(key) === value;
    } catch {
      return false;
    }
  }

  function transientGet(key) {
    try { return sessionStorage.getItem(`${fallbackPrefix}${key}`); }
    catch { return null; }
  }

  function transientSet(key, value) {
    try {
      sessionStorage.setItem(`${fallbackPrefix}${key}`, value);
      return sessionStorage.getItem(`${fallbackPrefix}${key}`) === value;
    } catch {
      return false;
    }
  }

  function persistentGet(key) {
    const local = localStorageGet(key);
    if (local !== null) return local;
    if (isPkceKey(key)) return transientGet(key);
    return cookieStorageGet(key);
  }

  function persistentSet(key, value) {
    const text = String(value);
    if (localStorageSet(key, text)) {
      if (!isPkceKey(key)) cookieStorageRemove(key);
      try { sessionStorage.removeItem(`${fallbackPrefix}${key}`); } catch {}
      return;
    }

    if (isPkceKey(key)) {
      if (transientSet(key, text)) return;
      throw new Error('Temporary OAuth storage is unavailable. Google sign-in cannot continue.');
    }

    try {
      cookieStorageSet(key, text);
    } catch {
      throw new Error('Persistent site storage is unavailable. Diet Copilot cannot keep you signed in on this device.');
    }
  }

  function persistentRemove(key) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(`${fallbackPrefix}${key}`); } catch {}
    if (!isPkceKey(key)) cookieStorageRemove(key);
  }

  function verifySession(session) {
    if (!session?.user?.id) return;
    const raw = persistentGet(authKey);
    if (!raw) {
      throw new Error('Diet Copilot received a session, but could not persist it on this device.');
    }
    try {
      const stored = JSON.parse(raw);
      if (stored?.user?.id !== session.user.id || !stored?.refresh_token) {
        throw new Error('Persisted session verification failed.');
      }
    } catch {
      throw new Error('Diet Copilot could not verify the persisted login session. Please sign in again.');
    }
  }

  // Recover the bad pre-static10 tab-only session while that tab is still alive.
  try {
    const fallbackKey = `${fallbackPrefix}${authKey}`;
    const transient = sessionStorage.getItem(fallbackKey);
    if (transient !== null && persistentGet(authKey) === null) persistentSet(authKey, transient);
    sessionStorage.removeItem(fallbackKey);
  } catch (error) {
    console.warn('Diet Copilot could not migrate transient auth storage', error);
  }

  // Upgrade the storage primitives used by the already-created Supabase client.
  dietRawAuthStorageGet = persistentGet;
  dietRawAuthStorageSet = persistentSet;
  dietRawAuthStorageRemove = persistentRemove;

  // A later consolidated build may contain its own persistence assertion. Point
  // that assertion at the same verified storage rather than letting it enforce
  // localStorage-only behavior again.
  if (typeof dietAssertSessionPersisted === 'function') {
    dietAssertSessionPersisted = verifySession;
  }

  const applyCloudSessionBeforePersistenceRepair = applyCloudSession;
  applyCloudSession = function applyCloudSessionPersistent(session) {
    if (session?.user?.id) verifySession(session);
    return applyCloudSessionBeforePersistenceRepair(session);
  };

  function storageBackend() {
    if (localStorageGet(authKey) !== null) return 'localStorage';
    if (cookieStorageGet(authKey) !== null) return 'cookie';
    return 'none';
  }

  // The production bundle can perform its first auth bootstrap before this
  // compatibility layer executes. If the session lives in the cookie fallback,
  // that first getSession() cannot see it. Re-run the canonical bootstrap once
  // after all startup listeners have had a chance to execute. This uses the
  // same Supabase client authority and the now-patched storage adapter.
  async function rehydratePersistentSession() {
    if (rehydratePromise) return rehydratePromise;
    rehydratePromise = (async () => {
      if (typeof initCloud !== 'function') return false;
      if (!persistentGet(authKey)) return false;
      await initCloud(false);
      if (cloud?.user) {
        try { updateStatus(); } catch {}
        try { render(); } catch {}
        return true;
      }
      return false;
    })().catch(error => {
      console.warn('Diet Copilot persistent session rehydration failed', error);
      return false;
    });
    return rehydratePromise;
  }

  function scheduleRehydrate() {
    setTimeout(() => { rehydratePersistentSession(); }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRehydrate, { once: true });
  } else {
    scheduleRehydrate();
  }
  window.addEventListener('load', scheduleRehydrate, { once: true });

  window.DietAuthPersistenceHotfix = Object.freeze({
    version: 'static10c',
    storage: 'localStorage-or-secure-cookie',
    backend: storageBackend,
    verify: () => Boolean(persistentGet(authKey)),
    rehydrate: rehydratePersistentSession
  });
})();
