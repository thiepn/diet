import { getDietV2Client, getDietV2Model, getDietV2State, refresh } from './data.js';
import { logManualMeal, logSavedFood, logSavedMeal, repeatMeal, deleteMeal } from './write-api.mjs';
import { localDateKey } from './read-model.mjs';

const ui={
  mealType:defaultMealType(),
  busy:false,
  lastWrite:null,
  barcodeMode:false
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
function normalize(value){return String(value??'').trim().toLowerCase();}
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
async function commit(button,action,successLabel){
  if(ui.busy)return;
  if(!writeReady()){
    showStatus(navigator.onLine===false?'Food logging requires a connection.':'Sign in to log food.',{error:true});
    return;
  }
  setBusy(button,true);
  clearStatus();
  try{
    const result=await action();
    const mealId=result?.data?.meal_id??null;
    const updatedAt=result?.data?.updated_at??null;
    ui.lastWrite=mealId?{mealId,updatedAt,label:successLabel}:null;
    showStatus(`${successLabel} added.`,{undo:Boolean(ui.lastWrite)});
    await refresh({silent:true});
    renderFoodWorkspace();
  }catch(error){
    showStatus(errorMessage(error),{error:true});
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
}

function foodCard(food){
  return `<div class="dc-log-option">
    <button class="dc-log-option-main" type="button" data-log-saved-food="${esc(food.id)}">
      <span class="dc-log-option-title"><strong>${esc(food.name)}</strong>${food.brand?`<small>${esc(food.brand)}</small>`:''}</span>
      <span class="dc-log-option-meta">${food.quantity?esc(food.quantity)+' · ':''}${fmt(food.calories)} kcal · ${fmt(food.protein,1)} g P</span>
    </button>
    <button class="dc-log-add" type="button" data-log-saved-food="${esc(food.id)}" aria-label="Add ${esc(food.name)}">+</button>
  </div>`;
}
function savedMealCard(meal){
  return `<div class="dc-log-option">
    <button class="dc-log-option-main" type="button" data-log-saved-meal="${esc(meal.id)}">
      <span class="dc-log-option-title"><strong>${esc(meal.name)}</strong><small>${meal.isRecipe?'Recipe':esc(meal.mealType)}</small></span>
      <span class="dc-log-option-meta">${fmt(meal.calories)} kcal · ${fmt(meal.protein,1)} g P${meal.isRecipe&&meal.servings?` · ${fmt(meal.servings,1)} servings saved`:''}</span>
    </button>
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

function searchResults(model,query){
  const q=normalize(query);
  if(!q)return [];
  const foods=(model?.food?.savedFoods??[]).map(item=>({
    type:'food',item,
    score:(normalize(item.barcode)===q?500:0)+(normalize(item.name)===q?220:0)+(normalize(item.name).startsWith(q)?120:0)+(normalize(item.name).includes(q)?70:0)+(normalize(item.brand).includes(q)?40:0)+(item.favorite?15:0)+Math.min(item.useCount,30)
  })).filter(x=>x.score>0);
  const meals=(model?.food?.savedMeals??[]).map(item=>({
    type:'meal',item,
    score:(normalize(item.name)===q?210:0)+(normalize(item.name).startsWith(q)?110:0)+(normalize(item.name).includes(q)?65:0)+(item.favorite?15:0)+Math.min(item.useCount,30)
  })).filter(x=>x.score>0);
  return [...foods,...meals].sort((a,b)=>b.score-a.score).slice(0,10);
}
function renderSearch(){
  const model=getDietV2Model();
  const input=$('foodSearchInput');
  const results=$('foodSearchResults');
  if(!input||!results)return;
  const query=input.value;
  const found=searchResults(model,query);
  if(!query.trim()){
    results.hidden=true;
    results.innerHTML='';
    return;
  }
  results.hidden=false;
  results.innerHTML=found.length?found.map(x=>x.type==='food'?foodCard(x.item):savedMealCard(x.item)).join(''):empty(ui.barcodeMode?'No saved food matches that barcode.':'No saved food or meal matches yet. Use Quick add for a new exact entry.');
  bindDynamicActions(results);
}

function bindDynamicActions(root=document){
  root.querySelectorAll('[data-log-saved-food]').forEach(button=>{
    button.addEventListener('click',()=>{
      const model=getDietV2Model();
      const food=model?.food?.savedFoods?.find(x=>x.id===button.dataset.logSavedFood);
      if(!food)return;
      commit(button,()=>logSavedFood(getDietV2Client(),{
        savedFoodId:food.id,date:localDateKey(),mealType:ui.mealType,multiplier:1
      }),food.name);
    });
  });
  root.querySelectorAll('[data-log-saved-meal]').forEach(button=>{
    button.addEventListener('click',()=>{
      const model=getDietV2Model();
      const meal=model?.food?.savedMeals?.find(x=>x.id===button.dataset.logSavedMeal);
      if(!meal)return;
      commit(button,()=>logSavedMeal(getDietV2Client(),{
        savedMealId:meal.id,date:localDateKey(),mealType:ui.mealType,multiplier:1
      }),meal.name);
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
  if(foodsEl)foodsEl.innerHTML=foods.length?foods.map(foodCard).join(''):empty('No saved foods yet. Exact Quick adds become reusable food memory.');
  if(mealsEl)mealsEl.innerHTML=meals.length?meals.map(savedMealCard).join(''):empty('No saved meals or recipes yet.');
  if(recentEl)recentEl.innerHTML=recent.length?recent.map(recentMealCard).join(''):empty('No recent meals available to repeat.');
  bindDynamicActions(foodsEl??document);
  bindDynamicActions(mealsEl??document);
  bindDynamicActions(recentEl??document);
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
  await commit(button,()=>logManualMeal(getDietV2Client(),{
    date:localDateKey(),mealType:ui.mealType,title:name,
    items:[{name,quantity:quantity||null,calories,protein}]
  }),name);
  if(!ui.busy){
    form.reset();
    toggleQuickAdd(false);
  }
}

function focusSearch({barcode=false}={}){
  ui.barcodeMode=barcode;
  const input=$('foodSearchInput');
  if(!input)return;
  input.placeholder=barcode?'Enter or scan a saved barcode':'Search foods, meals, brands or barcode';
  input.focus();
  input.select();
}

document.querySelectorAll('[data-food-meal-type]').forEach(button=>button.addEventListener('click',()=>setMealType(button.dataset.foodMealType)));
$('foodSearchInput')?.addEventListener('input',()=>{ui.barcodeMode=false;renderSearch();});
$('foodQuickAddToggle')?.addEventListener('click',()=>toggleQuickAdd());
$('foodQuickAddHeader')?.addEventListener('click',()=>toggleQuickAdd(true));
$('foodQuickAddForm')?.addEventListener('submit',submitQuickAdd);
$('foodShortcutRecent')?.addEventListener('click',()=>$('foodRecentMeals')?.scrollIntoView({behavior:'smooth',block:'center'}));
$('foodShortcutSaved')?.addEventListener('click',()=>$('foodSavedMeals')?.scrollIntoView({behavior:'smooth',block:'center'}));
$('foodShortcutBarcode')?.addEventListener('click',()=>focusSearch({barcode:true}));
$('foodShortcutQuick')?.addEventListener('click',()=>toggleQuickAdd(true));

window.addEventListener('diet-v2-data-updated',renderFoodWorkspace);
window.addEventListener('hashchange',()=>{if(location.hash==='#food')renderFoodWorkspace();});

setMealType(ui.mealType);
renderFoodWorkspace();
