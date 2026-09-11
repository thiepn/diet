'use strict';

// Override the legacy infrastructure/setup dialog. Diet Copilot has one fixed
// Supabase project, so a user should only ever authenticate their own account.
renderConnection = function renderDietConnection() {
  const email = cloud.user?.email || '';

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="connection-state">
        <strong>Signed in as ${esc(email)}</strong>
        <span>Your Diet Copilot history is synced through your account and is available on every device where you sign in.</span>
      </div>
      <div class="btn-row">
        <button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>`;

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', () => refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut();
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      renderConnection();
      render();
    });
    return;
  }

  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>Sign in to Diet Copilot</strong>
      <span>Use the same Diet Copilot email and password on phone, desktop, tablet, or any other browser. Your meals and weigh-ins are stored in the cloud, not on one device.</span>
    </div>
    ${cloud.error ? `<div class="connection-state"><span style="color:var(--danger)">${esc(cloud.error)}</span></div>` : ''}
    <form id="loginForm" class="stack">
      <div class="field">
        <label>Email</label>
        <input id="loginEmail" type="email" autocomplete="email" required autofocus>
      </div>
      <div class="field">
        <label>Password</label>
        <input id="loginPassword" type="password" autocomplete="current-password" minlength="6" required>
      </div>
      <div class="btn-row">
        <button class="btn primary" type="submit">Sign in</button>
      </div>
    </form>`;

  connectionContent.querySelector('#loginForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    cloud.error = null;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
    const { error } = await cloud.client.auth.signInWithPassword({
      email: connectionContent.querySelector('#loginEmail').value.trim(),
      password: connectionContent.querySelector('#loginPassword').value
    });
    if (error) {
      cloud.error = error.message;
      renderConnection();
      return;
    }
    await refreshData({ silent: true });
    await subscribeRealtime();
    render();
    if (connectionDialog.open) connectionDialog.close();
    showToast('Signed in · history synced');
  });
};
