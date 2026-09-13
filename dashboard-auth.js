'use strict';

// Diet Copilot uses THIEPN Account, the shared Supabase identity used by other
// first-party THIEPN apps. App data remains isolated by the authenticated UUID.
function dietAuthRedirectUrl() {
  return `${location.origin}${location.pathname}`;
}

renderConnection = function renderDietConnection() {
  const email = cloud.user?.email || '';

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="connection-state">
        <strong>THIEPN Account</strong>
        <span>Signed in as ${esc(email)}. This account can be reused across supported THIEPN apps; Diet Copilot data stays private to this account.</span>
      </div>
      <form id="passwordForm" class="stack">
        <div class="field">
          <label>Set or change password</label>
          <input id="accountPassword" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters">
        </div>
        <div class="btn-row">
          <button class="btn ghost" type="submit">Save password</button>
        </div>
      </form>
      <div class="btn-row">
        <button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>
      <div class="connection-state">
        <span>Signing out here signs THIEPN Account out of supported apps in this browser.</span>
      </div>`;

    connectionContent.querySelector('#passwordForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const password = connectionContent.querySelector('#accountPassword')?.value || '';
      if (password.length < 8) {
        showToast('Use at least 8 characters');
        return;
      }
      const button = event.currentTarget.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Saving…'; }
      const { error } = await cloud.client.auth.updateUser({ password });
      if (error) {
        cloud.error = error.message;
        renderConnection();
        return;
      }
      showToast('THIEPN Account password updated');
      renderConnection();
    });

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', () => refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut();
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      renderConnection();
      render();
    });
    return;
  }

  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>Sign in with THIEPN Account</strong>
      <span>One account for supported THIEPN apps. Sign in here with the same Google account or email/password you use elsewhere.</span>
    </div>
    ${cloud.error ? `<div class="connection-state"><span style="color:var(--danger)">${esc(cloud.error)}</span></div>` : ''}
    <div class="btn-row">
      <button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button>
    </div>
    <form id="loginForm" class="stack">
      <div class="field">
        <label>Email</label>
        <input id="loginEmail" type="email" autocomplete="email" required autofocus>
      </div>
      <div class="field">
        <label>Password</label>
        <input id="loginPassword" type="password" autocomplete="current-password" minlength="8" required>
      </div>
      <div class="btn-row">
        <button class="btn primary" type="submit">Sign in</button>
        <button class="btn ghost" id="createAccountBtn" type="button">Create account</button>
        <button class="btn ghost" id="forgotPasswordBtn" type="button">Forgot password</button>
      </div>
    </form>`;

  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Redirecting…';
    const { error } = await cloud.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: dietAuthRedirectUrl(),
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) {
      cloud.error = error.message;
      renderConnection();
    }
  });

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
    showToast('Signed in with THIEPN Account');
  });

  connectionContent.querySelector('#createAccountBtn')?.addEventListener('click', async event => {
    const emailValue = connectionContent.querySelector('#loginEmail').value.trim();
    const passwordValue = connectionContent.querySelector('#loginPassword').value;
    if (!emailValue || passwordValue.length < 8) {
      showToast('Enter an email and an 8+ character password');
      return;
    }
    event.currentTarget.disabled = true;
    const { data, error } = await cloud.client.auth.signUp({
      email: emailValue,
      password: passwordValue,
      options: { emailRedirectTo: dietAuthRedirectUrl() }
    });
    if (error) {
      cloud.error = error.message;
      renderConnection();
      return;
    }
    if (data.session) {
      showToast('THIEPN Account created and signed in');
      renderConnection();
    } else {
      showToast('THIEPN Account created · check your email to confirm');
    }
  });

  connectionContent.querySelector('#forgotPasswordBtn')?.addEventListener('click', async event => {
    const emailValue = connectionContent.querySelector('#loginEmail').value.trim();
    if (!emailValue) {
      showToast('Enter your email first');
      return;
    }
    event.currentTarget.disabled = true;
    const { error } = await cloud.client.auth.resetPasswordForEmail(emailValue, {
      redirectTo: dietAuthRedirectUrl()
    });
    if (error) {
      cloud.error = error.message;
      renderConnection();
      return;
    }
    showToast('If the account exists, a reset email was sent');
    event.currentTarget.disabled = false;
  });
};
