'use strict';

function p5FriendlyError(error) {
  const raw = String(error || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return 'Something went wrong while updating Diet Copilot. Please try again.';
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials') || lower.includes('oauth')) return 'Google sign-in could not be completed. Try again.';
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) return 'Diet Copilot could not reach the server. Check your internet connection and try again.';
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('session')) return 'Your session needs to be refreshed. Sign in again to continue.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Wait a moment and try again.';
  return 'Diet Copilot could not complete that request. Please try again.';
}

function p5FormatSyncTime(value) {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not synced yet';
  const diff = Date.now() - date.getTime();
  if (diff < 45000) return 'Just now';
  if (diff < 3600000) return `${Math.max(1,Math.round(diff/60000))} min ago`;
  if (diff < 86400000) return date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return date.toLocaleDateString(undefined,{day:'numeric',month:'short'});
}

function p5EnsureSystemNotice() {
  let notice = document.getElementById('systemNotice');
  if (notice) return notice;
  notice = document.createElement('div');
  notice.id = 'systemNotice';
  notice.className = 'system-notice';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  notice.hidden = true;
  document.body.appendChild(notice);
  return notice;
}

function p5RenderSystemNotice() {
  const notice = p5EnsureSystemNotice();
  if (!cloud.user) {
    notice.hidden = true;
    notice.innerHTML = '';
    return;
  }

  if (navigator.onLine === false) {
    notice.className = 'system-notice offline';
    notice.innerHTML = `<span class="system-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5 12.4a10 10 0 0 1 14 0"/><path d="M8.7 16a5 5 0 0 1 6.6 0"/><path d="M12 20h.01"/><path d="m3 3 18 18"/></svg></span><span><strong>Offline</strong><small>Showing your last synced data · ${esc(p5FormatSyncTime(dashboard.fetchedAt))}</small></span>`;
    notice.hidden = false;
    return;
  }

  if (cloud.status === 'error') {
    notice.className = 'system-notice error';
    notice.innerHTML = `<span class="system-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg></span><span><strong>Sync issue</strong><small>${esc(p5FriendlyError(cloud.error))}</small></span><button type="button" data-p5-retry>Retry</button>`;
    notice.hidden = false;
    notice.querySelector('[data-p5-retry]')?.addEventListener('click',()=>refreshData());
    return;
  }

  if (cloud.status === 'syncing') {
    notice.className = 'system-notice syncing';
    notice.innerHTML = `<span class="system-notice-spinner" aria-hidden="true"></span><span><strong>Syncing</strong><small>Updating your latest Diet Copilot data…</small></span>`;
    notice.hidden = false;
    return;
  }

  notice.hidden = true;
  notice.innerHTML = '';
}

function p5AccountIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`;
}

function p5SyncIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.4 6.4L20 8"/><path d="M17.9 15A7 7 0 0 1 5.6 17.6L4 16"/></svg>`;
}

renderConnection = function renderConnectionP5() {
  const email = cloud.user?.email || '';
  const online = navigator.onLine !== false;
  const syncText = p5FormatSyncTime(dashboard.fetchedAt);

  if (cloud.user) {
    connectionContent.innerHTML = `
      <div class="p5-account-profile">
        <div class="p5-account-avatar" aria-hidden="true">${p5AccountIcon()}</div>
        <div class="p5-account-identity"><span>Signed in</span><strong title="${esc(email)}">${esc(email)}</strong><small>Your nutrition history is available on every device where you use this account.</small></div>
      </div>
      <div class="p5-account-status" aria-label="Account sync status">
        <div><span>Connection</span><strong class="${online?'good':'warn'}">${online?'Online':'Offline'}</strong></div>
        <div><span>Last synced</span><strong>${esc(syncText)}</strong></div>
      </div>
      ${cloud.status==='error' ? `<div class="p5-inline-alert" role="alert">${esc(p5FriendlyError(cloud.error))}</div>` : ''}
      <div class="p5-account-actions">
        <button class="btn primary p5-refresh-btn" id="refreshNowBtn" type="button">${p5SyncIcon()}<span>Refresh data</span></button>
        <button class="btn ghost" id="signOutBtn" type="button">Sign out</button>
      </div>
      <p class="p5-account-footnote">Meals and weigh-ins are logged through ChatGPT. This dashboard only displays your history.</p>`;

    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.classList.add('is-busy');
      await refreshData({silent:true});
      renderConnection();
      render();
    });
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click', async () => {
      await cloud.client.auth.signOut({ scope: 'local' });
      cloud.user = null;
      cloud.status = 'configured';
      dashboard = emptyDashboard();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      if (connectionDialog.open) connectionDialog.close();
      render();
      p5RenderSystemNotice();
      showToast('Signed out');
    });
    return;
  }

  connectionContent.innerHTML = `
    <div class="p5-login-intro">
      <div class="p5-login-icon" aria-hidden="true">${p5AccountIcon()}</div>
      <h3>Welcome back</h3>
      <p>Continue with your Google account to sync your Diet Copilot history on this device.</p>
    </div>
    ${cloud.error ? `<div class="p5-inline-alert" role="alert">${esc(p5FriendlyError(cloud.error))}</div>` : ''}
    <button class="btn primary p5-signin-btn" id="googleSignInBtn" type="button">Continue with Google</button>
    <p class="p5-login-footnote">Diet Copilot uses Google sign-in only.</p>`;

  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Redirecting…';
    cloud.error = null;
    try {
      await dietSignInWithGoogle();
    } catch (error) {
      cloud.error = error?.message || String(error);
      renderConnection();
    }
  });
};

p2ErrorState = function p2ErrorStateP5(message) {
  return `<section class="today-state today-error">
    <div class="today-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg></div>
    <h2>Couldn't update Diet Copilot</h2>
    <p>${esc(p5FriendlyError(message))}</p>
    <button class="btn primary" type="button" data-retry-dashboard>Try again</button>
  </section>`;
};

const p5UpdateStatusBase = updateStatus;
updateStatus = function updateStatusP5() {
  p5UpdateStatusBase();
  p5RenderSystemNotice();
};

const p5RenderBase = render;
render = function renderP5() {
  const result = p5RenderBase();
  p5RenderSystemNotice();
  document.querySelectorAll('.meal-v2 summary').forEach(summary => {
    const details = summary.parentElement;
    summary.setAttribute('aria-label', `${details?.querySelector('.meal-type-v2')?.textContent || 'Meal'} details`);
  });
  return result;
};

function p5OpenDialogFocus() {
  requestAnimationFrame(()=>{
    const target = connectionDialog.querySelector('input[autofocus],input,button:not(#closeConnectionBtn)');
    target?.focus({preventScroll:true});
  });
}

const p5OpenConnectionBase = openConnection;
openConnection = function openConnectionP5() {
  p5OpenConnectionBase();
  p5OpenDialogFocus();
};

connectionDialog.addEventListener('click', event => {
  if (event.target === connectionDialog) connectionDialog.close();
});

window.addEventListener('online',()=>{
  p5RenderSystemNotice();
  if (cloud.user) showToast('Back online · syncing');
});
window.addEventListener('offline',()=>{
  p5RenderSystemNotice();
  if (cloud.user) showToast('Offline · showing saved data');
});

p5EnsureSystemNotice();
p5RenderSystemNotice();
