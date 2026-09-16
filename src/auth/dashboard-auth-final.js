'use strict';

// Final auth surface guard. All active layers are Google-only; this last layer
// keeps that contract explicit if presentation layers are rearranged later.
const dietRenderConnectionBeforeFinalAuth = renderConnection;

renderConnection = function renderConnectionFinalAuth() {
  const result = dietRenderConnectionBeforeFinalAuth();
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
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      renderConnection();
      render();
    });
    return result;
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

  const button = connectionContent.querySelector('#googleSignInBtn');
  button?.addEventListener('click', async event => {
    const target = event.currentTarget;
    target.disabled = true;
    target.textContent = 'Redirecting…';
    cloud.error = null;
    try {
      await dietSignInWithGoogle();
    } catch (error) {
      cloud.error = error?.message || String(error);
      renderConnection();
    }
  });

  return result;
};
