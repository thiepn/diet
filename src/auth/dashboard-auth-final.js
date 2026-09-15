'use strict';

// Final auth compatibility layer.
// dashboard-p5.js can replace renderConnection after dashboard-auth.js loads.
// Enforce the final signed-out product contract here: Google-only sign-in.
const dietRenderConnectionBeforeFinalAuth = renderConnection;

renderConnection = function renderConnectionFinalAuth() {
  const result = dietRenderConnectionBeforeFinalAuth();
  if (cloud.user) return result;

  // Replace any legacy account form rendered by earlier layers. This keeps the
  // visible Diet Copilot sign-in surface Google-only and prevents old UI
  // variants from reintroducing email/password fields, account creation, or
  // password-reset actions.
  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>Sign in with THIEPN Account</strong>
      <span>Continue with your Google account to sync Diet Copilot.</span>
    </div>
    ${cloud.error ? `<div class="connection-state"><span style="color:var(--danger)">${esc(cloud.error)}</span></div>` : ''}
    <div class="btn-row">
      <button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button>
    </div>`;

  const button = connectionContent.querySelector('#googleSignInBtn');
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
