'use strict';

// Final auth compatibility layer.
// dashboard-p5.js replaces renderConnection after dashboard-auth.js loads and
// historically removed the Google entry point. Preserve the P5 visual account
// sheet, but always inject the shared THIEPN Account Google sign-in for signed-
// out users.
const dietRenderConnectionBeforeFinalAuth = renderConnection;

renderConnection = function renderConnectionFinalAuth() {
  const result = dietRenderConnectionBeforeFinalAuth();
  if (cloud.user) return result;
  if (connectionContent.querySelector('#googleSignInBtn')) return result;

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
      cloud.error = error?.message || String(error);
      renderConnection();
    }
  });

  return result;
};
