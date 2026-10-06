const ids=['foodQuickAddForm','foodPortionForm','mealEditorForm','onboardingForm','foodEditorForm'];
const forms=()=>ids.map(id=>document.getElementById(id)).filter(Boolean);
const baseline=new WeakMap(),dirty=new Set();
function snapshot(form){
try{return JSON.stringify([...new FormData(form).entries()].map(([k,v])=>[k,String(v)]));}
catch{return '';}
}
function remember(form){if(form&&!baseline.has(form))baseline.set(form,snapshot(form));}
function update(form){
if(!form)return;
remember(form);
if(snapshot(form)===baseline.get(form)){dirty.delete(form);delete form.dataset.unsaved;}
else{dirty.add(form);form.dataset.unsaved='true';}
}
function clear(form){
if(!form)return;
dirty.delete(form);
delete form.dataset.unsaved;
baseline.set(form,snapshot(form));
}
function activeDirty(){
for(const form of [...dirty]){
if(!form.isConnected){dirty.delete(form);continue;}
const dialog=form.closest('dialog');
if(dialog&&!dialog.open){clear(form);continue;}
return true;
}
return false;
}
function targetForm(target){return target?.closest?.('form')&&forms().includes(target.closest('form'))?target.closest('form'):null}
document.addEventListener('pointerdown',e=>remember(targetForm(e.target)),true);
document.addEventListener('focusin',e=>remember(targetForm(e.target)),true);
document.addEventListener('input',e=>update(targetForm(e.target)),true);
document.addEventListener('change',e=>update(targetForm(e.target)),true);
document.addEventListener('reset',e=>{const form=targetForm(e.target);if(form)setTimeout(()=>clear(form),0)},true);
for(const form of forms()){
form.closest('dialog')?.addEventListener('close',()=>clear(form));
}
window.addEventListener('beforeunload',event=>{if(activeDirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('diet-v2-day-rollover',()=>{for(const form of forms())if(!dirty.has(form))baseline.set(form,snapshot(form));});
function reloadForUpdate(){
if(activeDirty()){
window.DietV2Shell?.showToast?.('Finish or discard your current edits before reloading the update.');
return false;
}
location.reload();
return true;
}
window.DietV2Hardening=Object.freeze({version:'1.0.0-p37',hasUnsavedInput:activeDirty,reloadForUpdate,resetForm:clear});
