import { getDietV2Client,getDietV2Model,getDietV2State,refresh } from './data.js';
import { logSavedFood,logSavedMeal,repeatMeal } from './write-api.mjs';
import { localDateKey } from './read-model.mjs';
import {
buildCopilotContext,buildLocalCopilotReply,sanitizeCopilotResponse,validateCopilotProposal,DietCopilotP32
} from './engine/copilot-context.mjs';
import { buildActionPreview, confirmationLabel } from './p32-copilot-actions.mjs';
const HISTORY_KEY='diet-copilot-v2-p8-session-v1';
const MAX_HISTORY=12;
let busy=false;
let thread=loadHistory();
function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function id(){return globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+Math.random().toString(36).slice(2);}
function toast(message){window.DietV2Shell?.showToast?.(message);}
function model(){return getDietV2Model();}
function context(){const m=model();return m?buildCopilotContext(m):null;}
function loadHistory(){
try{
const parsed=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]');
if(!Array.isArray(parsed))return [];
return parsed.slice(-MAX_HISTORY).map(x=>({
id:id(),
role:x?.role==='assistant'?'assistant':'user',
content:String(x?.content??'').slice(0,2200),
basis:[],
caution:null,
action:null,
mode:'session'
})).filter(x=>x.content);
}catch{return []}
}
function persistHistory(){
try{
const safe=thread.slice(-MAX_HISTORY).map(x=>({role:x.role,content:x.content}));
sessionStorage.setItem(HISTORY_KEY,JSON.stringify(safe));
}catch{}
}
function setMode(label,state='ready'){
const el=$('copilotMode');
if(!el)return;
el.textContent=label;
el.dataset.state=state;
}
function setStatus(message,{error=false}={}){
const el=$('copilotStatus');
if(!el)return;
el.hidden=!message;
el.textContent=message||'';
el.dataset.error=error?'true':'false';
}
function welcomeMarkup(){
const c=context();
if(!c)return '<div class="dc-copilot-empty"><strong>Connecting your nutrition context…</strong><span>Copilot becomes available when Diet Copilot has loaded your account data.</span></div>';
const remaining=Number(c.today?.caloriesRemaining);
const hint=Number.isFinite(remaining)
?(remaining>=0?Math.round(remaining)+' kcal remain today.':'Today is '+Math.abs(Math.round(remaining))+' kcal over target.')
:'Ask about your current strategy, progress, or saved foods.';
return '<div class="dc-copilot-empty"><strong>What do you want to know?</strong><span>'+esc(hint)+' I use P1–P7 calculations instead of inventing new numbers.</span></div>';
}
function actionMarkup(message){
const a=message.action;
if(!a)return '';
const preview=buildActionPreview(a,context());
if(!preview)return '';
const changes=(preview.changes??[]).length
?'<div class="dc-copilot-action-changes">'+preview.changes.map(change=>
'<div><span>'+esc(change.label)+'</span>'+
(change.before!=null?'<small>'+esc(change.before)+'</small><b aria-hidden="true">→</b>':'')+
'<strong>'+esc(change.after??'—')+'</strong></div>'
).join('')+'</div>'
:'';
const consequence=preview.consequence?'<p class="dc-copilot-action-consequence">'+esc(preview.consequence)+'</p>':'';
const badge=preview.write?'<span class="dc-copilot-action-badge">Requires confirmation</span>':'<span class="dc-copilot-action-badge">Navigation only</span>';
const buttonClass=preview.write?'dc-primary-action':'dc-secondary-action';
return '<div class="dc-copilot-action" data-action-kind="'+esc(preview.kind)+'">'+
'<div class="dc-copilot-action-head"><div>'+badge+'<strong>'+esc(preview.title)+'</strong><p>'+esc(preview.summary)+'</p></div></div>'+
changes+consequence+
'<button class="'+buttonClass+' dc-copilot-confirm" type="button" data-copilot-confirm="'+esc(message.id)+'">'+esc(preview.write?confirmationLabel(a):(a.label||'Continue'))+'</button>'+
'</div>';
}
function messageMarkup(message){
if(message.role==='user'){
return '<article class="dc-copilot-message dc-copilot-message--user"><p>'+esc(message.content)+'</p></article>';
}
const basis=(message.basis??[]).length
?'<div class="dc-copilot-basis">'+message.basis.map(x=>'<span><small>'+esc(x.label)+'</small><strong>'+esc(x.value)+'</strong></span>').join('')+'</div>'
:'';
const caution=message.caution?'<p class="dc-copilot-caution">'+esc(message.caution)+'</p>':'';
const badge=message.mode&&message.mode!=='session'?'<span class="dc-copilot-source">'+esc(message.mode==='remote'?'AI explanation':'On-device')+'</span>':'';
return '<article class="dc-copilot-message dc-copilot-message--assistant">'+badge+'<p>'+esc(message.content)+'</p>'+basis+caution+actionMarkup(message)+'</article>';
}
function render(){
const host=$('copilotMessages');
if(!host)return;
host.innerHTML=thread.length?thread.map(messageMarkup).join(''):welcomeMarkup();
host.querySelectorAll('[data-copilot-confirm]').forEach(button=>button.addEventListener('click',()=>performAction(button.dataset.copilotConfirm,button)));
requestAnimationFrame(()=>{host.scrollTop=host.scrollHeight;});
}
function pushMessage(message){
thread.push({id:id(),basis:[],caution:null,action:null,mode:'local',...message});
if(thread.length>MAX_HISTORY)thread=thread.slice(-MAX_HISTORY);
persistHistory();
render();
return thread.at(-1);
}
function historyForRemote(){
return thread.slice(-8).filter(x=>x.content).map(x=>({role:x.role,content:String(x.content).slice(0,1200)}));
}
async function functionErrorCode(error){
try{
const response=error?.context;
if(response&&typeof response.clone==='function'){
const payload=await response.clone().json();
return payload?.error??null;
}
}catch{}
return null;
}
function fallbackReply(question,ctx,code){
const local=buildLocalCopilotReply(question,ctx);
if(local)return sanitizeCopilotResponse(local,ctx);
const unavailable=code==='ai_not_configured'
?'The remote AI explanation service is not configured yet.'
:'The remote AI explanation service is unavailable right now.';
return {
answer:unavailable+' I can still answer deterministic questions about calories remaining, protein, your current target, and P7 patterns on-device.',
basis:[],
caution:'No nutrition data was changed.',
action:null
};
}
async function ask(question){
const ctx=context();
if(!ctx){
setStatus('Nutrition context is still loading.',{error:true});
return;
}
const previous=historyForRemote();
pushMessage({role:'user',content:question,mode:'local'});
setStatus('');
const local=buildLocalCopilotReply(question,ctx);
if(local){
const safe=sanitizeCopilotResponse(local,ctx);
if(safe){
setMode('On-device','local');
pushMessage({role:'assistant',content:safe.answer,basis:safe.basis,caution:safe.caution,action:safe.action,mode:'local'});
return;
}
}
const state=getDietV2State();
if(!state.signedIn||state.source!=='cloud'||navigator.onLine===false){
const safe=fallbackReply(question,ctx,'offline');
setMode('Local only','local');
pushMessage({role:'assistant',content:safe.answer,basis:safe.basis,caution:safe.caution,action:safe.action,mode:'local'});
return;
}
busy=true;
const send=$('copilotSend');
if(send){send.disabled=true;send.textContent='Thinking…';}
setMode('Thinking…','busy');
try{
const client=getDietV2Client();
const {data,error}=await client.functions.invoke('diet-copilot-ai',{
body:{question,context:ctx,history:previous}
});
if(error){
const code=await functionErrorCode(error);
const safe=fallbackReply(question,ctx,code);
setMode(code==='ai_not_configured'?'Local only':'AI unavailable','local');
pushMessage({role:'assistant',content:safe.answer,basis:safe.basis,caution:safe.caution,action:safe.action,mode:'local'});
return;
}
const safe=sanitizeCopilotResponse(data?.reply,ctx);
if(!safe)throw new Error('Copilot returned an invalid response.');
setMode('AI','remote');
pushMessage({role:'assistant',content:safe.answer,basis:safe.basis,caution:safe.caution,action:safe.action,mode:'remote'});
}catch(error){
const safe=fallbackReply(question,ctx,'provider_unavailable');
setMode('AI unavailable','local');
pushMessage({role:'assistant',content:safe.answer,basis:safe.basis,caution:safe.caution,action:safe.action,mode:'local'});
}finally{
busy=false;
if(send){send.disabled=false;send.textContent='Send';}
}
}
async function performAction(messageId,button){
const message=thread.find(x=>x.id===messageId);
const ctx=context();
if(!message||!ctx)return;
const action=validateCopilotProposal(message.action,ctx);
if(!action){
setStatus('That proposal is stale. Ask Copilot again using the latest data.',{error:true});
return;
}
if(action.type==='navigate_food'){
close();
location.hash='#food';
requestAnimationFrame(()=>{
const input=$('foodSearchInput');
if(input){
input.value=action.query||'';
input.dispatchEvent(new Event('input',{bubbles:true}));
input.focus();
}
});
return;
}
if(action.type==='navigate_strategy'){
close();
location.hash='#strategy';
return;
}
if(action.type==='edit_goal'){
close();
window.DietV2Onboarding?.open?.();
return;
}
const state=getDietV2State();
if(!state.signedIn||state.source!=='cloud'||navigator.onLine===false||state.writeBlocked){
setStatus('A live signed-in connection is required before confirming a Diet write.',{error:true});
return;
}
const old=button?.textContent;
if(button){button.disabled=true;button.textContent='Saving…';}
try{
const client=getDietV2Client();
if(action.type==='log_saved_food'){
await logSavedFood(client,{
savedFoodId:action.id,date:localDateKey(),mealType:action.mealType,multiplier:action.multiplier
});
}else if(action.type==='log_saved_meal'){
await logSavedMeal(client,{
savedMealId:action.id,date:localDateKey(),mealType:action.mealType,multiplier:action.multiplier
});
}else if(action.type==='repeat_meal'){
await repeatMeal(client,{mealId:action.id,date:localDateKey(),mealType:action.mealType});
}else if(action.type==='strategy_keep'||action.type==='strategy_apply'){
const strategy=window.DietV2StrategyReview;
if(!strategy?.execute)throw new Error('Strategy actions are not ready. Open Strategy and try again.');
await strategy.execute(action.type==='strategy_apply'?'accept':'keep_current',{
effectiveDateChoice:action.effectiveDate??'today',
expected:action.guard,
confirmed:true
});
}else{
throw new Error('Unsupported Copilot action.');
}
await refresh({silent:true});
message.action=null;
const done=action.type==='strategy_apply'
?'Confirmed. The deterministic strategy recommendation was applied and the previous target remains in history.'
:action.type==='strategy_keep'
?'Confirmed. This weekly review was recorded as Keep current; your calorie target did not change.'
:'Confirmed. '+(action.item?.name||'The saved item')+' was logged through Diet Copilot’s existing secure write API.';
pushMessage({role:'assistant',content:done,mode:'local'});
toast(action.type==='strategy_apply'?'Strategy applied.':action.type==='strategy_keep'?'Current target kept.':(action.item?.name||'Item')+' logged.');
}catch(error){
setStatus(error?.message||'The proposed action could not be completed.',{error:true});
if(button){button.disabled=false;button.textContent=old||'Confirm';}
}
}
function open(){
const dialog=$('copilotDialog');
if(!dialog)return;
render();
setStatus('');
if(!dialog.open)dialog.showModal();
requestAnimationFrame(()=>$('copilotInput')?.focus());
}
function close(){
const dialog=$('copilotDialog');
if(dialog?.open)dialog.close();
}
async function submit(event){
event.preventDefault();
if(busy)return;
const input=$('copilotInput');
const value=String(input?.value??'').trim();
if(!value)return;
input.value='';
resizeInput();
await ask(value);
}
function resizeInput(){
const input=$('copilotInput');
if(!input)return;
input.style.height='auto';
input.style.height=Math.min(120,Math.max(42,input.scrollHeight))+'px';
}
function clearSession(){
thread=[];
try{sessionStorage.removeItem(HISTORY_KEY)}catch{}
render();
}
$('copilotOpen')?.addEventListener('click',open);
$('copilotClose')?.addEventListener('click',close);
$('copilotClear')?.addEventListener('click',()=>{
clearSession();
setStatus('');
setMode('Ready','ready');
$('copilotInput')?.focus();
});
$('copilotForm')?.addEventListener('submit',submit);
$('copilotInput')?.addEventListener('input',resizeInput);
$('copilotInput')?.addEventListener('keydown',event=>{
if(event.key==='Enter'&&!event.shiftKey){
event.preventDefault();
$('copilotForm')?.requestSubmit();
}
});
document.querySelectorAll('[data-copilot-prompt]').forEach(button=>button.addEventListener('click',()=>{
const prompt=button.dataset.copilotPrompt;
if(prompt&&!busy)ask(prompt);
}));
$('copilotDialog')?.addEventListener('click',event=>{
if(event.target===$('copilotDialog'))close();
});
window.addEventListener('diet-v2-data-updated',()=>{
if($('copilotDialog')?.open&&thread.length===0)render();
});
window.DietV2Copilot=Object.freeze({
version:DietCopilotP32.version,
actionContract:'P32',
open,
close,
clearSession,
ask
});
render();
