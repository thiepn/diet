import { getDietV2Client, getDietV2Model, getDietV2State, refresh } from './data.js';
import { completeOnboarding } from './write-api.mjs';
import { localDateKey } from './read-model.mjs';
import {
  defaultGoalRate, deriveStartingTargets, validateOnboarding, goalModeCopy
} from './p30-onboarding.mjs';

const SESSION_DISMISS_KEY='diet-copilot-p30-onboarding-dismissed-v1';
let step=1;
let goalMode='maintain';
let busy=false;
let autoOpened=false;

function $(id){return document.getElementById(id);}
function n(id){const v=$(id)?.value??'';return v===''?null:Number(v);}
function set(id,value=''){const el=$(id);if(el)el.value=value??'';}
function model(){return getDietV2Model();}
function state(){return getDietV2State();}
function toast(message){window.DietV2Shell?.showToast?.(message);}
function dismissed(){
  try{return sessionStorage.getItem(SESSION_DISMISS_KEY)==='1';}catch{return false;}
}
function markDismissed(){
  try{sessionStorage.setItem(SESSION_DISMISS_KEY,'1');}catch{}
}
function clearDismissed(){
  try{sessionStorage.removeItem(SESSION_DISMISS_KEY);}catch{}
}
function readyForWrite(){
  const s=state();
  return s.signedIn&&s.source==='cloud'&&navigator.onLine!==false&&!s.writeBlocked;
}
function setStatus(message,{error=false}={}){
  const el=$('onboardingStatus');
  if(!el)return;
  el.hidden=!message;
  el.dataset.kind=error?'error':'info';
  el.textContent=message||'';
}
function currentValues(){
  const weight=n('onboardingWeight');
  return {
    currentWeight:weight,
    goalMode,
    goalWeight:goalMode==='maintain'?weight:n('onboardingGoalWeight'),
    desiredRate:goalMode==='maintain'?0:n('onboardingRate'),
    calorieTarget:n('onboardingCalories'),
    proteinTarget:n('onboardingProtein'),
    fiberTarget:n('onboardingFiber')
  };
}
function setGoalMode(next,{resetRate=true}={}){
  if(!['lose','maintain','gain'].includes(next))next='maintain';
  goalMode=next;
  document.querySelectorAll('[data-onboarding-goal]').forEach(button=>{
    const active=button.dataset.onboardingGoal===goalMode;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
  const weight=n('onboardingWeight');
  const goal=$('onboardingGoalWeight');
  const rate=$('onboardingRate');
  if(goalMode==='maintain'){
    if(goal&&Number.isFinite(weight))goal.value=String(weight);
    if(goal)goal.disabled=true;
    if(rate){rate.value='0';rate.disabled=true;}
  }else{
    if(goal)goal.disabled=false;
    if(rate){
      rate.disabled=false;
      if(resetRate||!Number.isFinite(Number(rate.value)))rate.value=String(defaultGoalRate(goalMode,weight));
    }
    if(goal&&Number(goal.value)===weight)goal.value='';
  }
  const copy=goalModeCopy(goalMode);
  const hint=$('onboardingGoalHint');
  if(hint)hint.textContent=goalMode==='maintain'
    ?'Maintenance keeps your first phase neutral. Goal weight is set to your current weight.'
    :`Choose a realistic goal. The default pace is intentionally moderate; you can edit it.`;
  document.querySelectorAll('[data-onboarding-goal]').forEach(b=>b.title=b.dataset.onboardingGoal===goalMode?copy.label:'');
}
function seedTargets({force=false}={}){
  const values=currentValues();
  if(!Number.isFinite(values.currentWeight))return;
  const targets=deriveStartingTargets({
    currentWeight:values.currentWeight,
    goalMode,
    desiredRate:values.desiredRate
  });
  if(force||!$('onboardingCalories').value)set('onboardingCalories',targets.calories);
  if(force||!$('onboardingProtein').value)set('onboardingProtein',targets.protein);
  if(force||!$('onboardingFiber').value)set('onboardingFiber',targets.fiber);
}
function renderStep(){
  document.querySelectorAll('[data-onboarding-step]').forEach(section=>{
    section.hidden=Number(section.dataset.onboardingStep)!==step;
  });
  document.querySelectorAll('[data-onboarding-dot]').forEach(dot=>{
    const n=Number(dot.dataset.onboardingDot);
    dot.classList.toggle('is-active',n===step);
    dot.classList.toggle('is-complete',n<step);
  });
  $('onboardingBack').hidden=step===1;
  $('onboardingNext').hidden=step===3;
  $('onboardingSave').hidden=step!==3;
  setStatus('');
  requestAnimationFrame(()=>{
    if(step===1)$('onboardingWeight')?.focus();
    if(step===2)document.querySelector('[data-onboarding-goal].is-selected')?.focus();
    if(step===3)$('onboardingCalories')?.focus();
  });
}
function validateStep(which){
  const values=currentValues();
  if(which===1){
    if(!Number.isFinite(values.currentWeight)||values.currentWeight<25||values.currentWeight>400){
      setStatus('Enter your current weight between 25 and 400 kg.',{error:true});return false;
    }
    return true;
  }
  if(which===2){
    const result=validateOnboarding({
      ...values,
      calorieTarget:values.calorieTarget??2000,
      proteinTarget:values.proteinTarget??100,
      fiberTarget:values.fiberTarget??30
    });
    for(const key of ['goalMode','goalWeight','desiredRate']){
      if(result.errors[key]){setStatus(result.errors[key],{error:true});return false;}
    }
    return true;
  }
  const result=validateOnboarding(values);
  if(!result.valid){
    setStatus(Object.values(result.errors)[0]||'Check the setup values.',{error:true});return false;
  }
  return true;
}
function next(){
  if(!validateStep(step))return;
  if(step===1){
    setGoalMode(goalMode,{resetRate:true});
    seedTargets({force:true});
  }
  if(step===2)seedTargets({force:true});
  step=Math.min(3,step+1);
  renderStep();
}
function back(){
  step=Math.max(1,step-1);
  renderStep();
}
function prefill(){
  const o=model()?.onboarding??{};
  step=1;
  set('onboardingWeight',o.currentWeight??'');
  goalMode=o.goalMode??'maintain';
  set('onboardingGoalWeight',o.goalWeight??'');
  set('onboardingRate',o.desiredRate??'');
  set('onboardingCalories',o.calorieTarget??'');
  set('onboardingProtein',o.proteinTarget??'');
  set('onboardingFiber',o.fiberTarget??30);
  setGoalMode(goalMode,{resetRate:o.desiredRate==null});
  if(!o.complete&&o.currentWeight&&(!o.calorieTarget||!o.proteinTarget))seedTargets({force:true});
  renderStep();
}
function open({automatic=false}={}){
  if(!state().signedIn){toast('Sign in before setting up your plan.');return;}
  prefill();
  const dialog=$('onboardingDialog');
  if(dialog&&!dialog.open)dialog.showModal();
  if(automatic)autoOpened=true;
}
function close({dismiss=false}={}){
  const dialog=$('onboardingDialog');
  if(dialog?.open)dialog.close();
  if(dismiss)markDismissed();
}
function setBusy(next){
  busy=next;
  $('onboardingSave').disabled=next;
  $('onboardingNext').disabled=next;
  $('onboardingBack').disabled=next;
  document.querySelectorAll('[data-onboarding-goal]').forEach(b=>b.disabled=next);
  if(next){$('onboardingSave').dataset.label=$('onboardingSave').textContent;$('onboardingSave').textContent='Starting…';}
  else if($('onboardingSave').dataset.label){$('onboardingSave').textContent=$('onboardingSave').dataset.label;delete $('onboardingSave').dataset.label;}
}
async function submit(event){
  event.preventDefault();
  if(busy||!validateStep(3))return;
  if(!readyForWrite()){
    setStatus(navigator.onLine===false?'Connect to the internet to start your plan.':'Refresh your signed-in account before saving.',{error:true});
    return;
  }
  const values=currentValues();
  setBusy(true);setStatus('Saving your starting plan…');
  try{
    await completeOnboarding(getDietV2Client(),{
      startDate:localDateKey(),
      currentWeight:values.currentWeight,
      goalMode:values.goalMode,
      goalWeight:values.goalWeight,
      desiredRate:values.desiredRate,
      calorieTarget:values.calorieTarget,
      proteinTarget:values.proteinTarget,
      fiberTarget:values.fiberTarget
    });
    clearDismissed();
    await refresh({silent:true});
    setStatus('');
    close();
    toast('Starting plan saved. Diet Copilot can begin learning from your data.');
    render();
  }catch(error){
    setStatus(error?.message||'Your starting plan could not be saved.',{error:true});
  }finally{setBusy(false);}
}
function render(){
  const o=model()?.onboarding??null;
  const banner=$('onboardingBanner');
  const detail=$('onboardingBannerDetail');
  if(!banner)return;
  const signed=state().signedIn;
  const incomplete=Boolean(signed&&o&&!o.complete);
  banner.hidden=!incomplete;
  if(detail&&incomplete){
    const missing=o.missing??[];
    detail.textContent=missing.includes('weight')
      ?'Add your current weight, goal and starting targets so the adaptive model has a real baseline.'
      :'Finish the missing goal-phase setup so today’s targets and progress have a consistent starting point.';
  }
  if(o?.complete&&$('onboardingDialog')?.open)close();
  if(incomplete&&state().source==='cloud'&&!dismissed()&&!autoOpened){
    setTimeout(()=>{if(model()?.onboarding?.complete===false&&!dismissed())open({automatic:true});},250);
  }
}

$('onboardingOpen')?.addEventListener('click',()=>open());
$('onboardingEditPlan')?.addEventListener('click',()=>open());
$('onboardingClose')?.addEventListener('click',()=>close({dismiss:true}));
$('onboardingLater')?.addEventListener('click',()=>close({dismiss:true}));
$('onboardingNext')?.addEventListener('click',next);
$('onboardingBack')?.addEventListener('click',back);
$('onboardingForm')?.addEventListener('submit',submit);
document.querySelectorAll('[data-onboarding-goal]').forEach(button=>button.addEventListener('click',()=>{
  setGoalMode(button.dataset.onboardingGoal,{resetRate:true});
  seedTargets({force:true});
}));
$('onboardingWeight')?.addEventListener('change',()=>{
  setGoalMode(goalMode,{resetRate:true});
  seedTargets({force:true});
});
$('onboardingRate')?.addEventListener('change',()=>seedTargets({force:true}));
$('onboardingDialog')?.addEventListener('click',event=>{
  if(event.target===$('onboardingDialog'))close({dismiss:true});
});

window.addEventListener('diet-v2-data-updated',render);
window.addEventListener('online',render);
window.addEventListener('offline',render);
render();

window.DietV2Onboarding=Object.freeze({
  version:'1.0.0-p30',
  open,
  status:()=>model()?.onboarding??null
});
