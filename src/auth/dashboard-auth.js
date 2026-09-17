'use strict';

// Google-only THIEPN Account consumer. The shared project key stays unchanged.
const DIET_AUTH_RELAY = 'https://thiepn.dev/WORDSTRIKE/';
const DIET_OAUTH_TARGET_KEY = 'diet-copilot:oauth-target-v2';
const DIET_OAUTH_FLOW_KEY = 'diet-copilot:oauth-flow-v2';
const DIET_OAUTH_QUERY_KEYS = ['code','sb_flow_id','error','error_code','error_description'];
let dietAuthPhase = 'initializing';
let dietAccountEpoch = 0;
let dietAuthInitPromise = null;
let dietSignInPromise = null;
let dietSignOutPromise = null;
let dietCallbackHandled = false;
let dietHadOAuthCallback = false;
let dietAuthClientCount = 0;
let dietAuthLastEvent = null;
let dietAuthBusy = false;
let dietDeferredAuthEvent = null;
let dietAccountEvents = null;

function dietClearBrowserOAuthRelayState() {
  try { sessionStorage.removeItem(DIET_OAUTH_TARGET_KEY); sessionStorage.removeItem(DIET_OAUTH_FLOW_KEY); } catch {}
}
function dietSetBrowserOAuthRelayState(target, flowId) {
  try {
    sessionStorage.setItem(DIET_OAUTH_TARGET_KEY,target);
    if (flowId) sessionStorage.setItem(DIET_OAUTH_FLOW_KEY,flowId);
    else sessionStorage.removeItem(DIET_OAUTH_FLOW_KEY);
  } catch { /* PKCE uses the adapter backup; the relay defaults to the web target. */ }
}
function dietReadWebOAuthCallback() {
  const url = new URL(location.href);
  return {url, code:url.searchParams.get('code'), flowId:url.searchParams.get('sb_flow_id'),
    error:url.searchParams.get('error_code') || url.searchParams.get('error') || (url.searchParams.has('error_description') ? 'oauth_error' : null)};
}
function dietStripWebOAuthCallback(url) {
  const clean = new URL(url.href);
  for (const key of DIET_OAUTH_QUERY_KEYS) clean.searchParams.delete(key);
  history.replaceState(null,'',`${clean.pathname}${clean.search}${clean.hash}`);
}
function dietPkceVerifierMissing(error) {
  return /PKCE code verifier not found|AuthPKCECodeVerifierMissingError/i.test(`${error?.name || ''} ${error?.message || ''}`);
}
function dietAccountError(error) {
  if (error?.name === 'DietStorageError') return error.message;
  const code = error?.code || '';
  if (code === 'access_denied') return 'Google sign-in was cancelled. You can try again.';
  if (dietPkceVerifierMissing(error)) return 'This sign-in attempt expired or was opened in a different browser tab. Start a new Google sign-in here.';
  if (['refresh_token_not_found','refresh_token_already_used','session_not_found','bad_jwt'].includes(code)) return 'Your saved session is no longer valid. Please sign in again.';
  if (Number(error?.status) === 429) return 'Too many sign-in attempts. Wait a moment, then retry.';
  if (Number(error?.status) >= 500 || ['AbortError','TimeoutError','AuthRetryableFetchError','TypeError'].includes(error?.name)) return 'The account service could not be reached. Retry when connected; your saved sign-in has not been cleared.';
  return 'Sign-in could not be completed. Please try again.';
}
async function dietAccountFetch(input, options = {}) {
  // Bound network waits without turning a timeout into a sign-out.
  const timeout = AbortSignal.timeout(12000);
  const signal = options.signal ? AbortSignal.any([options.signal,timeout]) : timeout;
  return fetch(input,{...options,signal});
}
function dietClearPrivateViews() {
  dietAccountEpoch++;
  if (typeof v66RealtimeTimer !== 'undefined') clearTimeout(v66RealtimeTimer);
  clearTimeout(refreshTimer);
  if (typeof v66RefreshController !== 'undefined') v66RefreshController?.abort();
  dashboard = emptyDashboard();
  if (typeof v5EnsureDashboardShape === 'function') v5EnsureDashboardShape();
  for (const dialog of document.querySelectorAll('dialog')) {
    if (dialog !== connectionDialog) { if (dialog.open) dialog.close(); dialog.remove(); }
  }
  document.body.classList.remove('v53-detail-open');
  const tip = document.getElementById('chartTooltip');
  if (tip) { tip.textContent=''; tip.hidden=true; }
}
function applyCloudSession(session) {
  const previous = cloud.user?.id || null;
  const next = session?.user?.id || null;
  if (previous !== next) {
    dietClearPrivateViews();
    cloud.user = session?.user || null;
    if (next) dashboard = loadCachedDashboard(next);
    else { try { localStorage.removeItem(CACHE_KEY); } catch {} }
  } else { cloud.user = session?.user || null; }
  dietAuthPhase = next ? 'authenticated' : 'signed-out';
  cloud.status = next ? 'online' : 'configured';
  updateStatus();
  render();
  if (connectionDialog.open) renderConnection();
  return previous !== next;
}
async function disposeCloud() {
  const client = cloud.client;
  cloud.client = null;
  try { cloud.authSubscription?.unsubscribe(); } catch {}
  cloud.authSubscription = null;
  if (typeof dietNativeAuthSubscription !== 'undefined') {
    try { dietNativeAuthSubscription?.unsubscribe(); } catch {}
    dietNativeAuthSubscription = null;
    dietNativeSessionFingerprint = null;
  }
  if (client) {
    try { await client.auth.stopAutoRefresh(); } catch {}
    try { await client.removeAllChannels(); } catch {}
    try { await client.auth.dispose?.(); } catch {}
  }
  cloud.channel = null;
  cloud.v6ActivityChannel = null;
}
function dietObserveAccount(client) {
  const {data} = client.auth.onAuthStateChange((event, session)=>{
    dietAuthLastEvent = event;
    // INITIAL_SESSION is resolved by the bootstrap. No Supabase calls occur
    // under the auth event lock, and stale clients cannot mutate the active UI.
    if (event === 'INITIAL_SESSION' || dietSignOutPromise || dietAuthPhase==='signing-out') return;
    if (dietAuthBusy) {
      dietDeferredAuthEvent = {client,event,session};
      if (event === 'SIGNED_OUT' || (cloud.user && session?.user?.id !== cloud.user.id)) {
        // Invalidate any request already started for the previous identity.
        dietClearPrivateViews(); cloud.user=null;
      }
      return;
    }
    setTimeout(async()=>{
      try {
      if (client !== cloud.client || dietSignOutPromise) return;
      const changed = applyCloudSession(session);
      if (event === 'SIGNED_OUT') {
        await client.removeAllChannels().catch(()=>{});
        cloud.channel = null;
        cloud.error = null;
      } else if (session && changed) {
        await Promise.all([refreshData({silent:true}),subscribeRealtime()]);
      }
      } catch { /* A data failure is shown by the data layer, never as a logout. */ }
    },0);
  });
  cloud.authSubscription = data?.subscription || null;
}
async function initCloud(showDialog = false) {
  if (dietSignOutPromise) return dietSignOutPromise;
  if (!dietAuthInitPromise) {
    const run = async()=>{
      dietAuthBusy = true;
      const epoch = dietAccountEpoch;
      cloud.error = null;
      if (!cloud.user) { dietAuthPhase='initializing'; cloud.status='cache'; render(); }
      try {
        if (!window.supabase?.createClient) throw new Error('sdk_unavailable');
        if (!cloud.client) {
          dietMigrateTransientSession();
          cloud.client = window.supabase.createClient(cloudConfig.url,cloudConfig.key,{
            auth:{flowType: 'pkce', persistSession:true, autoRefreshToken:true,
              detectSessionInUrl: false, storageKey:DIET_AUTH_STORAGE_KEY, storage: dietAuthStorage},
            global:{fetch:dietAccountFetch}
          });
          cloud.client.__dietAuthStorageV2 = true;
          dietAuthClientCount++;
          dietObserveAccount(cloud.client);
        }
        const client = cloud.client;
        const callback = dietCallbackHandled ? {code:null,error:null} : dietReadWebOAuthCallback();
        dietCallbackHandled = true;
        let result;
        if (callback.code || callback.error) {
          dietHadOAuthCallback = true;
          dietStripWebOAuthCallback(callback.url);
          if (callback.error) throw Object.assign(new Error('OAuth failed'),{code:callback.error});
          const effectiveFlowId = callback.flowId || dietRestoreBrowserPkceVerifier('') || null;
          result = await client.auth.exchangeCodeForSession(callback.code, effectiveFlowId ? {flowId:effectiveFlowId} : undefined);
          if (result.error && effectiveFlowId && dietPkceVerifierMissing(result.error)) {
            result = await client.auth.exchangeCodeForSession(callback.code);
          }
          dietClearBrowserPkceBackup();
          dietClearBrowserOAuthRelayState();
        } else {
          result = await client.auth.getSession();
        }
        if (client !== cloud.client || dietSignOutPromise || epoch !== dietAccountEpoch) return;
        if (result.error) throw result.error;
        const session = result.data?.session || null;
        applyCloudSession(session);
        if (!session && dietStorageStatus.lastError === 'corrupt') cloud.error = dietStorageError('corrupt').message;
        if (session) {
          await Promise.all([refreshData({silent:true}),subscribeRealtime()]);
          if (typeof dietNativeBootstrap === 'function') dietNativeBootstrap().catch(()=>{});
        }
      } catch (error) {
        if (dietSignOutPromise || epoch !== dietAccountEpoch) return;
        cloud.error = error?.message === 'sdk_unavailable' ? 'The account component did not load. Reload the page to retry.' : dietAccountError(error);
        dietAuthPhase = cloud.user ? 'authenticated' : 'unavailable';
        cloud.status = 'error';
        if (dietHadOAuthCallback) { dietClearBrowserPkceBackup(); dietClearBrowserOAuthRelayState(); }
        updateStatus(); render();
        if (connectionDialog.open) renderConnection();
      } finally {
        dietAuthBusy = false;
        const pending=dietDeferredAuthEvent; dietDeferredAuthEvent=null;
        if(pending && pending.client===cloud.client && !dietSignOutPromise){
          const changed=applyCloudSession(pending.session);
          if(pending.session && changed)setTimeout(()=>{refreshData({silent:true});subscribeRealtime().catch(()=>{});},0);
          if(!pending.session){cloud.client.removeAllChannels().catch(()=>{});cloud.channel=null;}
        }
      }
    };
    dietAuthInitPromise = run().finally(()=>{dietAuthInitPromise=null;});
  }
  await dietAuthInitPromise;
  if (showDialog) openConnection();
}
async function dietResumeAccount() {
  if (dietSignOutPromise || dietSignInPromise || navigator.onLine === false) return;
  await initCloud(false);
}
async function dietSignInWithGoogle() {
  if (dietSignInPromise) return dietSignInPromise;
  const native = typeof dietIsNativeAndroid === 'function' && dietIsNativeAndroid() && window.DietNative?.startGoogleOAuth;
  dietSignInPromise = (async()=>{
    await initCloud(false);
    if (native) return window.DietNative.startGoogleOAuth();
    if (!cloud.client?.__dietAuthStorageV2) throw new Error('Account client unavailable');
    dietAssertPersistentStorage();
    dietClearBrowserOAuthRelayState();
    dietClearBrowserPkceBackup();
    const {data,error} = await cloud.client.auth.signInWithOAuth({provider:'google', options:{
      redirectTo:DIET_AUTH_RELAY, skipBrowserRedirect: true, queryParams:{prompt:'select_account'}
    }});
    if (error) throw error;
    const target = new URL(data?.url || '');
    if (target.origin !== new URL(cloudConfig.url).origin || target.pathname !== '/auth/v1/authorize') throw new Error('Invalid OAuth destination');
    dietSetBrowserOAuthRelayState('web',data.flowId || '');
    dietTagBrowserPkceBackupFlow(data.flowId || '');
    location.assign(target.href);
  })();
  try { return await dietSignInPromise; }
  catch(error) { dietSignInPromise=null; throw error; }
  finally { if(native)dietSignInPromise=null; }
}
async function dietSignOut() {
  if (dietSignOutPromise) return dietSignOutPromise;
  // Fence old data responses and hide private content immediately, before I/O.
  dietAuthPhase = 'signing-out';
  dietClearPrivateViews();
  cloud.user = null;
  cloud.status = 'configured';
  try { localStorage.removeItem(CACHE_KEY); } catch {}
  render(); renderConnection();
  dietSignOutPromise = (async()=>{
    const client = cloud.client;
    let remoteError = null;
    try { if (client) { const result=await client.auth.signOut({ scope: 'local' }); remoteError=result.error; } }
    catch(error) { remoteError=error; }
    finally {
      await disposeCloud();
      dietRawAuthStorageRemove(DIET_AUTH_STORAGE_KEY);
      for (const suffix of ['-user','-code-verifier','-flows-code-verifier']) dietRawAuthStorageRemove(DIET_AUTH_STORAGE_KEY+suffix);
      dietClearBrowserPkceBackup(); dietClearBrowserOAuthRelayState();
      if(typeof dietNativeRememberFlowId==='function')dietNativeRememberFlowId(null);
      try { localStorage.removeItem('diet-copilot-thiepn-auth-token-backup-v2'); } catch {}
      try { await dietNativePlugin()?.clearSession(); } catch {}
      try { dietAccountEvents?.postMessage({type:'signed-out'}); } catch {}
      dietAuthPhase='signed-out';
      cloud.error=remoteError ? 'Signed out on this device. The account service could not confirm server-side revocation.' : null;
      updateStatus(); render(); renderConnection();
    }
  })().finally(()=>{dietSignOutPromise=null;});
  return dietSignOutPromise;
}
try {
  dietAccountEvents = new BroadcastChannel('diet-account-lifecycle-v1');
  dietAccountEvents.onmessage = event=>{
    if (event.data?.type !== 'signed-out' || dietSignOutPromise) return;
    dietClearPrivateViews(); cloud.user=null;
    dietRawAuthStorageRemove(DIET_AUTH_STORAGE_KEY);
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    disposeCloud().then(()=>{applyCloudSession(null);});
  };
} catch { /* The SDK also propagates normal sign-out through its shared channel. */ }

function dietAccountDiagnostics() {
  // This object is safe to copy into a bug report: no tokens, emails, user IDs,
  // cookie contents, nutrition records, or OAuth query strings are included.
  let stored = false;
  try { stored=Boolean(dietRawAuthStorageGet(DIET_AUTH_STORAGE_KEY)); } catch {}
  return {release:'1.0.3',origin:location.origin,phase:dietAuthPhase,backend:dietStorageStatus.backend,
    storedSession:stored,storageError:dietStorageStatus.lastError,clientCount:dietAuthClientCount,
    lastEvent:dietAuthLastEvent,online:navigator.onLine,initializing:Boolean(dietAuthInitPromise)};
}
window.DietAccount = Object.freeze({version:'1.0.3',diagnostics:dietAccountDiagnostics,retry:()=>initCloud(false)});
