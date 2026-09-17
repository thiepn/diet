'use strict';

// The only account renderer. Authentication, connection trouble and an absent
// session are different states; diagnostics are always credential-free.
function openConnection() {
  renderConnection();
  if (!connectionDialog.open) connectionDialog.showModal();
  if (typeof p5OpenDialogFocus === 'function') p5OpenDialogFocus();
}
function renderConnection() {
  const busy = ['initializing','signing-out'].includes(dietAuthPhase);
  const signedIn = Boolean(cloud.user);
  const diagnostic = dietAccountDiagnostics();
  const storageCopy = diagnostic.backend === 'localStorage' ? 'Persistent browser storage' : diagnostic.backend === 'cookie' ? 'Persistent first-party cookies' : 'No saved session';
  connectionContent.innerHTML = `
    <div class="connection-state">
      <strong>${signedIn ? 'THIEPN Account' : busy ? (dietAuthPhase==='signing-out'?'Signing out…':'Restoring your account…') : 'Sign in with THIEPN Account'}</strong>
      <span>${signedIn ? `Signed in as ${esc(cloud.user.email || 'your Google account')}. Your nutrition data is private to this account.` : busy ? 'Please wait while the account state is resolved.' : 'Continue with Google to sync Diet Copilot.'}</span>
    </div>
    ${cloud.error ? `<div class="p5-inline-alert" role="alert">${esc(cloud.error)}</div>` : ''}
    <div class="btn-row">
      ${signedIn ? '<button class="btn primary" id="refreshNowBtn" type="button">Refresh data</button><button class="btn ghost" id="signOutBtn" type="button">Sign out</button>' : busy ? '<button class="btn primary" disabled>Please wait…</button>' : `${dietAuthPhase==='unavailable'?'<button class="btn primary" id="accountRetryBtn" type="button">Retry connection</button>':''}<button class="btn ${dietAuthPhase==='unavailable'?'ghost':'primary'}" id="googleSignInBtn" type="button">Continue with Google</button>`}
    </div>
    <details class="diet-account-diagnostics">
      <summary>Account diagnostics · v1.0.3</summary>
      <p>${esc(storageCopy)} · ${esc(dietAuthPhase)}. No credentials are included below.</p>
      <pre>${esc(JSON.stringify(diagnostic,null,2))}</pre>
      <button class="btn ghost" type="button" id="accountCopyDiagnosticsBtn">Copy diagnostics</button>
    </details>`;
  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    button.disabled=true; button.textContent='Redirecting…'; cloud.error=null;
    try { await dietSignInWithGoogle(); }
    catch(error) { cloud.error=dietAccountError(error); renderConnection(); }
  });
  connectionContent.querySelector('#accountRetryBtn')?.addEventListener('click',async()=>{
    const pending=initCloud(false); renderConnection(); await pending; renderConnection();
  });
  connectionContent.querySelector('#signOutBtn')?.addEventListener('click',()=>{dietSignOut();});
  connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click',async event=>{
    event.currentTarget.disabled=true;
    await refreshData({silent:true});
    if (connectionDialog.open) renderConnection();
  });
  connectionContent.querySelector('#accountCopyDiagnosticsBtn')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    try { await navigator.clipboard.writeText(JSON.stringify(dietAccountDiagnostics(),null,2)); button.textContent='Copied'; }
    catch { button.textContent='Select and copy the text above'; }
  });
  if (signedIn && typeof dietIsNativeAndroid==='function' && dietIsNativeAndroid()) setTimeout(()=>dietNativeRenderPanel(),0);
}

const dietAccountRenderBase = render;
render = function renderWithAccountBoundary() {
  if (dietAuthPhase === 'initializing' && !cloud.user) { app.innerHTML=p2LoadingState(); updateStatus(); return; }
  if (dietAuthPhase === 'unavailable' && !cloud.user) {
    app.innerHTML=`<section class="today-state today-error"><h2>Account connection unavailable</h2><p>${esc(cloud.error || 'Retry to restore your saved account.')}</p><button class="btn primary" data-account-retry>Retry connection</button><button class="btn ghost" data-account-open>Account details</button></section>`;
    app.querySelector('[data-account-retry]')?.addEventListener('click',()=>initCloud(false));
    app.querySelector('[data-account-open]')?.addEventListener('click',openConnection);
    updateStatus(); return;
  }
  return dietAccountRenderBase();
};
