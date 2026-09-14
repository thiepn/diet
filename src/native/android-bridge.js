'use strict';

// V7.0 native Android companion. This file is deliberately inert on the web.
const DIET_NATIVE_VERSION = '7.0.0';
let dietNativeAuthSubscription = null;
let dietNativeAuthUrlListener = null;
let dietNativeSessionFingerprint = null;
let dietNativePanelBusy = false;
let dietNativeOAuthBusy = false;

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

async function dietNativeStartGoogleOAuth(){
  if(!dietIsNativeAndroid()||!cloud?.client)throw new Error('Native sign-in is unavailable.');
  if(dietNativeOAuthBusy)return;
  const browser=dietNativeBrowserPlugin();
  if(!browser)throw new Error('Android browser integration is unavailable.');
  dietNativeOAuthBusy=true;
  try{
    const {data,error}=await cloud.client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:DIET_NATIVE_AUTH_REDIRECT,
        skipBrowserRedirect:true,
        queryParams:{prompt:'select_account'}
      }
    });
    if(error)throw error;
    if(!data?.url)throw new Error('Google sign-in URL was not created.');
    await browser.open({url:data.url});
  }finally{
    dietNativeOAuthBusy=false;
  }
}

async function dietNativeHandleAuthUrl(rawUrl){
  if(!rawUrl||!cloud?.client)return false;
  let url;
  try{url=new URL(rawUrl)}catch{return false}
  if(url.protocol!=='dev.thiepn.diet:'||url.hostname!=='auth-callback')return false;

  await dietNativeBrowserPlugin()?.close?.().catch(()=>{});
  const authError=url.searchParams.get('error_description')||url.searchParams.get('error');
  if(authError){
    cloud.error=authError;
    cloud.status='configured';
    updateStatus();
    if(connectionDialog?.open)renderConnection();
    showToast(`Google sign-in failed: ${authError}`);
    return true;
  }

  const code=url.searchParams.get('code');
  if(!code){
    cloud.error='Google sign-in returned without an authorization code.';
    if(connectionDialog?.open)renderConnection();
    showToast(cloud.error);
    return true;
  }

  try{
    const flowId=url.searchParams.get('sb_flow_id');
    const {data,error}=await cloud.client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    if(error)throw error;
    cloud.user=data?.session?.user||null;
    cloud.status=cloud.user?'online':'configured';
    cloud.error=null;
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
    cloud.error=error?.message||String(error);
    cloud.status='configured';
    updateStatus();
    if(connectionDialog?.open)renderConnection();
    showToast(`Google sign-in failed: ${cloud.error}`);
  }
  return true;
}

async function dietNativeInstallAuthDeepLink(){
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

const dietNativeRenderConnectionBase=renderConnection;
renderConnection=function renderConnectionNative(){
  const result=dietNativeRenderConnectionBase();
  if(dietIsNativeAndroid()&&cloud?.user)queueMicrotask(dietNativeRenderPanel);
  return result;
};

async function dietNativeBootstrap(){
  if(!dietIsNativeAndroid()||!cloud?.client)return;
  await dietNativeInstallAuthDeepLink().catch(()=>{});
  await dietNativeConfigureSession().catch(()=>{});
  if(!dietNativeAuthSubscription){
    const {data}=cloud.client.auth.onAuthStateChange(()=>{
      dietNativeSessionFingerprint=null;
      queueMicrotask(()=>dietNativeConfigureSession().catch(()=>{}));
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
