'use strict';

// One storage adapter, installed before the only Supabase client is constructed.
// A session is never silently downgraded to tab-only or in-memory persistence.
const DIET_AUTH_STORAGE_KEY = 'sb-hycegznamzjhwinegaai-auth-token';
const DIET_AUTH_FALLBACK_PREFIX = 'diet-copilot:auth-fallback:';
const DIET_PKCE_BACKUP_KEY = 'diet-copilot:pkce-verifier-backup-v2';
const DIET_PKCE_BACKUP_LEGACY_KEY = 'diet-copilot:pkce-verifier-backup-v1';
const DIET_PKCE_BACKUP_TTL_MS = 15 * 60 * 1000;
const DIET_COOKIE_PREFIX = 'diet-auth-v2-';
const dietStorageStatus = { backend: 'none', lastError: null };

function dietStorageError(code) {
  dietStorageStatus.lastError = code;
  const messages = {
    blocked: 'Site storage is blocked. Allow site data for this origin to keep your account signed in.',
    quota: 'Site storage is full. Free some site storage, then retry sign-in.',
    verification: 'The browser did not retain the sign-in data. Check site-data settings and retry.',
    corrupt: 'The saved sign-in is incomplete or invalid. Please sign in again.',
  };
  const error = new Error(messages[code] || 'Sign-in storage is temporarily unavailable. Please retry.');
  error.name = 'DietStorageError';
  error.code = code;
  return error;
}
function dietStorageCode(error) {
  return error?.name === 'SecurityError' ? 'blocked' : error?.name === 'QuotaExceededError' ? 'quota' : 'verification';
}
function dietCookieName(key) { return `${DIET_COOKIE_PREFIX}${encodeURIComponent(String(key))}`; }
function dietCookieRead(name) {
  const prefix = `${name}=`;
  const entry = document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(prefix));
  return entry === undefined ? null : entry.slice(prefix.length);
}
function dietCookieWrite(name, value, age = 31536000) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=${age}; SameSite=Lax${secure}`;
}
function dietCookieManifest(key) {
  const raw = dietCookieRead(`${dietCookieName(key)}.n`);
  if (raw === null) return null;
  if (/^[1-9]\d?$/.test(raw) && Number(raw) <= 24) return {raw, revision:'', count:Number(raw)};
  const match = /^v3-([a-z0-9]+)-([1-9]\d?)$/.exec(raw);
  if (match && Number(match[2]) <= 24) return {raw, revision:`${match[1]}.`, count:Number(match[2])};
  throw dietStorageError('corrupt');
}
function dietCookieGet(key) {
  const base = dietCookieName(key);
  for (let retry = 0; retry < 2; retry++) {
    const manifest = dietCookieManifest(key);
    if (!manifest) return null;
    let encoded = '';
    for (let i=0;i<manifest.count;i++) {
      const chunk = dietCookieRead(`${base}.${manifest.revision}${i}`);
      if (chunk === null) throw dietStorageError('corrupt');
      encoded += chunk;
    }
    if (dietCookieRead(`${base}.n`) !== manifest.raw) continue;
    try { return decodeURIComponent(encoded); } catch { throw dietStorageError('corrupt'); }
  }
  throw dietStorageError('verification');
}
function dietCookieRemove(key) {
  const prefix = `${dietCookieName(key)}.`;
  const names = document.cookie.split(';').map(v=>v.trim().split('=')[0]).filter(n=>n.startsWith(prefix));
  for (const name of names) dietCookieWrite(name, '', 0);
}
function dietCookieSet(key, text) {
  const base = dietCookieName(key);
  const oldNames = document.cookie.split(';').map(v=>v.trim().split('=')[0]).filter(n=>n.startsWith(`${base}.`));
  const encoded = encodeURIComponent(text);
  const chunks = encoded.match(/.{1,2800}/g) || [];
  if (!chunks.length || chunks.length > 24) throw dietStorageError('quota');
  const revision = `${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}`;
  const written = [];
  try {
    // Write immutable chunks first; publish the pointer only after all writes verify.
    chunks.forEach((chunk,i)=>{
      const name = `${base}.${revision}.${i}`;
      written.push(name);
      dietCookieWrite(name,chunk);
      if (dietCookieRead(name) !== chunk) throw dietStorageError('verification');
    });
    dietCookieWrite(`${base}.n`, `v3-${revision}-${chunks.length}`);
    if (dietCookieGet(key) !== text) throw dietStorageError('verification');
  } catch (error) {
    for (const name of written) { try { dietCookieWrite(name,'',0); } catch {} }
    throw error;
  }
  for (const name of oldNames) if (name !== `${base}.n`) dietCookieWrite(name,'',0);
}
function dietValidStoredSession(raw) {
  try {
    const session = JSON.parse(raw);
    return Boolean(session && typeof session.access_token === 'string' && session.access_token &&
      typeof session.refresh_token === 'string' && session.refresh_token &&
      Number.isFinite(session.expires_at) && typeof session.user?.id === 'string' && session.user.id);
  } catch { return false; }
}
function dietRawAuthStorageRemove(key) {
  try { window.localStorage.removeItem(key); } catch {}
  try { window.sessionStorage.removeItem(`${DIET_AUTH_FALLBACK_PREFIX}${key}`); } catch {}
  try { dietCookieRemove(key); } catch {}
  if (key === DIET_AUTH_STORAGE_KEY) dietStorageStatus.backend = 'none';
}
function dietRawAuthStorageGet(key) {
  let local = null, localError = null, cookie = null;
  try { local = window.localStorage.getItem(key); } catch (error) { localError = error; }
  if (!String(key).endsWith('-code-verifier')) {
    try { cookie = dietCookieGet(key); }
    catch (error) {
      if (error?.code === 'corrupt') {
        // Do not resurrect an older localStorage token behind a broken newer cookie.
        dietRawAuthStorageRemove(key);
        dietStorageStatus.lastError = 'corrupt';
        return null;
      }
      if (localError) throw dietStorageError(dietStorageCode(localError));
    }
  }
  const raw = cookie !== null ? cookie : local;
  if (key === DIET_AUTH_STORAGE_KEY) {
    if (raw !== null && !dietValidStoredSession(raw)) {
      dietRawAuthStorageRemove(key);
      dietStorageStatus.lastError = 'corrupt';
      return null;
    }
    dietStorageStatus.backend = raw === null ? 'none' : cookie !== null ? 'cookie' : 'localStorage';
  }
  return raw;
}
function dietRawAuthStorageSet(key, value) {
  const text = String(value);
  const pkce = String(key).endsWith('-code-verifier');
  let localError = null;
  // Once cookies own this key, keep using them. Never shadow a rotated cookie
  // refresh token with an older, still-readable localStorage value.
  let cookieOwnsKey = false;
  if (!pkce) { try { cookieOwnsKey = dietCookieRead(`${dietCookieName(key)}.n`) !== null; } catch {} }
  if (!cookieOwnsKey) {
    try {
      window.localStorage.setItem(key,text);
      if (window.localStorage.getItem(key) !== text) throw dietStorageError('verification');
      if (key === DIET_AUTH_STORAGE_KEY) dietStorageStatus.backend = 'localStorage';
      dietStorageStatus.lastError = null;
      return;
    } catch (error) { localError = error; }
  }
  if (pkce) {
    // PKCE recovery is tab-scoped and expires. It is not a session fallback.
    if (!dietMirrorPkceStorageEntry(key,text)) throw dietStorageError(dietStorageCode(localError));
    return;
  }
  try {
    dietCookieSet(key,text);
    try { window.localStorage.removeItem(key); } catch {}
    if (key === DIET_AUTH_STORAGE_KEY) dietStorageStatus.backend = 'cookie';
    dietStorageStatus.lastError = null;
  } catch (error) { throw dietStorageError(localError ? dietStorageCode(localError) : error.code || dietStorageCode(error)); }
}
function dietAssertPersistentStorage() {
  const key = `diet-copilot:persistence-probe:${Date.now()}:${Math.random()}`;
  const text = 'persistent-storage-probe';
  try {
    dietRawAuthStorageSet(key,text);
    if (dietRawAuthStorageGet(key) !== text) throw dietStorageError('verification');
  } finally { dietRawAuthStorageRemove(key); }
}
function dietMigrateTransientSession() {
  let raw = null;
  try { raw = window.sessionStorage.getItem(`${DIET_AUTH_FALLBACK_PREFIX}${DIET_AUTH_STORAGE_KEY}`); } catch {}
  if (!raw) return;
  if (dietRawAuthStorageGet(DIET_AUTH_STORAGE_KEY) === null && dietValidStoredSession(raw)) dietRawAuthStorageSet(DIET_AUTH_STORAGE_KEY,raw);
  try { window.sessionStorage.removeItem(`${DIET_AUTH_FALLBACK_PREFIX}${DIET_AUTH_STORAGE_KEY}`); } catch {}
}
function dietReadBrowserPkceBackup() {
  try {
    const raw = sessionStorage.getItem(DIET_PKCE_BACKUP_KEY);
    if (!raw) return null;
    const backup = JSON.parse(raw);
    if (!backup || typeof backup !== 'object' || typeof backup.entries !== 'object') return null;
    const createdAt = Number(backup.createdAt || 0);
    if (!createdAt || Date.now() - createdAt > DIET_PKCE_BACKUP_TTL_MS || createdAt > Date.now() + 60000) {
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
  return dietWriteBrowserPkceBackup(current);
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
  return dietWriteBrowserPkceBackup(current);
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

