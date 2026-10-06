import { recordTelemetry,telemetryErrorCode } from './telemetry.mjs';

const state={
  registration:null,error:null,ready:false,installPrompt:null,
  installed:false,updateAvailable:false,controllerSeen:Boolean(navigator.serviceWorker?.controller)
};

const $=id=>document.getElementById(id);
const standalone=()=>matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
const ios=()=>/iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const canRegister=()=>('serviceWorker'in navigator)&&['https:','http:'].includes(location.protocol);
const toast=message=>window.DietV2Shell?.showToast?.(message);

function ensureUi(){
  const grid=document.querySelector('.dc-more-grid');
  if(grid&&!$('morePwaButton')){
    grid.insertAdjacentHTML('beforeend',
      '<button class="dc-more-card" id="morePwaButton" type="button"><span class="dc-more-icon" aria-hidden="true">⇩</span><span><strong>App & offline</strong><small id="morePwaSummary">Checking install and offline status…</small></span><span aria-hidden="true">›</span></button>');
  }
  if(!$('pwaDialog')){
    document.body.insertAdjacentHTML('beforeend',`
      <dialog class="dc-modal dc-p34-dialog" id="pwaDialog" aria-labelledby="pwaHeading">
        <div class="dc-modal-card">
          <div class="dc-panel-head">
            <div><p class="dc-eyebrow">App & offline</p><h2 id="pwaHeading">Install and offline access</h2></div>
            <button class="dc-icon-button" id="pwaCloseButton" type="button" aria-label="Close app and offline settings">×</button>
          </div>
          <p class="dc-panel-copy" id="pwaGuidance">Checking this browser's app capabilities…</p>
          <div class="dc-settings-list dc-settings-list--p9">
            <div><span>App</span><strong id="pwaInstallState">—</strong></div>
            <div><span>Offline shell</span><strong id="pwaOfflineState">—</strong></div>
            <div><span>Network</span><strong id="pwaNetworkState">—</strong></div>
          </div>
          <div class="dc-dialog-actions">
            <button class="dc-secondary-action" id="pwaInstallButton" type="button" hidden>Install app</button>
            <button class="dc-primary-action" id="pwaReloadButton" type="button" hidden>Reload update</button>
          </div>
        </div>
      </dialog>`);
  }
  $('morePwaButton')?.addEventListener('click',()=>{render();if(!$('pwaDialog')?.open)$('pwaDialog')?.showModal();});
  $('pwaCloseButton')?.addEventListener('click',()=>$('pwaDialog')?.close());
  $('pwaInstallButton')?.addEventListener('click',promptInstall);
  $('pwaReloadButton')?.addEventListener('click',()=>location.reload());
  $('pwaDialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
}

function render(){
  state.installed=standalone();
  const summary=$('morePwaSummary');
  const installState=$('pwaInstallState');
  const offlineState=$('pwaOfflineState');
  const networkState=$('pwaNetworkState');
  const guidance=$('pwaGuidance');
  const install=$('pwaInstallButton');
  const reload=$('pwaReloadButton');

  const installLabel=state.installed?'Installed':state.installPrompt?'Install available':ios()?'Add from Safari':'Browser install';
  const offlineLabel=state.ready?'Ready':state.error?'Unavailable':'Preparing';
  if(summary)summary.textContent=state.updateAvailable?'Update ready · reload':state.installed?`Installed · offline ${state.ready?'ready':'preparing'}`:state.installPrompt?`Install available · offline ${state.ready?'ready':'preparing'}`:`Offline ${state.ready?'ready':'preparing'}`;
  if(installState)installState.textContent=installLabel;
  if(offlineState)offlineState.textContent=offlineLabel;
  if(networkState)networkState.textContent=navigator.onLine===false?'Offline':'Online';

  if(guidance){
    guidance.textContent=state.updateAvailable
      ?'A newer Diet Copilot shell is ready. Reload when convenient to use the updated app.'
      :state.installed
        ?'Diet Copilot is running as an installed app. Core screens remain available after the offline shell has finished preparing.'
        :state.installPrompt
          ?'Install Diet Copilot for an app-like launch and reliable access to the cached core interface.'
          :ios()
            ?'In Safari, use Share → Add to Home Screen. Core screens remain available after the offline shell is ready.'
            :'Use your browser’s Install app or Add to Home Screen command when available.';
  }
  if(install){install.hidden=state.installed||!state.installPrompt;install.disabled=!state.installPrompt;}
  if(reload)reload.hidden=!state.updateAvailable;
}

async function promptInstall(){
  const prompt=state.installPrompt;
  if(!prompt)return;
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    recordTelemetry('pwa',{status:'install_prompt',outcome:choice?.outcome??'unknown'});
    state.installPrompt=null;
    if(choice?.outcome==='accepted')toast('Diet Copilot installation started.');
  }catch(error){
    recordTelemetry('pwa',{status:'install_error',code:telemetryErrorCode(error)});
  }
  render();
}

async function register(){
  ensureUi();
  state.installed=standalone();
  if(!canRegister()){
    recordTelemetry('pwa',{status:'unsupported',supported:false});
    render();
    return null;
  }
  recordTelemetry('pwa',{status:'registering',supported:true});
  try{
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    state.registration=registration;
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller){
          state.updateAvailable=true;
          render();
        }
      });
    });
    await navigator.serviceWorker.ready;
    state.ready=true;
    render();
    recordTelemetry('pwa',{status:'ready',ready:true,supported:true});
    registration.update().catch(error=>recordTelemetry('pwa',{status:'update_error',code:telemetryErrorCode(error),ready:true}));
    return registration;
  }catch(error){
    state.error=String(error?.message??error??'Service worker registration failed.');
    recordTelemetry('pwa',{status:'error',code:telemetryErrorCode(error),ready:false,supported:true});
    render();
    return null;
  }
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  state.installPrompt=event;
  render();
});
window.addEventListener('appinstalled',()=>{
  state.installPrompt=null;state.installed=true;
  recordTelemetry('pwa',{status:'installed'});
  render();
});
window.addEventListener('online',()=>{
  render();
  state.registration?.update?.().catch(error=>recordTelemetry('pwa',{status:'update_error',code:telemetryErrorCode(error)}));
});
window.addEventListener('offline',render);
navigator.serviceWorker?.addEventListener('controllerchange',()=>{
  if(state.controllerSeen){
    state.updateAvailable=true;
    toast('Diet Copilot update ready. Reload from App & offline when convenient.');
  }
  state.controllerSeen=true;
  render();
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')state.registration?.update?.().catch(()=>{});
});

window.DietV2Pwa=Object.freeze({
  version:'2.0.3-p34',
  promptInstall,
  snapshot:()=>({
    supported:canRegister(),ready:state.ready,error:state.error,installed:standalone(),
    installAvailable:Boolean(state.installPrompt),updateAvailable:state.updateAvailable,
    online:navigator.onLine!==false
  })
});

register();
