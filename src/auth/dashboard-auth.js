'use strict';

// Diet Copilot uses THIEPN Account, the shared Supabase identity used by other
// first-party THIEPN apps. Diet Copilot intentionally exposes Google sign-in
// only; password/account-management flows are not part of this product.
const DIET_AUTH_RELAY = 'https://thiepn.dev/WORDSTRIKE/';
const DIET_OAUTH_TARGET_KEY = 'diet-copilot:oauth-target-v2';
const DIET_OAUTH_FLOW_KEY = 'diet-copilot:oauth-flow-v2';

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

async function dietSignInWithGoogle() {
  if (typeof dietIsNativeAndroid === 'function' && dietIsNativeAndroid() && window.DietNative?.startGoogleOAuth) {
    return window.DietNative.startGoogleOAuth();
  }

  // A legacy bootstrap client can exist if an older layer initialized before
  // the final auth override. Never start OAuth through it: rebuild the client
  // with Diet's controlled storage adapter first.
  if (!cloud.client?.__dietAuthStorageV2) {
    await initCloud(false);
  }
  if (!cloud.client?.__dietAuthStorageV2) {
    throw new Error('Diet Copilot could not initialize its Google sign-in client.');
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

  // Supabase's storage adapter has already mirrored the verifier at write-time.
  // Add the returned flow id to that tab-scoped mirror and mark the relay target.
  dietSetBrowserOAuthRelayState('web', data.flowId || '');
  dietTagBrowserPkceBackupFlow(data.flowId || '');
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
