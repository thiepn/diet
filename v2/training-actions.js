import {
  DIET_V2_SUPABASE_URL,DIET_V2_SUPABASE_KEY,
  getDietV2Client,getDietV2Model,getDietV2State,refresh
} from './data.js';
import { saveTrainingDistribution,upsertTrainingDay,deleteTrainingDay } from './write-api.mjs';
import { buildTrainingNutritionPlan } from '../src/engine/training-nutrition.mjs';

const DOW=['mon','tue','wed','thu','fri','sat','sun'];
const LABEL={mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
const TYPE_LABEL={rest:'Rest',light:'Light',moderate:'Moderate',hard:'Hard'};
let draft=null;
let draftDirty=false;
let busy=false;
let nativeBusy=false;

function $(id){return document.getElementById(id);}
function fmt(value,digits=0){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
}
function cap(value=''){return String(value).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
function liveReady(){
  const s=getDietV2State();
  return s.signedIn&&s.source==='cloud'&&navigator.onLine!==false;
}
function toast(message){
  const el=document.querySelector('[data-toast]');
  if(!el)return;
  el.textContent=message;el.classList.add('is-visible');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('is-visible'),2800);
}
function nativePlugin(){return globalThis.Capacitor?.Plugins?.DietHealthConnect??null;}
function cloneSettings(settings={}){
  return {
    enabled:Boolean(settings.enabled),
    hardExtraKcal:Number(settings.hardExtraKcal??150),
    moderateExtraKcal:Number(settings.moderateExtraKcal??75),
    lightExtraKcal:Number(settings.lightExtraKcal??25),
    weeklyTemplate:{...Object.fromEntries(DOW.map(d=>[d,'rest'])),...(settings.weeklyTemplate??{})}
  };
}
function currentDraft(model){
  if(!draft||!draftDirty)draft=cloneSettings(model.strategy.trainingNutrition.settings);
  return draft;
}
function basePlanInput(model,settings){
  const p6=model.strategy.trainingNutrition;
  return {
    asOfDate:model.asOfDate,
    baseCalories:model.strategy.currentTarget,
    protein:model.today.proteinTarget??p6.today?.macros?.protein??0,
    fat:p6.today?.macros?.fat??0,
    settings,
    trainingDays:p6.trainingDays??[],
    activity:[],
    minCalories:1200,
    maxCalories:6000
  };
}
function preview(model){
  return buildTrainingNutritionPlan(basePlanInput(model,currentDraft(model)));
}
function shiftOptions(value,max){
  const values=[];
  for(let n=0;n<=max;n+=25)values.push(n);
  return values.map(n=>'<option value="'+n+'" '+(Number(value)===n?'selected':'')+'>'+(n?'+':'')+n+'</option>').join('');
}
function typeOptions(value){
  return ['rest','light','moderate','hard'].map(type=>'<option value="'+type+'" '+(value===type?'selected':'')+'>'+TYPE_LABEL[type]+'</option>').join('');
}
function dayMarkup(day){
  return '<label class="dc-training-day" data-training-dow="'+day.dow+'">'+
    '<span>'+LABEL[day.dow]+'</span>'+
    '<select data-training-template="'+day.dow+'">'+typeOptions(day.dayType)+'</select>'+
    '<strong>'+fmt(day.targetCalories)+' kcal</strong>'+
    '<small>'+((day.deltaKcal>0?'+':'')+fmt(day.deltaKcal))+' · '+fmt(day.macros?.carbs)+' g carbs</small>'+
  '</label>';
}
function renderDistribution(model){
  const p=model.strategy.trainingNutrition;
  const settings=currentDraft(model);
  const plan=preview(model);
  const enabled=$('trainingDistributionEnabled');
  if(enabled)enabled.checked=settings.enabled;
  const hard=$('trainingHardShift'),moderate=$('trainingModerateShift'),light=$('trainingLightShift');
  if(hard)hard.innerHTML=shiftOptions(settings.hardExtraKcal,300);
  if(moderate)moderate.innerHTML=shiftOptions(settings.moderateExtraKcal,250);
  if(light)light.innerHTML=shiftOptions(settings.lightExtraKcal,150);

  const host=$('trainingWeekPlanner');
  if(host)host.innerHTML=plan.distribution.week.map(dayMarkup).join('');
  $('trainingDistributionStatus').textContent=settings.enabled?'On':'Off';
  $('trainingWeeklyBase').textContent=plan.distribution.weeklyBaseCalories==null?'—':fmt(plan.distribution.weeklyBaseCalories)+' kcal';
  $('trainingWeeklyDistributed').textContent=plan.distribution.weeklyDistributedCalories==null?'—':fmt(plan.distribution.weeklyDistributedCalories)+' kcal';
  const diff=(plan.distribution.weeklyDistributedCalories??0)-(plan.distribution.weeklyBaseCalories??0);
  $('trainingWeeklyDifference').textContent=plan.distribution.weeklyBaseCalories==null?'—':(diff>0?'+':'')+fmt(diff)+' kcal';

  host?.querySelectorAll('[data-training-template]').forEach(select=>{
    select.addEventListener('change',()=>{
      const dow=select.dataset.trainingTemplate;
      draft.weeklyTemplate[dow]=select.value;
      draftDirty=true;
      renderDistribution(model);
    });
  });
}
function todayOverride(model){
  return (model.strategy.trainingNutrition.trainingDays??[]).find(row=>
    String(row.training_date??row.date??'')===model.asOfDate
  )??null;
}
function renderTodayOverride(model){
  const row=todayOverride(model);
  const plan=model.strategy.trainingNutrition.today;
  if($('todayTrainingOverrideType'))$('todayTrainingOverrideType').value=String(row?.day_type??row?.dayType??plan?.dayType??'rest');
  if($('todayTrainingOverrideStatus'))$('todayTrainingOverrideStatus').value=String(row?.status??'planned');
  if($('todayTrainingDuration'))$('todayTrainingDuration').value=row?.duration_minutes??row?.durationMinutes??'';
  if($('todayTrainingTitle'))$('todayTrainingTitle').value=row?.title??'';
  $('todayTrainingOverrideMeta').textContent=row?'Today overrides the weekly template':'Using weekly template';
  $('todayTrainingClear').hidden=!row;
}
function activityLabel(level){
  const map={building_baseline:'Building baseline',in_progress:'In progress',low:'Low vs baseline',typical:'Typical',high:'High vs baseline',very_high:'Very high'};
  return map[level]??cap(level);
}
function renderActivity(model){
  const a=model.strategy.trainingNutrition.activity;
  const today=a?.today;
  $('activitySteps').textContent=today?.steps==null?'—':fmt(today.steps);
  $('activityStepsBaseline').textContent=a?.baseline?.steps==null?'Baseline building':'Median '+fmt(a.baseline.steps);
  $('activityCalories').textContent=today?.activeCalories==null?'—':fmt(today.activeCalories)+' kcal';
  $('activityCaloriesBaseline').textContent=a?.baseline?.activeCalories==null?'Baseline building':'Median '+fmt(a.baseline.activeCalories)+' kcal';
  $('activityExercise').textContent=today?.exerciseMinutes==null?'—':fmt(today.exerciseMinutes)+' min';
  $('activityExerciseBaseline').textContent=a?.baseline?.exerciseMinutes==null?'Baseline building':'Median '+fmt(a.baseline.exerciseMinutes)+' min';
  $('activityRelativeLoad').textContent=a?.relativeLoad==null?'—':fmt(a.relativeLoad,2)+'×';
  $('activityLastSync').textContent=a?.lastSynced?'Synced '+new Date(a.lastSynced).toLocaleString():(a?.baselineDays?fmt(a.baselineDays)+' baseline days':'No synced activity yet');
  $('activityContextChip').textContent=activityLabel(a?.level??'building_baseline');
}
async function saveDistribution(){
  if(busy)return;
  const model=getDietV2Model();
  if(!model||!liveReady()){toast('A live signed-in connection is required.');return;}
  const d=currentDraft(model);
  if(d.hardExtraKcal<d.moderateExtraKcal||d.moderateExtraKcal<d.lightExtraKcal){
    toast('Use shifts where Hard ≥ Moderate ≥ Light.');return;
  }
  busy=true;
  try{
    await saveTrainingDistribution(getDietV2Client(),{
      enabled:d.enabled,
      weeklyTemplate:d.weeklyTemplate,
      hardExtraKcal:d.hardExtraKcal,
      moderateExtraKcal:d.moderateExtraKcal,
      lightExtraKcal:d.lightExtraKcal
    });
    draftDirty=false;
    await refresh({silent:true});
    toast('Training-day distribution saved.');
  }catch(error){toast(error?.message||'Training distribution could not be saved.');}
  finally{busy=false;}
}
async function saveToday(){
  if(busy)return;
  const model=getDietV2Model();
  if(!model||!liveReady()){toast('A live signed-in connection is required.');return;}
  const row=todayOverride(model);
  const duration=$('todayTrainingDuration')?.value??'';
  busy=true;
  try{
    await upsertTrainingDay(getDietV2Client(),{
      trainingDayId:row?.id??null,
      date:model.asOfDate,
      dayType:$('todayTrainingOverrideType').value,
      status:$('todayTrainingOverrideStatus').value,
      title:$('todayTrainingTitle').value.trim()||null,
      durationMinutes:duration===''?null:Number(duration),
      notes:null,
      expectedUpdatedAt:row?.updated_at??row?.updatedAt??null
    });
    await refresh({silent:true});
    toast('Today training context saved.');
  }catch(error){toast(error?.message||'Training day could not be saved.');}
  finally{busy=false;}
}
async function clearToday(){
  if(busy)return;
  const model=getDietV2Model();
  const row=model?todayOverride(model):null;
  if(!row||!liveReady())return;
  busy=true;
  try{
    await deleteTrainingDay(getDietV2Client(),{
      trainingDayId:row.id,
      expectedUpdatedAt:row.updated_at??row.updatedAt??null
    });
    await refresh({silent:true});
    toast('Today now follows the weekly template.');
  }catch(error){toast(error?.message||'Training override could not be removed.');}
  finally{busy=false;}
}
async function configureNativeSession(){
  const plugin=nativePlugin();
  if(!plugin)return null;
  const client=getDietV2Client();
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  const session=data?.session;
  if(!session)return null;
  await plugin.configureSession({
    supabaseUrl:DIET_V2_SUPABASE_URL,
    anonKey:DIET_V2_SUPABASE_KEY,
    accessToken:session.access_token,
    refreshToken:session.refresh_token,
    expiresAt:Number(session.expires_at||0)
  });
  return session;
}
async function renderNativeState(){
  const plugin=nativePlugin();
  const label=$('v2HealthConnectLabel');
  const connect=$('v2HealthConnectConnect');
  const sync=$('v2HealthConnectSync');
  if(!label||!connect||!sync)return;
  if(!plugin){
    label.textContent='Available in the Android app';
    connect.hidden=true;sync.hidden=true;
    return;
  }
  try{
    const session=await configureNativeSession();
    if(!session){label.textContent='Sign in to connect';connect.hidden=true;sync.hidden=true;return;}
    const state=await plugin.getState();
    if(state.healthConnectStatus==='update_required')label.textContent='Health Connect update required';
    else if(state.healthConnectStatus!=='available')label.textContent='Health Connect unavailable';
    else if(!state.permissionsGranted)label.textContent='Not connected';
    else if(state.backgroundReadSupported&&!state.backgroundReadGranted)label.textContent='Connected · foreground sync';
    else label.textContent='Connected'+(state.backgroundReadGranted?' · background sync':'');
    connect.hidden=state.healthConnectStatus!=='available'||Boolean(state.permissionsGranted);
    sync.hidden=!state.permissionsGranted;
  }catch(error){
    label.textContent=error?.message||'Health Connect unavailable';
    connect.hidden=true;sync.hidden=true;
  }
}
async function connectHealth(){
  const plugin=nativePlugin();
  if(!plugin||nativeBusy)return;
  nativeBusy=true;
  try{
    await configureNativeSession();
    await plugin.requestHealthPermissions();
    toast('Review Health Connect permissions, then return to Diet Copilot.');
  }catch(error){toast(error?.message||'Health Connect permission request failed.');}
  finally{nativeBusy=false;setTimeout(()=>renderNativeState(),400);}
}
async function syncHealth(){
  const plugin=nativePlugin();
  if(!plugin||nativeBusy)return;
  nativeBusy=true;
  const button=$('v2HealthConnectSync');
  const old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Syncing…';}
  try{
    await configureNativeSession();
    await plugin.syncDailyActivity({days:21});
    await refresh({silent:true});
    toast('Health Connect activity synced.');
  }catch(error){toast(error?.message||'Health Connect sync failed.');}
  finally{
    nativeBusy=false;
    if(button){button.disabled=false;button.textContent=old||'Sync activity';}
    renderNativeState();
  }
}
function render(){
  const model=getDietV2Model();
  if(!model)return;
  if(!draftDirty)draft=cloneSettings(model.strategy.trainingNutrition.settings);
  renderDistribution(model);
  renderTodayOverride(model);
  renderActivity(model);
  renderNativeState();
}

$('trainingDistributionEnabled')?.addEventListener('change',event=>{
  const model=getDietV2Model();if(!model)return;
  currentDraft(model).enabled=Boolean(event.currentTarget.checked);draftDirty=true;renderDistribution(model);
});
$('trainingHardShift')?.addEventListener('change',event=>{
  const model=getDietV2Model();if(!model)return;
  currentDraft(model).hardExtraKcal=Number(event.currentTarget.value);draftDirty=true;renderDistribution(model);
});
$('trainingModerateShift')?.addEventListener('change',event=>{
  const model=getDietV2Model();if(!model)return;
  currentDraft(model).moderateExtraKcal=Number(event.currentTarget.value);draftDirty=true;renderDistribution(model);
});
$('trainingLightShift')?.addEventListener('change',event=>{
  const model=getDietV2Model();if(!model)return;
  currentDraft(model).lightExtraKcal=Number(event.currentTarget.value);draftDirty=true;renderDistribution(model);
});
$('trainingSaveDistribution')?.addEventListener('click',saveDistribution);
$('todayTrainingSave')?.addEventListener('click',saveToday);
$('todayTrainingClear')?.addEventListener('click',clearToday);
$('v2HealthConnectConnect')?.addEventListener('click',connectHealth);
$('v2HealthConnectSync')?.addEventListener('click',syncHealth);
$('moreIntegrationsButton')?.addEventListener('click',()=>{
  location.hash='#strategy';
  setTimeout(()=>$('strategyActivityPanel')?.scrollIntoView({behavior:'smooth',block:'center'}),120);
});
window.addEventListener('diet-v2-data-updated',render);
window.addEventListener('focus',()=>renderNativeState());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')renderNativeState();});
render();
