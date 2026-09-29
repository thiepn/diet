import { getDietV2Client, getDietV2Model, getDietV2State, refresh } from './data.js';
import { stageStrategyReview, resolveStrategyReview, revertStrategyReview } from './write-api.mjs';
import { localDateKey } from './read-model.mjs';

let busy=false;

function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function fmt(value,digits=0){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
}
function signedLive(){
  const s=getDietV2State();
  return s.signedIn&&s.source==='cloud'&&navigator.onLine!==false;
}
function toast(message){
  const el=document.querySelector('[data-toast]');
  if(!el)return;
  el.textContent=message;
  el.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.remove('is-visible'),2800);
}
function tomorrowKey(){
  const d=new Date();
  d.setDate(d.getDate()+1);
  return localDateKey(d);
}
function decisionLabel(decision){
  const map={
    need_more_data:'Need more data',
    hold_for_confidence:'Hold for confidence',
    keep_target:'Keep current target',
    increase:'Increase calorie target',
    decrease:'Decrease calorie target',
    set_initial_target:'Set initial target',
    prepare_maintenance:'Prepare for maintenance',
    transition_maintenance:'Transition to maintenance'
  };
  return map[decision]??String(decision??'Review').replaceAll('_',' ');
}
function statusLabel(status){
  const map={
    pending:'Awaiting decision',
    accepted:'Accepted',
    dismissed:'Kept current',
    insufficient:'Not enough data',
    advisory:'Review recorded',
    superseded:'Superseded',
    reverted:'Reverted'
  };
  return map[status]??String(status??'');
}
function actionReady(strategy){
  return ['increase','decrease','set_initial_target','transition_maintenance'].includes(strategy?.decision)
    && strategy?.recommendedTarget!=null
    && strategy?.currentTarget!=null
    && Math.abs(Number(strategy.recommendedTarget)-Number(strategy.currentTarget))>1;
}
function sameOpenReview(model){
  const s=model?.strategy;
  const r=s?.openReview;
  if(!s||!r)return false;
  return r.engineVersion===s.engineVersion
    && r.generatedOn===model.asOfDate
    && Math.abs(Number(r.currentTarget)-Number(s.currentTarget))<=1
    && ((r.recommendedTarget==null&&s.recommendedTarget==null)
      || Math.abs(Number(r.recommendedTarget)-Number(s.recommendedTarget))<=1)
    && r.decision===s.decision;
}
function setBusy(next){
  busy=next;
  ['strategyStageReview','strategyKeepCurrent','strategyAccept'].forEach(id=>{
    const el=$(id); if(el)el.disabled=next;
  });
  document.querySelectorAll('[data-revert-strategy]').forEach(el=>el.disabled=next);
}
function reviewPayload(model){
  const s=model.strategy;
  return {
    decision:s.decision,
    reason:s.reason,
    confidence:{
      level:s.confidenceLevel,
      score:s.confidenceScore,
      uncertaintyKcal:s.uncertaintyKcal,
      reliableIntakeDays:s.reliableIntakeDays,
      weighIns:s.weighIns,
      spanDays:s.weightSpanDays
    },
    evidence:{
      loggedDays:Math.ceil(Number(s.reliableIntakeDays)||0),
      weeklyWeightRate:s.observedWeeklyRate,
      averageCalories:s.averageIntake,
      expenditure:s.estimatedExpenditure,
      expenditureRangeLow:s.expenditureRangeLow,
      expenditureRangeHigh:s.expenditureRangeHigh
    },
    goal:{
      mode:s.goalMode,
      goalWeight:s.goalWeight,
      targetRateKgPerWeek:s.targetRateKgPerWeek,
      remainingKg:s.remainingKg
    },
    macros:s.macros,
    rawTarget:s.rawTarget,
    appliedStep:s.appliedStep
  };
}
async function stageReview(){
  if(busy)return;
  const model=getDietV2Model();
  const s=model?.strategy;
  if(!s||!signedLive()){toast('A live signed-in connection is required.');return;}
  if(s.currentTarget==null){toast('A current calorie target is required before a strategy review.');return;}
  setBusy(true);
  try{
    await stageStrategyReview(getDietV2Client(),{
      engineVersion:s.engineVersion,
      generatedOn:model.asOfDate,
      lookbackDays:28,
      decision:s.decision,
      currentTarget:s.currentTarget,
      recommendedTarget:s.recommendedTarget,
      rawTarget:s.rawTarget,
      estimatedExpenditure:s.estimatedExpenditure,
      confidenceLevel:s.confidenceLevel,
      confidenceScore:s.confidenceScore,
      reason:s.reason,
      recommendedProtein:s.macros?.protein??null,
      recommendedFat:s.macros?.fat??null,
      recommendedCarbs:s.macros?.carbs??null,
      payload:reviewPayload(model)
    });
    await refresh({silent:true});
    toast(actionReady(s)?'Recommendation ready for your decision.':'Strategy review recorded.');
  }catch(error){
    toast(error?.message||'Strategy review could not be created.');
  }finally{setBusy(false);}
}
async function resolveReview(resolution){
  if(busy)return;
  const model=getDietV2Model();
  const review=model?.strategy?.openReview;
  if(!review||!sameOpenReview(model)){toast('Refresh the recommendation before resolving it.');return;}
  if(!signedLive()){toast('A live signed-in connection is required.');return;}

  const s=model.strategy;
  if(resolution==='accept'){
    const delta=Math.abs(Number(review.recommendedTarget)-Number(review.currentTarget));
    if(s.decision==='transition_maintenance'||delta>=300){
      if(!confirm('Apply this strategy change to your active plan? Historical targets will be preserved.'))return;
    }
  }

  const applyChoice=$('strategyEffectiveDate')?.value??'today';
  const effectiveDate=applyChoice==='tomorrow'?tomorrowKey():localDateKey();
  setBusy(true);
  try{
    await resolveStrategyReview(getDietV2Client(),{
      recommendationId:review.id,
      resolution,
      effectiveDate
    });
    await refresh({silent:true});
    toast(resolution==='accept'?'New strategy target applied.':'Current target kept.');
  }catch(error){
    toast(error?.message||'Strategy review could not be resolved.');
  }finally{setBusy(false);}
}
async function revertReview(id){
  if(busy||!signedLive())return;
  if(!confirm('Restore the target that was active before this accepted review? A new target period will be created; history will not be erased.'))return;
  setBusy(true);
  try{
    await revertStrategyReview(getDietV2Client(),{recommendationId:id});
    await refresh({silent:true});
    toast('Previous strategy target restored.');
  }catch(error){
    toast(error?.message||'This strategy change cannot be reverted.');
  }finally{setBusy(false);}
}
function historyRow(review,latestAcceptedId){
  const delta=(review.recommendedTarget==null||review.currentTarget==null)?null:Number(review.recommendedTarget)-Number(review.currentTarget);
  const targetText=review.recommendedTarget==null
    ?fmt(review.currentTarget)+' kcal'
    :fmt(review.currentTarget)+' → '+fmt(review.recommendedTarget)+' kcal';
  const when=review.generatedOn||String(review.createdAt??'').slice(0,10);
  const canRevert=review.status==='accepted'&&review.id===latestAcceptedId;
  return '<article class="dc-strategy-history-row">'+
    '<div class="dc-strategy-history-main">'+
      '<div><strong>'+esc(decisionLabel(review.decision))+'</strong><span>'+esc(when)+'</span></div>'+
      '<p>'+esc(review.rationale)+'</p>'+
      '<small>'+esc(targetText)+(delta?(' · '+(delta>0?'+':'')+fmt(delta)+' kcal'):'')+
        (review.engineVersion?' · '+esc(review.engineVersion):'')+'</small>'+
    '</div>'+
    '<div class="dc-strategy-history-side"><span class="dc-review-status" data-status="'+esc(review.status)+'">'+esc(statusLabel(review.status))+'</span>'+
      (canRevert?'<button class="dc-secondary-action dc-compact-action" type="button" data-revert-strategy="'+esc(review.id)+'">Revert</button>':'')+
    '</div>'+
  '</article>';
}
function render(){
  const model=getDietV2Model();
  if(!model)return;
  const s=model.strategy;
  const current=Number(s.currentTarget);
  const recommended=s.recommendedTarget==null?null:Number(s.recommendedTarget);
  const delta=(Number.isFinite(current)&&Number.isFinite(recommended))?recommended-current:null;

  $('strategyDecisionTitle').textContent=decisionLabel(s.decision);
  $('strategyDecisionReason').textContent=s.reason;
  $('strategyDecisionChip').textContent=String(s.confidenceLevel??'building baseline').replaceAll('_',' ');
  $('strategyReviewCurrent').textContent=s.currentTarget==null?'—':fmt(s.currentTarget)+' kcal';
  $('strategyRecommendedTarget').textContent=s.recommendedTarget==null?'—':fmt(s.recommendedTarget)+' kcal';
  $('strategyTargetDelta').textContent=delta&&Math.abs(delta)>=1?(delta>0?'+':'')+fmt(delta)+' kcal change':'No calorie change';
  $('strategyEvidenceTdee').textContent=s.estimatedExpenditure==null?'—':fmt(s.estimatedExpenditure)+' kcal/day';
  $('strategyEvidenceRange').textContent=(s.expenditureRangeLow!=null&&s.expenditureRangeHigh!=null)
    ?fmt(s.expenditureRangeLow)+'–'+fmt(s.expenditureRangeHigh)+' likely range':'Range building';
  $('strategyObservedRate').textContent=s.observedWeeklyRate==null?'—':(s.observedWeeklyRate>0?'+':'')+fmt(s.observedWeeklyRate,2)+' kg/wk';
  $('strategyTargetRateEvidence').textContent=s.targetRateKgPerWeek==null?'No target pace':(s.targetRateKgPerWeek>0?'+':'')+fmt(s.targetRateKgPerWeek,2)+' kg/wk planned';
  $('strategyReliableDays').textContent=fmt(s.reliableIntakeDays,1)+' effective days';
  $('strategyWeighIns').textContent=fmt(s.weighIns)+' weigh-ins · '+fmt(s.weightSpanDays)+' day span';
  $('strategyEngineVersion').textContent=s.engineVersion||'—';
  $('strategyConfidenceScore').textContent='Confidence '+Math.round((Number(s.confidenceScore)||0)*100)+'%';
  $('strategyMacroProtein').textContent=s.macros?.protein==null?'—':fmt(s.macros.protein)+' g';
  $('strategyMacroFat').textContent=s.macros?.fat==null?'—':fmt(s.macros.fat)+' g';
  $('strategyMacroCarbs').textContent=s.macros?.carbs==null?'—':fmt(s.macros.carbs)+' g';

  const state=$('strategyReviewState');
  const stage=$('strategyStageReview');
  const keep=$('strategyKeepCurrent');
  const accept=$('strategyAccept');
  const dateWrap=$('strategyEffectiveDateWrap');
  const match=sameOpenReview(model);

  stage.hidden=match;
  stage.textContent=s.openReview?'Refresh review':'Review recommendation';
  keep.hidden=true;
  accept.hidden=true;
  dateWrap.hidden=true;
  state.hidden=true;
  state.textContent='';

  if(s.openReview&&match){
    state.hidden=false;
    if(s.openReview.status==='pending'){
      state.textContent='This recommendation is staged and waiting for your decision. Nothing changes until you accept it.';
      keep.hidden=false;
      accept.hidden=false;
      dateWrap.hidden=false;
      accept.textContent=s.decision==='transition_maintenance'?'Accept maintenance target':'Accept target';
    }else{
      state.textContent='The review supports keeping the current target. Recording that choice leaves the plan unchanged.';
      keep.hidden=false;
      keep.textContent='Keep current';
    }
  }else if(s.openReview&&!match){
    state.hidden=false;
    state.textContent='The saved review no longer matches the current engine output. Refresh it before deciding.';
  }

  const history=s.reviewHistory??[];
  $('strategyHistoryCount').textContent=history.length?history.length+' review'+(history.length===1?'':'s'):'No reviews yet';
  const latestAccepted=history.find(r=>r.status==='accepted');
  $('strategyHistory').innerHTML=history.length
    ?history.slice(0,10).map(r=>historyRow(r,latestAccepted?.id??null)).join('')
    :'<div class="dc-food-empty">Completed reviews will appear here without rewriting past targets.</div>';
  document.querySelectorAll('[data-revert-strategy]').forEach(button=>{
    button.addEventListener('click',()=>revertReview(button.dataset.revertStrategy));
  });
}

$('strategyStageReview')?.addEventListener('click',stageReview);
$('strategyKeepCurrent')?.addEventListener('click',()=>resolveReview('keep_current'));
$('strategyAccept')?.addEventListener('click',()=>resolveReview('accept'));
window.addEventListener('diet-v2-data-updated',render);
window.addEventListener('hashchange',()=>{if(location.hash==='#strategy')render();});
render();
