import { getDietV2Client, getDietV2Model, getDietV2State, refresh } from './data.js';
import { logManualMeal, logSavedFood, logSavedMeal, repeatMeal, deleteMeal } from './write-api.mjs';
import { localDateKey } from './read-model.mjs';
import {
  rankFoodCaptureMatches, normalizePortionMultiplier, portionPreview,
  portionQuantityText, latestRepeatCandidate
} from './p28-food-capture.mjs';

const ui={
  mealType:defaultMealType(),
  busy:false,
  lastWrite:null,
  barcodeMode:false,
  searchIndex:0,
  searchMatches:[],
  portionTarget:null
};

function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function fmt(value,digits=0){return Number(value||0).toLocaleString(undefined,{maximumFractionDigits:digits});}
function defaultMealType(){
  const h=new Date().getHours();
  if(h<10)return 'Breakfast';
  if(h<15)return 'Lunch';
  if(h<20)return 'Dinner';
  return 'Snack';
}
function writeReady(){
  const s=getDietV2State();
  return s.signedIn && s.source==='cloud' && navigator.onLine!==false;
}
function showStatus(message,{error=false,undo=false}={}){
  const box=$('foodWriteStatus');
  if(!box)return;
  box.hidden=false;
  box.dataset.kind=error?'error':'ok';
  box.innerHTML=`<span>${esc(message)}</span>${undo?'<button type="button" id="foodUndoLast">Undo</button>':''}`;
  if(undo)$('foodUndoLast')?.addEventListener('click',undoLast,{once:true});
}
function clearStatus(){
  const box=$('foodWriteStatus');
  if(box){box.hidden=true;box.textContent='';}
}
function setBusy(button,busy,label='Adding…'){
  ui.busy=busy;
  document.documentElement.classList.toggle('dc-write-busy',busy);
  if(button){
    if(busy){
      button.dataset.previousLabel=button.textContent;
      button.textContent=label;
      button.disabled=true;
    }else{
      button.textContent=button.dataset.previousLabel||button.textContent;
      delete button.dataset.previousLabel;
      button.disabled=false;
    }
  }
}
function errorMessage(error){
  const msg=String(error?.message??error??'');
  if(/Authentication required|JWT|session/i.test(msg))return 'Sign in before logging food.';
  if(/outside allowed range/i.test(msg))return 'That date is outside the allowed logging window.';
  if(/Saved food not found|Saved meal not found|Meal not found/i.test(msg))return 'That item changed or is no longer available. Refresh and try again.';
  if(/network|fetch|timeout|failed to fetch/i.test(msg))return 'The write could not be confirmed. Refresh before trying again.';
  return msg||'Food could not be logged.';
}
async function commit(button,action,successLabel,{clearSearchAfter=false}={}){
  if(ui.busy)return false;
  if(!writeReady()){
    showStatus(navigator.onLine===false?'Food logging requires a connection.':'Sign in to log food.',{error:true});
    return false;
  }
  setBusy(button,true);
  clearStatus();
  try{
    const result=await action();
    const mealId=result?.data?.meal_id??null;
    const updatedAt=result?.data?.updated_at??null;
    ui.lastWrite=mealId?{mealId,updatedAt,label:successLabel}:null;
    showStatus(`${successLabel} added.`,{undo:Boolean(ui.lastWrite)});
    if(clearSearchAfter)clearSearch({focus:true});
    await refresh({silent:true});
    renderFoodWorkspace();
    return true;
  }catch(error){
    showStatus(errorMessage(error),{error:true});
    return false;
  }finally{
    setBusy(button,false);
  }
}
async function undoLast(){
  if(!ui.lastWrite||ui.busy)return;
  const last=ui.lastWrite;
  const button=$('foodUndoLast');
  setBusy(button,true,'Undoing…');
  try{
    await deleteMeal(getDietV2Client(),{mealId:last.mealId,expectedUpdatedAt:last.updatedAt});
    ui.lastWrite=null;
    showStatus(`${last.label} removed.`);
    await refresh({silent:true});
    renderFoodWorkspace();
  }catch(error){
    showStatus(errorMessage(error),{error:true});
  }finally{
    setBusy(button,false);
  }
}

function setMealType(type){
  ui.mealType=type;
  document.querySelectorAll('[data-food-meal-type]').forEach(button=>{
    const active=button.dataset.foodMealType===type;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
  renderSearch();
  renderRepeatLast();
}

function foodCard(food,{searchIndex=null}={}){
  const selected=searchIndex===ui.searchIndex?' is-keyboard-selected':'';
  return `<div class="dc-log-option${selected}" ${searchIndex==null?'':`data-food-search-result="${searchIndex}"`}>
    <button class="dc-log-option-main" type="button" data-log-saved-food="${esc(food.id)}">
      <span class="dc-log-option-title"><strong>${esc(food.name)}</strong>${food.brand?`<small>${esc(food.brand)}</small>`:''}</span>
      <span class="dc-log-option-meta">${food.quantity?esc(food.quantity)+' · ':''}${fmt(food.calories)} kcal · ${fmt(food.protein,1)} g P</span>
    </button>
    <button class="dc-log-portion" type="button" data-portion-food="${esc(food.id)}" aria-label="Choose portion for ${esc(food.name)}">½–2×</button>
    <button class="dc-log-add" type="button" data-log-saved-food="${esc(food.id)}" aria-label="Add ${esc(food.name)}">+</button>
  </div>`;
}
function savedMealCard(meal,{searchIndex=null}={}){
  const selected=searchIndex===ui.searchIndex?' is-keyboard-selected':'';
  return `<div class="dc-log-option${selected}" ${searchIndex==null?'':`data-food-search-result="${searchIndex}"`}>
    <button class="dc-log-option-main" type="button" data-log-saved-meal="${esc(meal.id)}">
      <span class="dc-log-option-title"><strong>${esc(meal.name)}</strong><small>${meal.isRecipe?'Recipe':esc(meal.mealType)}</small></span>
      <span class="dc-log-option-meta">${fmt(meal.calories)} kcal · ${fmt(meal.protein,1)} g P${meal.isRecipe&&meal.servings?` · ${fmt(meal.servings,1)} servings saved`:''}</span>
    </button>
    <button class="dc-log-portion" type="button" data-portion-meal="${esc(meal.id)}" aria-label="Choose portion for ${esc(meal.name)}">½–2×</button>
    <button class="dc-log-add" type="button" data-log-saved-meal="${esc(meal.id)}" aria-label="Add ${esc(meal.name)}">+</button>
  </div>`;
}
function recentMealCard(meal){
  return `<div class="dc-log-option">
    <button class="dc-log-option-main" type="button" data-repeat-meal="${esc(meal.id)}">
      <span class="dc-log-option-title"><strong>${esc(meal.title)}</strong><small>${esc(meal.type)} · ${esc(meal.date)}</small></span>
      <span class="dc-log-option-meta">${fmt(meal.calories)} kcal · ${fmt(meal.protein,1)} g P</span>
    </button>
    <button class="dc-log-repeat" type="button" data-repeat-meal="${esc(meal.id)}">Repeat</button>
  </div>`;
}
function empty(text){return `<div class="dc-food-empty">${esc(text)}</div>`;}

function renderSearch(){
  const model=getDietV2Model();
  const input=$('foodSearchInput');
  const results=$('foodSearchResults');
  if(!input||!results)return;
  const query=input.value;
  if(!query.trim()){
    ui.searchMatches=[];ui.searchIndex=0;
    results.hidden=true;results.innerHTML='';
    return;
  }
  ui.searchMatches=rankFoodCaptureMatches(model,query,{mealType:ui.mealType,limit:10});
  ui.searchIndex=Math.max(0,Math.min(ui.searchIndex,Math.max(0,ui.searchMatches.length-1)));
  results.hidden=false;
  results.innerHTML=ui.searchMatches.length
    ?ui.searchMatches.map((x,i)=>x.type==='food'?foodCard(x.item,{searchIndex:i}):savedMealCard(x.item,{searchIndex:i})).join('')
    :empty(ui.barcodeMode?'No saved food matches that barcode.':'No local match. Press Enter to search Open Food Facts.');
  bindDynamicActions(results);
}
function clearSearch({focus=false}={}){
  const input=$('foodSearchInput');
  if(!input)return;
  input.value='';
  ui.barcodeMode=false;ui.searchMatches=[];ui.searchIndex=0;
  input.placeholder='Search foods, meals, brands or barcode';
  renderSearch();
  if(focus)requestAnimationFrame(()=>input.focus());
}
function moveSearch(delta){
  if(!ui.searchMatches.length)return;
  ui.searchIndex=(ui.searchIndex+delta+ui.searchMatches.length)%ui.searchMatches.length;
  renderSearch();
  document.querySelector(`[data-food-search-result="${ui.searchIndex}"]`)?.scrollIntoView({block:'nearest'});
}
function logSearchSelection(button=null){
  const match=ui.searchMatches[ui.searchIndex]??ui.searchMatches[0];
  if(!match)return false;
  if(match.type==='food'){
    commit(button,()=>logSavedFood(getDietV2Client(),{
      savedFoodId:match.item.id,date:localDateKey(),mealType:ui.mealType,multiplier:1
    }),match.item.name,{clearSearchAfter:true});
  }else{
    commit(button,()=>logSavedMeal(getDietV2Client(),{
      savedMealId:match.item.id,date:localDateKey(),mealType:ui.mealType,multiplier:1
    }),match.item.name,{clearSearchAfter:true});
  }
  return true;
}

function bindDynamicActions(root=document){
  root.querySelectorAll('[data-log-saved-food]').forEach(button=>{
    button.addEventListener('click',()=>{
      const model=getDietV2Model();
      const food=model?.food?.savedFoods?.find(x=>x.id===button.dataset.logSavedFood);
      if(!food)return;
      commit(button,()=>logSavedFood(getDietV2Client(),{
        savedFoodId:food.id,date:localDateKey(),mealType:ui.mealType,multiplier:1
      }),food.name,{clearSearchAfter:Boolean(button.closest('#foodSearchResults'))});
    });
  });
  root.querySelectorAll('[data-log-saved-meal]').forEach(button=>{
    button.addEventListener('click',()=>{
      const model=getDietV2Model();
      const meal=model?.food?.savedMeals?.find(x=>x.id===button.dataset.logSavedMeal);
      if(!meal)return;
      commit(button,()=>logSavedMeal(getDietV2Client(),{
        savedMealId:meal.id,date:localDateKey(),mealType:ui.mealType,multiplier:1
      }),meal.name,{clearSearchAfter:Boolean(button.closest('#foodSearchResults'))});
    });
  });
  root.querySelectorAll('[data-repeat-meal]').forEach(button=>{
    button.addEventListener('click',()=>{
      const model=getDietV2Model();
      const meal=model?.food?.recentMeals?.find(x=>x.id===button.dataset.repeatMeal);
      if(!meal)return;
      commit(button,()=>repeatMeal(getDietV2Client(),{
        mealId:meal.id,date:localDateKey(),mealType:ui.mealType
      }),meal.title);
    });
  });
  root.querySelectorAll('[data-portion-food]').forEach(button=>button.addEventListener('click',()=>{
    const food=getDietV2Model()?.food?.savedFoods?.find(x=>String(x.id)===String(button.dataset.portionFood));
    if(food)openPortion('food',food);
  }));
  root.querySelectorAll('[data-portion-meal]').forEach(button=>button.addEventListener('click',()=>{
    const meal=getDietV2Model()?.food?.savedMeals?.find(x=>String(x.id)===String(button.dataset.portionMeal));
    if(meal)openPortion('meal',meal);
  }));
}

function renderRepeatLast(){
  const button=$('foodRepeatLast');
  if(!button)return;
  const candidate=latestRepeatCandidate(getDietV2Model()?.food?.recentMeals??[],ui.mealType);
  button.disabled=!candidate;
  button.dataset.repeatMealId=candidate?.id??'';
  button.title=candidate?`Repeat ${candidate.title} as ${ui.mealType}`:'No recent meal to repeat';
  const label=button.querySelector('[data-repeat-label]');
  if(label)label.textContent=candidate?'Repeat last':'No recent meal';
}

function renderFoodWorkspace(){
  const model=getDietV2Model();
  if(!model)return;
  const foods=model.food.quickFoods??[];
  const meals=model.food.quickMeals??[];
  const recent=(model.food.recentMeals??[]).slice(0,8);
  const foodsEl=$('foodQuickFoods');
  const mealsEl=$('foodSavedMeals');
  const recentEl=$('foodRecentMeals');
  if(foodsEl)foodsEl.innerHTML=foods.length?foods.map(foodCard).join(''):empty('No saved foods yet. Add a food once, then reuse it here.');
  if(mealsEl)mealsEl.innerHTML=meals.length?meals.map(savedMealCard).join(''):empty('No saved meals or recipes yet.');
  if(recentEl)recentEl.innerHTML=recent.length?recent.map(recentMealCard).join(''):empty('No recent meals available to repeat.');
  bindDynamicActions(foodsEl??document);
  bindDynamicActions(mealsEl??document);
  bindDynamicActions(recentEl??document);
  renderRepeatLast();
  renderSearch();
}

function toggleQuickAdd(open){
  const form=$('foodQuickAddForm');
  const input=$('quickFoodName');
  if(!form)return;
  const next=open??form.hidden;
  form.hidden=!next;
  if(next)requestAnimationFrame(()=>input?.focus());
}
async function submitQuickAdd(event){
  event.preventDefault();
  const form=event.currentTarget;
  const name=String(form.elements.name.value??'').trim();
  const quantity=String(form.elements.quantity.value??'').trim();
  const calories=Number(form.elements.calories.value);
  const protein=Number(form.elements.protein.value||0);
  if(!name||!Number.isFinite(calories)||calories<0||!Number.isFinite(protein)||protein<0){
    showStatus('Enter a food name and valid calorie/protein values.',{error:true});
    return;
  }
  const button=form.querySelector('button[type="submit"]');
  const ok=await commit(button,()=>logManualMeal(getDietV2Client(),{
    date:localDateKey(),mealType:ui.mealType,title:name,
    items:[{name,quantity:quantity||null,calories,protein}]
  }),name);
  if(ok){
    form.reset();
    toggleQuickAdd(false);
    requestAnimationFrame(()=>$('foodSearchInput')?.focus());
  }
}

function focusSearch({barcode=false}={}){
  ui.barcodeMode=barcode;
  const input=$('foodSearchInput');
  if(!input)return;
  input.placeholder=barcode?'Enter or scan a barcode':'Search foods, meals, brands or barcode';
  input.focus();
  input.select();
}

function openPortion(kind,item){
  const dialog=$('foodPortionDialog');
  if(!dialog)return;
  ui.portionTarget={kind,item};
  $('foodPortionName').textContent=item.name;
  $('foodPortionBase').textContent=`${item.quantity||item.servingText||'1 serving'} · ${fmt(item.calories)} kcal · ${fmt(item.protein,1)} g P`;
  $('foodPortionMultiplier').value='1';
  $('foodPortionQuantity').value='';
  document.querySelectorAll('[data-portion-preset]').forEach(b=>b.classList.toggle('is-selected',b.dataset.portionPreset==='1'));
  updatePortionPreview();
  if(!dialog.open)dialog.showModal();
}
function updatePortionPreview(){
  const target=ui.portionTarget;
  if(!target)return;
  const multiplier=normalizePortionMultiplier($('foodPortionMultiplier')?.value);
  const preview=portionPreview(target.item,multiplier);
  $('foodPortionPreview').textContent=`${fmt(preview.calories)} kcal · ${fmt(preview.protein,1)} g protein`;
  document.querySelectorAll('[data-portion-preset]').forEach(b=>b.classList.toggle('is-selected',Number(b.dataset.portionPreset)===preview.multiplier));
}
async function submitPortion(event){
  event.preventDefault();
  const target=ui.portionTarget;
  if(!target)return;
  const button=$('foodPortionSubmit');
  const multiplier=normalizePortionMultiplier($('foodPortionMultiplier').value);
  const quantityText=portionQuantityText(target.item,multiplier,$('foodPortionQuantity').value);
  const action=target.kind==='food'
    ?()=>logSavedFood(getDietV2Client(),{savedFoodId:target.item.id,date:localDateKey(),mealType:ui.mealType,multiplier,quantityText})
    :()=>logSavedMeal(getDietV2Client(),{savedMealId:target.item.id,date:localDateKey(),mealType:ui.mealType,multiplier,quantityText});
  const ok=await commit(button,action,target.item.name,{clearSearchAfter:true});
  if(ok){
    $('foodPortionDialog')?.close();
    ui.portionTarget=null;
  }
}

document.querySelectorAll('[data-food-meal-type]').forEach(button=>button.addEventListener('click',()=>setMealType(button.dataset.foodMealType)));
$('foodSearchInput')?.addEventListener('input',()=>{ui.barcodeMode=false;ui.searchIndex=0;renderSearch();});
$('foodSearchInput')?.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'&&ui.searchMatches.length){event.preventDefault();event.stopImmediatePropagation();moveSearch(1);return;}
  if(event.key==='ArrowUp'&&ui.searchMatches.length){event.preventDefault();event.stopImmediatePropagation();moveSearch(-1);return;}
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();clearSearch();event.currentTarget.blur();return;}
  if(event.key==='Enter'&&ui.searchMatches.length){
    event.preventDefault();event.stopImmediatePropagation();logSearchSelection();return;
  }
});
$('foodQuickAddToggle')?.addEventListener('click',()=>toggleQuickAdd());
$('foodQuickAddHeader')?.addEventListener('click',()=>toggleQuickAdd(true));
$('foodQuickAddForm')?.addEventListener('submit',submitQuickAdd);
$('foodShortcutRecent')?.addEventListener('click',()=>$('foodRecentMeals')?.scrollIntoView({behavior:'smooth',block:'center'}));
$('foodShortcutSaved')?.addEventListener('click',()=>$('foodSavedMeals')?.scrollIntoView({behavior:'smooth',block:'center'}));
$('foodShortcutQuick')?.addEventListener('click',()=>toggleQuickAdd(true));
$('foodRepeatLast')?.addEventListener('click',event=>{
  const meal=getDietV2Model()?.food?.recentMeals?.find(x=>String(x.id)===String(event.currentTarget.dataset.repeatMealId));
  if(meal)commit(event.currentTarget,()=>repeatMeal(getDietV2Client(),{mealId:meal.id,date:localDateKey(),mealType:ui.mealType}),meal.title);
});
$('foodPortionMultiplier')?.addEventListener('input',updatePortionPreview);
$('foodPortionForm')?.addEventListener('submit',submitPortion);
document.querySelectorAll('[data-portion-preset]').forEach(button=>button.addEventListener('click',()=>{
  $('foodPortionMultiplier').value=button.dataset.portionPreset;
  updatePortionPreview();
}));
document.addEventListener('keydown',event=>{
  const target=event.target;
  const typing=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target?.isContentEditable;
  if(event.key==='/'&&!typing&&location.hash==='#food'){
    event.preventDefault();focusSearch();
  }
});

window.addEventListener('diet-v2-data-updated',renderFoodWorkspace);
window.addEventListener('hashchange',()=>{if(location.hash==='#food'){renderFoodWorkspace();requestAnimationFrame(()=>focusSearch());}});

setMealType(ui.mealType);
renderFoodWorkspace();
