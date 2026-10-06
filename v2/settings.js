import {
getDietV2Model,getDietV2State,getDietV2OfflineCacheInfo,clearDietV2OfflineCache,
exportDietV2OwnerData,purgeDietV2LocalDevice
} from './data.js';
import {
normalizeUiPreferences,buildNutritionCsv,buildWeightCsv,DietSettingsDataP9
} from './engine/settings-data.mjs';
import { getDietWriteGuardState } from './write-api.mjs';
import {
getTelemetrySnapshot,buildTelemetryDiagnostics,clearTelemetry
} from './telemetry.mjs';
const PREF_KEY='diet-copilot-v2-ui-preferences-v1';
const DEFAULT_PREFS=Object.freeze({theme:'system',density:'comfortable',motion:'system'});
let prefs=loadPrefs();
function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function fmt(value,digits=1){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});}
function toast(message){window.DietV2Shell?.showToast?.(message);}
function safePrefs(value={}){return normalizeUiPreferences(value);}
function loadPrefs(){
try{return safePrefs(JSON.parse(localStorage.getItem(PREF_KEY)||'{}'));}catch{return {...DEFAULT_PREFS};}
}
function savePrefs(){
try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{}
}
function applyPrefs(){
const root=document.documentElement;
if(prefs.theme==='system')delete root.dataset.theme;
else root.dataset.theme=prefs.theme;
root.dataset.density=prefs.density;
if(prefs.motion==='reduce')root.dataset.motion='reduce';
else delete root.dataset.motion;
const systemDark=globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches??false;
const effectiveDark=prefs.theme==='dark'||(prefs.theme==='system'&&systemDark);
const themeMeta=document.querySelector('meta[name="theme-color"]');
if(themeMeta)themeMeta.setAttribute('content',effectiveDark?'#111512':'#f5f7f5');
document.querySelectorAll('[data-theme-choice]').forEach(x=>{
const selected=x.dataset.themeChoice===prefs.theme;
x.classList.toggle('is-selected',selected);x.setAttribute('aria-pressed',selected?'true':'false');
});
document.querySelectorAll('[data-density-choice]').forEach(x=>{
const selected=x.dataset.densityChoice===prefs.density;
x.classList.toggle('is-selected',selected);x.setAttribute('aria-pressed',selected?'true':'false');
});
document.querySelectorAll('[data-motion-choice]').forEach(x=>{
const selected=x.dataset.motionChoice===prefs.motion;
x.classList.toggle('is-selected',selected);x.setAttribute('aria-pressed',selected?'true':'false');
});
if($('moreAppearanceSummary'))$('moreAppearanceSummary').textContent=
(prefs.theme==='system'?'System':prefs.theme[0].toUpperCase()+prefs.theme.slice(1))+' · '+(prefs.density==='compact'?'Compact':'Comfortable');
}
function openDialog(id){
const dialog=$(id);
if(dialog&&!dialog.open)dialog.showModal();
}
function closeDialog(id){
const dialog=$(id);
if(dialog?.open)dialog.close();
}
function dateStamp(){
const d=new Date();
return d.toISOString().replace(/[:.]/g,'-');
}
function filename(suffix,ext){return 'diet-copilot-'+suffix+'-'+dateStamp()+'.'+ext;}
function downloadBlob(name,type,text){
const blob=new Blob([text],{type});
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;a.download=name;a.rel='noopener';
document.body.appendChild(a);a.click();a.remove();
setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fullExportReady(){
const state=getDietV2State();
return Boolean(state.signedIn&&state.source==='cloud'&&navigator.onLine!==false);
}
function localExportReady(){
return Boolean(getDietV2Model());
}
async function exportJson(){
if(!fullExportReady()){toast('A live signed-in connection is required for the complete Diet export.');return;}
const button=$('exportJsonButton');
if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
try{
const payload=await exportDietV2OwnerData();
downloadBlob(filename('full-export','json'),'application/json;charset=utf-8',JSON.stringify(payload,null,2));
toast('Complete Diet export downloaded · '+payload.totalRows+' rows across '+payload.tableCount+' tables.');
}catch(error){
toast(error?.message||'The complete Diet export could not be prepared.');
}finally{
if(button){button.removeAttribute('aria-busy');button.disabled=!fullExportReady();}
}
}
function exportNutrition(){
const model=getDietV2Model();
if(!model){toast('No nutrition history is loaded.');return;}
const output=buildNutritionCsv(model);
if(!output){toast('There is no nutrition history to export.');return;}
downloadBlob(filename('nutrition','csv'),'text/csv;charset=utf-8',output);
toast('Nutrition CSV downloaded.');
}
function exportWeights(){
const model=getDietV2Model();
if(!model){toast('No weight history is loaded.');return;}
const output=buildWeightCsv(model);
if(!output){toast('There is no weight history to export.');return;}
downloadBlob(filename('weights','csv'),'text/csv;charset=utf-8',output);
toast('Weight CSV downloaded.');
}
function renderBody(){
const model=getDietV2Model();
const card=$('moreBodySummary');
if(!model){
if(card)card.textContent='Weight history and goal';
return;
}
const count=model.progress?.rawWeights?.length??0;
if(card)card.textContent=model.today?.latestWeight==null
?'No scale weights logged yet'
:fmt(model.today.latestWeight,1)+' kg · '+count+' weigh-in'+(count===1?'':'s');
if($('bodyLatestWeight'))$('bodyLatestWeight').textContent=model.today?.latestWeight==null?'—':fmt(model.today.latestWeight,2)+' kg';
if($('bodyTrendWeight'))$('bodyTrendWeight').textContent=model.today?.trendWeight==null?'—':fmt(model.today.trendWeight,2)+' kg';
if($('bodyGoalWeight'))$('bodyGoalWeight').textContent=model.strategy?.goalWeight==null?'—':fmt(model.strategy.goalWeight,1)+' kg';
if($('bodyWeightEntries'))$('bodyWeightEntries').textContent=String(count);
if($('bodyLastDate'))$('bodyLastDate').textContent=model.today?.latestWeightDate||'—';
if($('bodyExportWeights'))$('bodyExportWeights').disabled=count===0;
}
function renderData(){
const state=getDietV2State();
const info=getDietV2OfflineCacheInfo();
if($('dataAccountState'))$('dataAccountState').textContent=state.signedIn?'Signed in':'Signed out';
if($('dataCloudState'))$('dataCloudState').textContent=state.source==='cloud'?'Live owner-scoped sync':state.source==='cache'?'Offline owner cache':'No private data loaded';
if($('dataCacheState'))$('dataCacheState').textContent=info.present?(info.savedAt?'Saved '+new Date(info.savedAt).toLocaleString():'Available'):'No offline cache';
if($('dataCopilotState'))$('dataCopilotState').textContent='Session-only · not stored in Diet database';
if($('exportJsonButton'))$('exportJsonButton').disabled=!fullExportReady();
for(const id of ['exportNutritionButton','exportWeightsButton']){
const el=$(id);if(el)el.disabled=!localExportReady();
}
if($('dataExportScope'))$('dataExportScope').textContent=fullExportReady()?'Live cloud · all 18 Diet tables':'Live sign-in required';
if($('dataDeletionState'))$('dataDeletionState').textContent='Central THIEPN Account cascade';
if($('dataBackupRetention'))$('dataBackupRetention').textContent='Encrypted recovery · up to 90 days';
if($('clearOfflineCacheButton'))$('clearOfflineCacheButton').disabled=!info.present;
if($('moreDataSummary'))$('moreDataSummary').textContent=info.present?'Full export + device privacy':'Export + privacy controls';
}
function renderIntegration(){
const label=$('v2HealthConnectLabel')?.textContent?.trim()||'Health Connect status unavailable';
if($('integrationHealthStatus'))$('integrationHealthStatus').textContent=label;
if($('moreIntegrationsSummary'))$('moreIntegrationsSummary').textContent=label;
const plugin=globalThis.Capacitor?.Plugins?.DietHealthConnect??null;
if($('integrationPlatform'))$('integrationPlatform').textContent=plugin?'Android native app':'Web/PWA';
const connect=$('integrationConnectHealth');
const sync=$('integrationSyncHealth');
if(connect)connect.hidden=!plugin||Boolean($('v2HealthConnectConnect')?.hidden);
if(sync)sync.hidden=!plugin||Boolean($('v2HealthConnectSync')?.hidden);
const state=getDietV2State();
if($('integrationSyncSource'))$('integrationSyncSource').textContent=state.source==='cloud'?'Supabase live sync':state.source==='cache'?'Offline cache':'Not connected';
}
function renderAccountSummary(){
const state=getDietV2State();
if($('moreAccountSummary'))$('moreAccountSummary').textContent=state.signedIn
?(state.source==='cloud'?'Signed in · synced':'Signed in · '+state.source)
:'Sign in and sync status';
}
function healthTime(value){
if(!value)return '—';
try{return new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch{return '—';}
}
function healthOverall(data,pwa,guard,telemetry){
if(navigator.onLine===false)return 'Offline';
if(guard?.blocked)return 'Refresh required';
if(data.status==='error')return 'Data error';
if(pwa?.error)return 'PWA issue';
if((telemetry.counts?.runtime_error??0)>0)return 'Review diagnostics';
if(data.status==='ready'||data.status==='signed_out')return 'Healthy';
return 'Checking';
}
function renderHealth(){
const data=getDietV2State();
const pwa=window.DietV2Pwa?.snapshot?.()??{supported:'serviceWorker' in navigator,ready:false,error:null};
const guard=getDietWriteGuardState();
const telemetry=getTelemetrySnapshot();
const overall=healthOverall(data,pwa,guard,telemetry);
if($('moreHealthSummary'))$('moreHealthSummary').textContent=overall+' · local diagnostics';
if($('healthOverall'))$('healthOverall').textContent=overall;
if($('healthDataState'))$('healthDataState').textContent=data.status+' · '+data.source;
if($('healthNetwork'))$('healthNetwork').textContent=navigator.onLine===false?'Offline':'Online';
if($('healthRealtime'))$('healthRealtime').textContent=data.realtimeStatus||'idle';
if($('healthPwa'))$('healthPwa').textContent=pwa.error?'Error':pwa.ready?'Ready':pwa.supported?'Starting':'Unsupported';
if($('healthWriteGuard'))$('healthWriteGuard').textContent=guard?.blocked?'Blocked pending refresh':'Clear';
if($('healthTelemetryStore'))$('healthTelemetryStore').textContent=telemetry.storage==='local'
?telemetry.eventCount+' local event'+(telemetry.eventCount===1?'':'s')
:'Memory only · '+telemetry.eventCount+' event'+(telemetry.eventCount===1?'':'s');
if($('healthLastEvent'))$('healthLastEvent').textContent=healthTime(telemetry.lastEventAt);
if($('healthEventCount'))$('healthEventCount').textContent=String(telemetry.events24h);
const list=$('healthRecentEvents');
if(list){
const recent=telemetry.recent.slice(-8).reverse();
list.innerHTML=recent.length?recent.map(item=>{
const meta=Object.entries(item.meta??{}).slice(0,4).map(([key,value])=>key+'='+value).join(' · ');
return '<div class="dc-health-event"><span>'+esc(new Date(item.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}))+'</span><strong>'+esc(item.type)+'</strong><small>'+esc(meta||'operational event')+'</small></div>';
}).join(''):'<div class="dc-empty-state dc-empty-state--compact"><div><strong>No diagnostic events yet</strong><p>Operational events will appear here as the app runs.</p></div></div>';
}
}
function healthDiagnosticsObject(){
const data=getDietV2State();
const pwa=window.DietV2Pwa?.snapshot?.()??{};
const guard=getDietWriteGuardState();
return buildTelemetryDiagnostics({
status:data.status,
source:data.source,
realtime:data.realtimeStatus||'idle',
online:navigator.onLine!==false,
workerReady:Boolean(pwa.ready),
supported:Boolean(pwa.supported),
writeBlocked:Boolean(guard?.blocked)
});
}
async function copyHealthDiagnostics(){
const text=JSON.stringify(healthDiagnosticsObject(),null,2);
try{
await navigator.clipboard.writeText(text);
toast('System diagnostics copied.');
return;
}catch{}
const area=document.createElement('textarea');
area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';
document.body.appendChild(area);area.select();
try{document.execCommand('copy');toast('System diagnostics copied.');}
catch{toast('Copy failed.');}
area.remove();
}
function clearHealthHistory(){
clearTelemetry();
renderHealth();
toast('Local diagnostic history cleared.');
}
function renderAll(){
applyPrefs();
renderBody();
renderData();
renderIntegration();
renderAccountSummary();
renderHealth();
}
function openBody(){
renderBody();
openDialog('bodyWeightDialog');
}
function openAppearance(){
applyPrefs();
openDialog('appearanceDialog');
}
function openData(){
renderData();
openDialog('dataExportDialog');
}
function openIntegrations(){
renderIntegration();
openDialog('integrationsDialog');
}
function openHealth(){
renderHealth();
openDialog('systemHealthDialog');
}
function setPreference(kind,value){
if(kind==='theme')prefs=safePrefs({...prefs,theme:value});
if(kind==='density')prefs=safePrefs({...prefs,density:value});
if(kind==='motion')prefs=safePrefs({...prefs,motion:value});
savePrefs();applyPrefs();
}
function clearCache(){
if(clearDietV2OfflineCache()){
renderData();
toast('Offline Diet cache cleared. Cloud data was not deleted.');
}else toast('Offline cache could not be cleared.');
}
async function clearDeviceData(){
if(!confirm('Clear Diet Copilot data from this device and sign out? Your cloud nutrition data will not be deleted.'))return;
const button=$('clearDeviceDataButton');
if(button){button.disabled=true;button.textContent='Clearing…';}
try{
window.DietV2Copilot?.clearSession?.();
await purgeDietV2LocalDevice();
clearTelemetry();
try{localStorage.removeItem(PREF_KEY)}catch{}
prefs={...DEFAULT_PREFS};
applyPrefs();
renderAll();
toast('Diet data cleared from this device. Cloud data was not deleted.');
}catch(error){
toast(error?.message||'Local Diet data could not be fully cleared.');
}finally{
if(button){button.disabled=false;button.textContent='Clear this device';}
}
}
function clearCopilot(){
if(window.DietV2Copilot?.clearSession){
window.DietV2Copilot.clearSession();
toast('Copilot session chat cleared.');
}else toast('Copilot session is not available.');
}
function openProgressFromBody(){
closeDialog('bodyWeightDialog');
location.hash='#progress';
setTimeout(()=>$('progressWeightChart')?.scrollIntoView({behavior:'smooth',block:'center'}),120);
}
function openStrategyIntegration(){
closeDialog('integrationsDialog');
location.hash='#strategy';
setTimeout(()=>$('strategyActivityPanel')?.scrollIntoView({behavior:'smooth',block:'center'}),120);
}
function mirrorNativeAction(id){
const target=$(id);
if(!target||target.hidden){toast('That Health Connect action is not available in this environment.');return;}
target.click();
setTimeout(renderIntegration,700);
}
$('moreBodyButton')?.addEventListener('click',openBody);
$('moreAppearanceButton')?.addEventListener('click',openAppearance);
$('moreDataButton')?.addEventListener('click',openData);
$('moreIntegrationsButton')?.addEventListener('click',openIntegrations);
$('moreHealthButton')?.addEventListener('click',openHealth);
$('healthCopyDiagnostics')?.addEventListener('click',copyHealthDiagnostics);
$('healthClearDiagnostics')?.addEventListener('click',clearHealthHistory);
$('healthRefresh')?.addEventListener('click',()=>{renderHealth();window.DietV2Data?.refresh?.({silent:true}).catch(()=>{});});
document.querySelectorAll('[data-p9-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.p9Close)));
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>setPreference('theme',button.dataset.themeChoice)));
document.querySelectorAll('[data-density-choice]').forEach(button=>button.addEventListener('click',()=>setPreference('density',button.dataset.densityChoice)));
document.querySelectorAll('[data-motion-choice]').forEach(button=>button.addEventListener('click',()=>setPreference('motion',button.dataset.motionChoice)));
$('exportJsonButton')?.addEventListener('click',exportJson);
$('exportNutritionButton')?.addEventListener('click',exportNutrition);
$('exportWeightsButton')?.addEventListener('click',exportWeights);
$('clearOfflineCacheButton')?.addEventListener('click',clearCache);
$('clearCopilotSessionButton')?.addEventListener('click',clearCopilot);
$('clearDeviceDataButton')?.addEventListener('click',clearDeviceData);
$('bodyOpenProgress')?.addEventListener('click',openProgressFromBody);
$('bodyExportWeights')?.addEventListener('click',exportWeights);
$('integrationOpenActivity')?.addEventListener('click',openStrategyIntegration);
$('integrationConnectHealth')?.addEventListener('click',()=>mirrorNativeAction('v2HealthConnectConnect'));
$('integrationSyncHealth')?.addEventListener('click',()=>mirrorNativeAction('v2HealthConnectSync'));
for(const dialogId of ['bodyWeightDialog','appearanceDialog','dataExportDialog','integrationsDialog','systemHealthDialog']){
$(dialogId)?.addEventListener('click',event=>{if(event.target===$(dialogId))closeDialog(dialogId);});
}
window.addEventListener('diet-v2-data-updated',renderAll);
window.addEventListener('diet-v2-telemetry-updated',renderHealth);
window.addEventListener('diet-v2-reliability-updated',renderHealth);
window.addEventListener('focus',()=>{renderIntegration();renderData();renderHealth();});
try{
globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener('change',()=>{
if(prefs.theme==='system')applyPrefs();
});
}catch{}
applyPrefs();
renderAll();
window.DietV2Settings=Object.freeze({
version:'2.0.3-p17',
settingsDataVersion:DietSettingsDataP9.version,
preferences:()=>({...prefs}),
apply:applyPrefs,
exportJson,
exportNutrition,
exportWeights,
healthDiagnostics:healthDiagnosticsObject
});
