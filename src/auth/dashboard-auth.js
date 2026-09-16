'use strict';

// Diet Copilot uses THIEPN Account, the shared Supabase identity used by other
// first-party THIEPN apps. Diet Copilot intentionally exposes Google sign-in
// only; password/account-management flows are not part of this product.
const DIET_AUTH_RELAY = 'https://thiepn.dev/WORDSTRIKE/';
const DIET_OAUTH_TARGET_KEY = 'diet-copilot:oauth-target-v2';
const DIET_OAUTH_FLOW_KEY = 'diet-copilot:oauth-flow-v2';
const DIET_PKCE_BACKUP_KEY = 'diet-copilot:pkce-verifier-backup-v1';

function dietClearBrowserOAuthRelayState() {
  try {
    sessionStorage.removeItem(DIET_OAUTH_TARGET_KEY);
    sessionStorage.removeItem(DIET_OAUTH_FLOW_KEY);
  } catch {}
}

function dietSetBrowserOAuthRelayState(target, flowId) {
  try {
    sessionStorage.setItem(DIET_OAUTH_TARGET_KEY, target);
    if (flowId) sessionStorage.setItem(DIET_OAUTH_FLOW_KEY, flowId);
    else sessionStorage.removeItem(DIET_OAUTH_FLOW_KEY);
  } catch {}
}

function dietClearBrowserPkceBackup() {
  try { sessionStorage.removeItem(DIET_PKCE_BACKUP_KEY); } catch {}
}

function dietBackupBrowserPkceVerifier(flowId = '') {
  try {
    const entries = {};
    const legacyKey = `${DIET_AUTH_STORAGE_KEY}-code-verifier`;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue != null) entries[legacyKey] = legacyValue;

    const prefix = `${DIET_AUTH_STORAGE_KEY}-flow-`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix) || !key.endsWith('-code-verifier')) continue;
      const value = localStorage.getItem(key);
      if (value != null) entries[key] = value;
    }

    if (flowId) {
      const exactKey = `${DIET_AUTH_STORAGE_KEY}-flow-${flowId}-code-verifier`;
      const exactValue = localStorage.getItem(exactKey);
      if (exactValue != null) entries[exactKey] = exactValue;
    }

    if (!Object.keys(entries).length) {
      throw new Error('Supabase did not persist the PKCE verifier before redirect.');
    }

    sessionStorage.setItem(DIET_PKCE_BACKUP_KEY, JSON.stringify({
      flowId: flowId || null,
      createdAt: Date.now(),
      entries
    }));
  } catch (error) {
    dietClearBrowserPkceBackup();
    throw error;
  }
}

function dietRestoreBrowserPkceVerifier() {
  try {
    const raw = sessionStorage.getItem(DIET_PKCE_BACKUP_KEY);
    if (!raw) return null;
    const backup = JSON.parse(raw);
    if (!backup || typeof backup !== 'object' || typeof backup.entries !== 'object') return null;
    if (Number.isFinite(Number(backup.createdAt)) && Date.now() - Number(backup.createdAt) > 15 * 60 * 1000) {
      dietClearBrowserPkceBackup();
      return null;
    }
    for (const [key, value] of Object.entries(backup.entries)) {
      if (!key.startsWith(`${DIET_AUTH_STORAGE_KEY}-`) || !key.endsWith('-code-verifier')) continue;
      if (typeof value !== 'string') continue;
      if (localStorage.getItem(key) == null) localStorage.setItem(key, value);
    }
    return typeof backup.flowId === 'string' && backup.flowId ? backup.flowId : null;
  } catch {
    return null;
  }
}

async function dietSignInWithGoogle() {
  if (typeof dietIsNativeAndroid === 'function' && dietIsNativeAndroid() && window.DietNative?.startGoogleOAuth) {
    return window.DietNative.startGoogleOAuth();
  }

  dietClearBrowserOAuthRelayState();
  dietClearBrowserPkceBackup();
  const { data, error } = await cloud.client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: DIET_AUTH_RELAY,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google sign-in URL was not created.');

  // Preserve both Supabase's flow id and the verifier material before leaving
  // thiepn.dev. The verifier backup is tab-scoped and restored before the code
  // exchange, so the shared Site URL relay cannot strand the PKCE flow.
  dietSetBrowserOAuthRelayState('web', data.flowId || '');
  dietBackupBrowserPkceVerifier(data.flowId || '');
  location.assign(data.url);
}

renderConnection = function renderDietConnection() {
  const email = cloud.user?.email || '';

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="connection-state">
        <strong>THIEPN Account</strong>
        <span>Signed in as ${esc(email)}. Diet Copilot data stays private to this account.</span>
      </div>
      <div class="btn-row">
        <button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>`;

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', () => refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut({ scope: 'local' });
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      dietClearBrowserOAuthRelayState();
      dietClearBrowserPkceBackup();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      renderConnection();
      render();
    });
    return;
  }

  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>Sign in with THIEPN Account</strong>
      <span>Continue with your Google account to sync Diet Copilot.</span>
    </div>
    ${cloud.error ? `<div class="connection-state"><span style="color:var(--danger)">${esc(cloud.error)}</span></div>` : ''}
    <div class="btn-row">
      <button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button>
    </div>`;

  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Redirecting…';
    cloud.error = null;
    try {
      await dietSignInWithGoogle();
    } catch (error) {
      cloud.error = error?.message || String(error);
      dietClearBrowserOAuthRelayState();
      dietClearBrowserPkceBackup();
      renderConnection();
    }
  });
};
