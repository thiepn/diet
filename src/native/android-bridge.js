'use strict';

// V7.0.3 native Android companion. This file is deliberately inert on the web.
const DIET_NATIVE_VERSION = '7.0.3';
const DIET_NATIVE_AUTH_START = 'https://thiepn.dev/diet/native-auth-start.html';
const DIET_NATIVE_PENDING_FLOW_KEY = 'diet-copilot:native-oauth-flow-v2';
let dietNativeAuthSubscription = null;
let dietNativeAuthUrlListener = null;
let dietNativeSessionFingerprint = null;
let dietNativePanelBusy = false;
let dietNativeOAuthBusy = false;
let dietNativeLastCode = null;
let dietNativeInstallPromise = null;

function dietNativePlugin(){
  return globalThis.Capacitor?.Plugins?.DietHealthConnect || null;
}
function dietNativeAppPlugin(){
  return globalThis.Capacitor?.Plugins?.App || null;
}
function dietNativeBrowserPlugin(){
  return globalThis.Capacitor?.Plugins?.Browser || null;
}
function dietIsNativeAndroid(){
  return Boolean(dietNativePlugin());
}
function dietNativeTime(value){
  if(!value)return 'Not synced yet';
  const d=new Date(value); return Number.isNaN(d.getTime())?'Not synced yet':d.toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function dietNativeRememberFlowId(flowId){
  try{
    if(flowId)localStorage.setItem(DIET_NATIVE_PENDING_FLOW_KEY,JSON.stringify({flowId,createdAt:Date.now()}));
    else localStorage.removeItem(DIET_NATIVE_PENDING_FLOW_KEY);
  }catch{}
}
function dietNativePendingFlowId(){
  try{
    const pending=JSON.parse(localStorage.getItem(DIET_NATIVE_PENDING_FLOW_KEY)||'null');
    if(!pending?.flowId || !pending.createdAt || Date.now()-pending.createdAt>15*60000 || pending.createdAt>Date.now()+60000){dietNativeRememberFlowId(null);return null;}
    return pending.flowId;
  }catch{return null;}
}

async function dietNativeStartGoogleOAuth(){
  if(!dietIsNativeAndroid()||!cloud?.client)throw new Error('Native sign-in is unavailable.');
  if(dietNativeOAuthBusy)return;
  const browser=dietNativeBrowserPlugin();
  if(!browser)throw new Error('Android browser integration is unavailable.');
  dietNativeOAuthBusy=true;
  try{
    dietAssertPersistentStorage();
    const {data,error}=await cloud.client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:DIET_AUTH_RELAY,
        skipBrowserRedirect:true,
        queryParams:{prompt:'select_account'}
      }
    });
    if(error)throw error;
    if(!data?.url)throw new Error('Google sign-in URL was not created.');

    const flowId=data.flowId||null;
    dietNativeRememberFlowId(flowId);

    // Open a first-party bootstrap page before Supabase. It marks this external
    // browser tab as the native client, then immediately continues to the
    // provider URL. This prevents the shared WordStrike callback from guessing
    // whether a PKCE code belongs to the website or to the Android WebView.
    const startUrl=new URL(DIET_NATIVE_AUTH_START);
    startUrl.hash=new URLSearchParams({auth_url:data.url,flow_id:flowId||''}).toString();
    await browser.open({url:startUrl.toString()});
  }catch(error){
    dietNativeRememberFlowId(null);
    throw error;
  }finally{
    dietNativeOAuthBusy=false;
  }
}

async function dietNativeHandleAuthUrl(rawUrl){
  if(!rawUrl||!cloud?.client)return false;
  const client=cloud.client, epoch=dietAccountEpoch;
  const current=()=>cloud.client===client && dietAccountEpoch===epoch && !dietSignOutPromise;
  let url;
  try{url=new URL(rawUrl)}catch{return false}
  if(url.protocol!=='dev.thiepn.diet:'||url.hostname!=='auth-callback')return false;

  await dietNativeBrowserPlugin()?.close?.().catch(()=>{});
  const authError=url.searchParams.get('error_description')||url.searchParams.get('error');
  if(authError){
    dietNativeRememberFlowId(null);
    cloud.error=dietAccountError({code:url.searchParams.get('error')||'oauth_error'});
    cloud.status='configured';
    updateStatus();
    if(connectionDialog?.open)renderConnection();
    showToast(cloud.error);
    return true;
  }

  const code=url.searchParams.get('code');
  if(!code){
    cloud.error='Google sign-in returned without an authorization code.';
    dietNativeRememberFlowId(null);
    if(connectionDialog?.open)renderConnection();
    showToast(cloud.error);
    return true;
  }

  if(dietNativeLastCode===code)return true;
  try{
    const pending=dietNativePendingFlowId();
    const supplied=url.searchParams.get('sb_flow_id');
    if(!pending || (supplied && supplied!==pending))throw new Error('This Android sign-in attempt expired. Start Google sign-in again.');
    dietNativeLastCode=code;
    const flowId=supplied||dietNativePendingFlowId();
    const {data,error}=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    if(!current())return true;
    if(error)throw error;
    if(!data?.session?.user)throw new Error('Google sign-in returned no session.');
    applyCloudSession(data.session);
    cloud.error=null;
    dietNativeRememberFlowId(null);
    dietNativeSessionFingerprint=null;
    updateStatus();
    await dietNativeConfigureSession();
    if(cloud.user){
      await refreshData({silent:true});
      await subscribeRealtime();
    }
    render();
    if(connectionDialog?.open)connectionDialog.close();
    showToast('Signed in with THIEPN Account');
  }catch(error){
    if(!current())return true;
    cloud.error=error?.message==='This Android sign-in attempt expired. Start Google sign-in again.' ? error.message : dietAccountError(error);
    dietNativeRememberFlowId(null);
    cloud.status='configured';
    updateStatus();
    if(connectionDialog?.open)renderConnection();
    showToast(`Google sign-in failed: ${cloud.error}`);
  }
  return true;
}

async function dietNativeInstallAuthDeepLink(){
  if(dietNativeInstallPromise)return dietNativeInstallPromise;
  dietNativeInstallPromise=dietNativeInstallAuthDeepLinkOnce().finally(()=>{dietNativeInstallPromise=null;});
  return dietNativeInstallPromise;
}
async function dietNativeInstallAuthDeepLinkOnce(){
  const appPlugin=dietNativeAppPlugin();
  if(!appPlugin||dietNativeAuthUrlListener)return;
  dietNativeAuthUrlListener=await appPlugin.addListener('appUrlOpen',event=>{
    dietNativeHandleAuthUrl(event?.url).catch(error=>{
      cloud.error=error?.message||String(error);
      if(connectionDialog?.open)renderConnection();
    });
  });
  const launch=await appPlugin.getLaunchUrl().catch(()=>null);
  if(launch?.url)await dietNativeHandleAuthUrl(launch.url);
}

async function dietNativeConfigureSession(){
  const plugin=dietNativePlugin();
  if(!plugin||!cloud?.client)return;
  const {data}=await cloud.client.auth.getSession();
  const session=data?.session;
  if(!session){
    dietNativeSessionFingerprint=null;
    await plugin.clearSession().catch(()=>{});
    return;
  }
  const fingerprint=`${session.user?.id||''}:${session.expires_at||0}:${String(session.refresh_token||'').slice(-8)}`;
  if(fingerprint===dietNativeSessionFingerprint)return;
  await plugin.configureSession({
    supabaseUrl:DIET_SUPABASE.url,
    anonKey:DIET_SUPABASE.key,
    accessToken:session.access_token,
    refreshToken:session.refresh_token,
    expiresAt:Number(session.expires_at||0)
  });
  dietNativeSessionFingerprint=fingerprint;
  await dietNativeConfigureReminders();
}

async function dietNativeConfigureReminders(){
  const plugin=dietNativePlugin(), p=dashboard?.profile;
  if(!plugin||!cloud?.user||!p)return;
  await plugin.configureReminders({
    weighEnabled:Boolean(p.weighInReminderEnabled),
    weighTime:p.weighInReminderTime||null,
    weeklyEnabled:Boolean(p.weeklyReviewReminderEnabled),
    weeklyDay:p.weeklyReviewDay==null?null:Number(p.weeklyReviewDay),
    weeklyTime:p.weeklyReviewTime||null,
    timezone:p.reminderTimezone||Intl.DateTimeFormat().resolvedOptions().timeZone
  }).catch(()=>{});
}

function dietNativeStateCopy(state){
  if(state.healthConnectStatus==='update_required')return 'Health Connect needs an update on this device.';
  if(state.healthConnectStatus!=='available')return 'Health Connect is unavailable on this device.';
  if(!state.permissionsGranted)return 'Connect Health Connect to sync steps, active calories, exercise and distance.';
  if(state.backgroundReadSupported&&!state.backgroundReadGranted)return 'Connected for foreground sync. Allow background health access for automatic syncing.';
  return 'Connected. Activity is used as coaching context and never automatically increases your calorie target.';
}

async function dietNativeRenderPanel(){
  if(!dietIsNativeAndroid()||!cloud?.user||dietNativePanelBusy)return;
  const host=connectionContent?.querySelector('.p5-account-footnote')?.parentElement || connectionContent;
  if(!host)return;
  let card=host.querySelector('[data-diet-native-health]');
  if(!card){
    card=document.createElement('section');
    card.className='diet-native-health';
    card.dataset.dietNativeHealth='';
    host.appendChild(card);
  }
  dietNativePanelBusy=true;
  try{
    await dietNativeConfigureSession();
    const state=await dietNativePlugin().getState();
    card.innerHTML=`
      <div class="diet-native-health-head"><div><span>Android</span><strong>Health Connect</strong></div><span class="diet-native-health-badge ${state.permissionsGranted?'connected':'idle'}">${state.permissionsGranted?'Connected':'Not connected'}</span></div>
      <p>${esc(dietNativeStateCopy(state))}</p>
      <div class="diet-native-health-stats">
        <div><span>Background sync</span><strong>${state.backgroundReadGranted?'Allowed':state.backgroundReadSupported?'Not allowed':'Unavailable'}</strong></div>
        <div><span>Last activity sync</span><strong>${esc(dietNativeTime(state.lastSyncAt))}</strong></div>
      </div>
      <div class="btn-row diet-native-health-actions">
        ${state.healthConnectStatus==='available'&&!state.permissionsGranted?'<button class="btn primary" type="button" data-native-connect>Connect Health Connect</button>':''}
        ${state.permissionsGranted?'<button class="btn primary" type="button" data-native-sync>Sync now</button>':''}
        ${!state.notificationPermissionGranted?'<button class="btn ghost" type="button" data-native-notifications>Allow reminders</button>':''}
      </div>`;
    card.querySelector('[data-native-connect]')?.addEventListener('click',async event=>{
      event.currentTarget.disabled=true;
      await dietNativePlugin().requestHealthPermissions();
      showToast('Complete Health Connect permissions, then return to Diet Copilot');
    });
    card.querySelector('[data-native-sync]')?.addEventListener('click',async event=>{
      const button=event.currentTarget; button.disabled=true; button.textContent='Syncing…';
      try{
        await dietNativePlugin().syncDailyActivity({days:2});
        await refreshData({silent:true});
        showToast('Health Connect synced');
      }catch(error){
        showToast(error?.message||'Health Connect sync failed');
      }finally{ dietNativeRenderPanel(); }
    });
    card.querySelector('[data-native-notifications]')?.addEventListener('click',async()=>{
      await dietNativePlugin().requestNotificationPermission();
      showToast('Notification permission requested');
    });
  }catch(error){
    card.innerHTML=`<div class="diet-native-health-head"><div><span>Android</span><strong>Health Connect</strong></div></div><p>${esc(error?.message||'Native integration is temporarily unavailable.')}</p>`;
  }finally{
    dietNativePanelBusy=false;
  }
}

async function dietNativeBootstrap(){
  if(!dietIsNativeAndroid()||!cloud?.client)return;
  await dietNativeInstallAuthDeepLink().catch(()=>{});
  await dietNativeConfigureSession().catch(()=>{});
  if(!dietNativeAuthSubscription){
    const {data}=cloud.client.auth.onAuthStateChange(()=>{
      dietNativeSessionFingerprint=null;
      setTimeout(()=>dietNativeConfigureSession().catch(()=>{}),0);
    });
    dietNativeAuthSubscription=data?.subscription||null;
  }
}

window.addEventListener('load',()=>dietNativeBootstrap());
window.addEventListener('focus',()=>{
  dietNativeBootstrap();
  if(connectionDialog?.open)dietNativeRenderPanel();
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')dietNativeBootstrap();
});
setTimeout(dietNativeBootstrap,500);

window.DietNative=Object.freeze({
  version:DIET_NATIVE_VERSION,
  isAndroid:dietIsNativeAndroid,
  state:()=>dietNativePlugin()?.getState(),
  sync:()=>dietNativePlugin()?.syncDailyActivity({days:2}),
  startGoogleOAuth:dietNativeStartGoogleOAuth,
  handleAuthUrl:dietNativeHandleAuthUrl
});
