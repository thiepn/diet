import {
  getDietV2Model,getDietV2RawData,getDietV2State,getDietV2OfflineCacheInfo,clearDietV2OfflineCache
} from './data.js';

const PREF_KEY='diet-copilot-v2-ui-preferences-v1';
const DEFAULT_PREFS=Object.freeze({theme:'system',density:'comfortable',motion:'system'});
let prefs=loadPrefs();

function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function fmt(value,digits=1){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});}
function toast(message){window.DietV2Shell?.showToast?.(message);}
function safePrefs(value={}){
  return {
    theme:['system','light','dark'].includes(value.theme)?value.theme:'system',
    density:['comfortable','compact'].includes(value.density)?value.density:'comfortable',
    motion:['system','reduce'].includes(value.motion)?value.motion:'system'
  };
}
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
  document.querySelectorAll('[data-theme-choice]').forEach(x=>x.classList.toggle('is-selected',x.dataset.themeChoice===prefs.theme));
  document.querySelectorAll('[data-density-choice]').forEach(x=>x.classList.toggle('is-selected',x.dataset.densityChoice===prefs.density));
  document.querySelectorAll('[data-motion-choice]').forEach(x=>x.classList.toggle('is-selected',x.dataset.motionChoice===prefs.motion));
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
function csvCell(value){
  if(value==null)return '';
  const s=String(value);
  return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
function csv(rows,headers){
  return [
    headers.join(','),
    ...rows.map(row=>headers.map(h=>csvCell(row[h])).join(','))
  ].join('\r\n');
}
function exportReady(){
  const state=getDietV2State();
  return Boolean(state.signedIn&&getDietV2Model()&&getDietV2RawData());
}
function exportJson(){
  const raw=getDietV2RawData();
  const model=getDietV2Model();
  if(!raw||!model){toast('No private Diet data is loaded to export.');return;}
  const payload={
    format:'diet-copilot-backup',
    version:1,
    exportedAt:new Date().toISOString(),
    asOfDate:model.asOfDate,
    note:'Owner-scoped Diet Copilot export. Authentication tokens are not included.',
    data:raw
  };
  downloadBlob(filename('backup','json'),'application/json;charset=utf-8',JSON.stringify(payload,null,2));
  toast('Private JSON backup downloaded.');
}
function exportNutrition(){
  const model=getDietV2Model();
  if(!model){toast('No nutrition history is loaded.');return;}
  const rows=(model.progress?.intake??[]).map(x=>({
    date:x.date,
    calories:x.calories,
    calorie_target:x.target,
    protein_g:x.protein,
    day_status:x.status
  }));
  if(!rows.length){toast('There is no nutrition history to export.');return;}
  downloadBlob(filename('nutrition','csv'),'text/csv;charset=utf-8',
    csv(rows,['date','calories','calorie_target','protein_g','day_status']));
  toast('Nutrition CSV downloaded.');
}
function exportWeights(){
  const model=getDietV2Model();
  if(!model){toast('No weight history is loaded.');return;}
  const trend=new Map((model.progress?.trendWeights??[]).map(x=>[x.date,x.value]));
  const rows=(model.progress?.rawWeights??[]).map(x=>({
    date:x.date,
    scale_weight_kg:x.value,
    trend_weight_kg:trend.get(x.date)??''
  }));
  if(!rows.length){toast('There is no weight history to export.');return;}
  downloadBlob(filename('weights','csv'),'text/csv;charset=utf-8',
    csv(rows,['date','scale_weight_kg','trend_weight_kg']));
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
}
function renderData(){
  const state=getDietV2State();
  const info=getDietV2OfflineCacheInfo();
  if($('dataAccountState'))$('dataAccountState').textContent=state.signedIn?'Signed in':'Signed out';
  if($('dataCloudState'))$('dataCloudState').textContent=state.source==='cloud'?'Live owner-scoped sync':state.source==='cache'?'Offline owner cache':'No private data loaded';
  if($('dataCacheState'))$('dataCacheState').textContent=info.present?(info.savedAt?'Saved '+new Date(info.savedAt).toLocaleString():'Available'):'No offline cache';
  if($('dataCopilotState'))$('dataCopilotState').textContent='Session-only · not stored in Diet database';
  for(const id of ['exportJsonButton','exportNutritionButton','exportWeightsButton']){
    const el=$(id);if(el)el.disabled=!exportReady();
  }
  if($('clearOfflineCacheButton'))$('clearOfflineCacheButton').disabled=!info.present;
  if($('moreDataSummary'))$('moreDataSummary').textContent=info.present?'Export + offline cache controls':'Export + privacy controls';
}
function renderIntegration(){
  const label=$('v2HealthConnectLabel')?.textContent?.trim()||'Health Connect status unavailable';
  if($('integrationHealthStatus'))$('integrationHealthStatus').textContent=label;
  if($('moreIntegrationsSummary'))$('moreIntegrationsSummary').textContent=label;
  const plugin=globalThis.Capacitor?.Plugins?.DietHealthConnect??null;
  if($('integrationPlatform'))$('integrationPlatform').textContent=plugin?'Android native app':'Web/PWA';
  const state=getDietV2State();
  if($('integrationSyncSource'))$('integrationSyncSource').textContent=state.source==='cloud'?'Supabase live sync':state.source==='cache'?'Offline cache':'Not connected';
}
function renderAccountSummary(){
  const state=getDietV2State();
  if($('moreAccountSummary'))$('moreAccountSummary').textContent=state.signedIn
    ?(state.source==='cloud'?'Signed in · synced':'Signed in · '+state.source)
    :'Sign in and sync status';
}
function renderAll(){
  applyPrefs();
  renderBody();
  renderData();
  renderIntegration();
  renderAccountSummary();
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
document.querySelectorAll('[data-p9-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.p9Close)));
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>setPreference('theme',button.dataset.themeChoice)));
document.querySelectorAll('[data-density-choice]').forEach(button=>button.addEventListener('click',()=>setPreference('density',button.dataset.densityChoice)));
document.querySelectorAll('[data-motion-choice]').forEach(button=>button.addEventListener('click',()=>setPreference('motion',button.dataset.motionChoice)));
$('exportJsonButton')?.addEventListener('click',exportJson);
$('exportNutritionButton')?.addEventListener('click',exportNutrition);
$('exportWeightsButton')?.addEventListener('click',exportWeights);
$('clearOfflineCacheButton')?.addEventListener('click',clearCache);
$('clearCopilotSessionButton')?.addEventListener('click',clearCopilot);
$('bodyOpenProgress')?.addEventListener('click',openProgressFromBody);
$('bodyExportWeights')?.addEventListener('click',exportWeights);
$('integrationOpenActivity')?.addEventListener('click',openStrategyIntegration);
$('integrationConnectHealth')?.addEventListener('click',()=>mirrorNativeAction('v2HealthConnectConnect'));
$('integrationSyncHealth')?.addEventListener('click',()=>mirrorNativeAction('v2HealthConnectSync'));

for(const dialogId of ['bodyWeightDialog','appearanceDialog','dataExportDialog','integrationsDialog']){
  $(dialogId)?.addEventListener('click',event=>{if(event.target===$(dialogId))closeDialog(dialogId);});
}
window.addEventListener('diet-v2-data-updated',renderAll);
window.addEventListener('focus',()=>{renderIntegration();renderData();});

applyPrefs();
renderAll();

window.DietV2Settings=Object.freeze({
  version:'1.0.0-p9',
  preferences:()=>({...prefs}),
  apply:applyPrefs,
  exportJson,
  exportNutrition,
  exportWeights
});
