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
return s.signedIn&&s.source==='cloud'&&navigator.onLine!==false&&!s.writeBlocked;
}
function toast(message){window.DietV2Shell?.showToast?.(message);}
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
accepted:'Applied',
dismissed:'Kept current',
insufficient:'Not enough data',
advisory:'Review ready',
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
const el=$(id);if(el)el.disabled=next;
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
spanDays:s.weightSpanDays,
components:s.confidenceComponents??{}
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
appliedStep:s.appliedStep,
weeklyReview:s.weeklyReview??null
};
}
async function stageCurrentSnapshot(model=getDietV2Model()){
const s=model?.strategy;
if(!s||!signedLive())throw new Error('A live signed-in connection is required.');
if(s.currentTarget==null)throw new Error('Finish goal setup before reviewing your strategy.');
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
}
async function ensureCurrentReview(){
let model=getDietV2Model();
if(sameOpenReview(model))return {model,review:model.strategy.openReview};
await stageCurrentSnapshot(model);
await refresh({silent:true});
model=getDietV2Model();
if(!sameOpenReview(model))throw new Error('The evidence changed while preparing this review. Refresh and check the recommendation again.');
return {model,review:model.strategy.openReview};
}
async function refreshEvidence(){
if(busy)return;
if(!signedLive()){toast('A live signed-in connection is required.');return;}
setBusy(true);
try{
await stageCurrentSnapshot();
await refresh({silent:true});
toast('Weekly review evidence refreshed.');
}catch(error){
toast(error?.message||'The weekly review could not be refreshed.');
}finally{setBusy(false);}
}
function matchesExpectedStrategy(model,expected){
if(!expected)return true;
const s=model?.strategy;
if(!s)return false;
if(expected.asOfDate&&String(expected.asOfDate)!==String(model.asOfDate))return false;
if(expected.engineVersion&&String(expected.engineVersion)!==String(s.engineVersion))return false;
if(expected.decision&&String(expected.decision)!==String(s.decision))return false;
for(const key of ['currentTarget','recommendedTarget']){
if(expected[key]==null)continue;
if(s[key]==null||Math.abs(Number(expected[key])-Number(s[key]))>1)return false;
}
return true;
}
async function executeStrategyDecision(resolution,{effectiveDateChoice=null,expected=null,confirmed=false}={}){
if(busy)throw new Error('A strategy decision is already being processed.');
if(!signedLive())throw new Error('A live signed-in connection is required.');
const initial=getDietV2Model();
const initialStrategy=initial?.strategy;
if(!initialStrategy?.currentTarget)throw new Error('Finish goal setup before reviewing your strategy.');
if(!matchesExpectedStrategy(initial,expected))throw new Error('That strategy proposal is stale. Review the latest recommendation before confirming.');
if(resolution==='accept'&&!actionReady(initialStrategy)){
throw new Error('The current evidence does not support a target change. Keep the current target for this review.');
}
setBusy(true);
try{
const {model,review}=await ensureCurrentReview();
const s=model.strategy;
if(!matchesExpectedStrategy(model,expected))throw new Error('The evidence changed while preparing the decision. Review the latest recommendation first.');
if(resolution==='accept'){
if(!actionReady(s))throw new Error('The evidence changed and no longer supports applying a target change.');
const delta=Math.abs(Number(review.recommendedTarget)-Number(review.currentTarget));
if(!confirmed&&(s.decision==='transition_maintenance'||delta>=300)){
if(!confirm('Apply this strategy change to your active plan? Historical targets will be preserved.'))return {cancelled:true};
}
}
const choice=effectiveDateChoice??$('strategyEffectiveDate')?.value??'today';
const effectiveDate=resolution==='accept'
?(choice==='tomorrow'?tomorrowKey():localDateKey())
:localDateKey();
await resolveStrategyReview(getDietV2Client(),{
recommendationId:review.id,
resolution,
effectiveDate
});
await refresh({silent:true});
return {
ok:true,
resolution,
effectiveDate,
previousTarget:Number(review.currentTarget),
resolvedTarget:resolution==='accept'?Number(review.recommendedTarget):Number(review.currentTarget)
};
}finally{setBusy(false);}
}
async function resolveDecision(resolution){
try{
const result=await executeStrategyDecision(resolution);
if(result?.cancelled)return;
toast(resolution==='accept'?'Strategy change applied.':'Weekly review complete — current target kept.');
}catch(error){
toast(error?.message||'The weekly review could not be completed.');
}
}
async function revertReview(id){
if(busy||!signedLive())return;
if(!confirm('Restore the target that was active before this applied review? A new target period will be created; history will not be erased.'))return;
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
function readinessMarkup(item){
const value=item.key==='confidence'?fmt(item.value)+'%':fmt(item.value,1);
const target=item.key==='confidence'?fmt(item.target)+'%':fmt(item.target,0);
return '<div class="dc-readiness-item" data-state="'+esc(item.state)+'">'+
'<span>'+esc(item.label)+'</span>'+
'<strong>'+esc(value)+'</strong>'+
'<small>target '+esc(target)+(item.key==='confidence'?'':' '+esc(item.unit))+'</small>'+
'</div>';
}
function missingMarkup(items=[]){
if(!items.length)return '<span class="dc-missing-good">Enough evidence for the current review. Keep logging normally.</span>';
return items.map(item=>'<span>• '+esc(item)+'</span>').join('');
}
function render(){
const model=getDietV2Model();
if(!model)return;
const s=model.strategy;
const w=s.weeklyReview??{};
const current=Number(s.currentTarget);
const recommended=s.recommendedTarget==null?null:Number(s.recommendedTarget);
const delta=(Number.isFinite(current)&&Number.isFinite(recommended))?recommended-current:null;
$('strategyDecisionTitle').textContent=w.recommendation?.headline??decisionLabel(s.decision);
$('strategyDecisionReason').textContent=s.reason;
$('strategyDecisionChip').textContent=String(s.confidenceLevel??'building baseline').replaceAll('_',' ');
$('strategyReviewCadence').textContent=w.cadence?.label??'Review available';
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
const confidencePercent=Math.max(0,Math.min(100,Number(w.confidence?.score??0)));
$('strategyConfidencePercent').textContent=fmt(confidencePercent)+'%';
$('strategyConfidenceBar').style.width=confidencePercent+'%';
$('strategyConfidenceMessage').textContent=w.confidence?.message??'Evidence is still building.';
$('strategyWhyHeadline').textContent=w.recommendation?.headline??decisionLabel(s.decision);
$('strategyWhyText').textContent=w.recommendation?.explanation??s.reason;
$('strategyMissingEvidence').innerHTML=missingMarkup(w.missingEvidence??[]);
$('strategyReadiness').innerHTML=(w.evidence?.items??[]).map(readinessMarkup).join('');
const state=$('strategyReviewState');
const stage=$('strategyStageReview');
const keep=$('strategyKeepCurrent');
const accept=$('strategyAccept');
const dateWrap=$('strategyEffectiveDateWrap');
const match=sameOpenReview(model);
const canApply=actionReady(s);
stage.hidden=!s.openReview||match;
stage.textContent='Refresh evidence';
keep.hidden=s.currentTarget==null;
accept.hidden=!canApply;
dateWrap.hidden=!canApply;
keep.textContent='Keep current';
accept.textContent=s.decision==='transition_maintenance'
?'Apply maintenance'
:s.recommendedTarget==null?'Apply change':'Apply '+fmt(s.recommendedTarget)+' kcal';
state.hidden=false;
if(s.openReview&&match){
state.textContent=s.openReview.status==='pending'
?'A matching evidence snapshot is ready. Your plan changes only if you choose Apply.'
:'A matching weekly review snapshot is ready. Keeping the current target records the decision without changing your plan.';
}else if(s.openReview&&!match){
state.textContent='The saved review snapshot is older than the evidence shown above. Choosing Keep or Apply will refresh it first.';
}else if(w.cadence?.due){
state.textContent='Weekly review is due. Check the evidence above, then choose Keep current or Apply.';
}else{
state.textContent='You already completed a recent review. You can review again if your data or goal changed.';
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
$('strategyStageReview')?.addEventListener('click',refreshEvidence);
$('strategyKeepCurrent')?.addEventListener('click',()=>resolveDecision('keep_current'));
$('strategyAccept')?.addEventListener('click',()=>resolveDecision('accept'));
window.addEventListener('diet-v2-data-updated',render);
window.addEventListener('hashchange',()=>{if(location.hash==='#strategy')render();});
window.DietV2StrategyReview=Object.freeze({
version:'1.0.0-p32',
actionReady:()=>actionReady(getDietV2Model()?.strategy),
execute:executeStrategyDecision,
current:()=>{
const model=getDietV2Model();
const s=model?.strategy;
return s?{
asOfDate:model.asOfDate,
engineVersion:s.engineVersion,
decision:s.decision,
currentTarget:s.currentTarget,
recommendedTarget:s.recommendedTarget
}:null;
}
});
render();
