'use strict';

// Final auth compatibility layer.
// dashboard-p5.js replaces renderConnection after dashboard-auth.js loads and
// historically removed the Google entry point. Preserve the P5 visual account
// sheet, but always inject the shared THIEPN Account Google sign-in for signed-
// out users.
const DIET_OAUTH_RETURN_STORAGE_KEY = 'thiepn-oauth-return-v1';
const DIET_OAUTH_RETURN_PATH = '/diet/';
const DIET_OAUTH_RETURN_TTL_MS = 10 * 60 * 1000;

function rememberDietOAuthReturn() {
  try {
    localStorage.setItem(DIET_OAUTH_RETURN_STORAGE_KEY, JSON.stringify({
      path: DIET_OAUTH_RETURN_PATH,
      expiresAt: Date.now() + DIET_OAUTH_RETURN_TTL_MS
    }));
  } catch {}
}

function clearDietOAuthReturn() {
  try { localStorage.removeItem(DIET_OAUTH_RETURN_STORAGE_KEY); } catch {}
}

const dietRenderConnectionBeforeFinalAuth = renderConnection;

renderConnection = function renderConnectionFinalAuth() {
  const result = dietRenderConnectionBeforeFinalAuth();
  if (cloud.user) return result;

  const existingGoogleButton = connectionContent.querySelector('#googleSignInBtn');
  if (existingGoogleButton) {
    // Capture runs before the existing OAuth click handler, so even legacy
    // account-sheet variants stamp the app that initiated the shared login.
    if (existingGoogleButton.dataset.dietOAuthReturnBound !== 'true') {
      existingGoogleButton.dataset.dietOAuthReturnBound = 'true';
      existingGoogleButton.addEventListener('click', rememberDietOAuthReturn, { capture: true });
    }
    return result;
  }

  const form = connectionContent.querySelector('#loginForm');
  const host = document.createElement('div');
  host.className = 'btn-row';
  host.innerHTML = '<button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button>';

  if (form) form.before(host);
  else connectionContent.prepend(host);

  const button = host.querySelector('#googleSignInBtn');
  button?.addEventListener('click', async event => {
    const target = event.currentTarget;
    target.disabled = true;
    target.textContent = 'Redirecting…';
    cloud.error = null;
    rememberDietOAuthReturn();

    try {
      const redirectTo = typeof dietAuthRedirectUrl === 'function'
        ? dietAuthRedirectUrl()
        : `${location.origin}${location.pathname}`;
      const { error } = await cloud.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (error) {
      clearDietOAuthReturn();
      cloud.error = error?.message || String(error);
      renderConnection();
    }
  });

  return result;
};
