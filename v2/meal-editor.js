import { getDietV2Client, getDietV2Model, getDietV2State, refresh } from './data.js';
import { updateMeal, deleteMeal, repeatMeal, saveMealFromHistory } from './write-api.mjs';
import { localDateKey } from './read-model.mjs';

const dialog=document.getElementById('mealEditorDialog');
const form=document.getElementById('mealEditorForm');
const itemsEl=document.getElementById('mealEditorItems');
let currentMeal=null;
let busy=false;

function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function val(id,value=''){const el=$(id);if(el)el.value=value??'';}
function toast(message){
  const el=document.querySelector('[data-toast]');
  if(!el)return;
  el.textContent=message;el.classList.add('is-visible');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('is-visible'),2600);
}
function ready(){const s=getDietV2State();return s.signedIn&&s.source==='cloud'&&navigator.onLine!==false&&!s.writeBlocked;}
function findMeal(id){
  const m=getDietV2Model();
  const rows=[...(m?.food?.todayMeals??[]),...(m?.food?.recentMeals??[])];
  return rows.find(x=>String(x.id)===String(id))??null;
}
function numberOrNull(v){return v===''||v==null?null:Number(v);}
function itemRow(item={}){
  return '<div class="dc-editor-item" data-editor-item>'+
    '<input type="hidden" data-item-field="saved_food_id" value="'+esc(item.savedFoodId??'')+'">'+
    '<label class="dc-field dc-field--wide"><span>Food</span><input data-item-field="name" maxlength="160" required value="'+esc(item.name??'')+'"></label>'+
    '<label class="dc-field"><span>Quantity</span><input data-item-field="quantity" maxlength="120" value="'+esc(item.quantity??'')+'"></label>'+
    '<label class="dc-field"><span>kcal</span><input data-item-field="calories" type="number" min="0" max="10000" step="0.1" required value="'+(item.calories??0)+'"></label>'+
    '<label class="dc-field"><span>Protein</span><input data-item-field="protein" type="number" min="0" max="1000" step="0.1" value="'+(item.protein??0)+'"></label>'+
    '<label class="dc-field"><span>Carbs</span><input data-item-field="carbs" type="number" min="0" max="2000" step="0.1" value="'+(item.carbs??'')+'"></label>'+
    '<label class="dc-field"><span>Fat</span><input data-item-field="fat" type="number" min="0" max="1000" step="0.1" value="'+(item.fat??'')+'"></label>'+
    '<label class="dc-field"><span>Fiber</span><input data-item-field="fiber" type="number" min="0" max="500" step="0.1" value="'+(item.fiber??'')+'"></label>'+
    '<button class="dc-remove-item" type="button" data-remove-editor-item aria-label="Remove food">×</button>'+
  '</div>';
}
function renderItems(items=[]){
  if(!itemsEl)return;
  const rows=items.length?items:[{name:'',quantity:'',calories:0,protein:0}];
  itemsEl.innerHTML=rows.map(itemRow).join('');
}
function collectItems(){
  const rows=[...itemsEl.querySelectorAll('[data-editor-item]')];
  return rows.map(row=>{
    const get=name=>row.querySelector('[data-item-field="'+name+'"]')?.value??'';
    const name=get('name').trim();
    const calories=Number(get('calories'));
    const protein=Number(get('protein')||0);
    if(!name||!Number.isFinite(calories)||calories<0||!Number.isFinite(protein)||protein<0)throw new Error('Every item needs a name and valid calories/protein.');
    return {
      saved_food_id:get('saved_food_id')||null,
      name,
      quantity:get('quantity').trim()||null,
      calories,
      protein,
      carbs:numberOrNull(get('carbs')),
      fat:numberOrNull(get('fat')),
      fiber:numberOrNull(get('fiber'))
    };
  });
}
function setBusy(next){
  busy=next;
  dialog?.querySelectorAll('button,input,select').forEach(el=>{
    if(el.matches('[data-close-dialog]'))return;
    el.disabled=next;
  });
}
function openMeal(meal){
  currentMeal=meal;
  val('mealEditorId',meal.id);
  val('mealEditorUpdatedAt',meal.updatedAt);
  val('mealEditorTitle',meal.title);
  val('mealEditorDate',meal.date);
  val('mealEditorType',meal.type);
  val('mealCopyDate',localDateKey());
  renderItems(meal.items??[]);
  if(dialog&&!dialog.open)dialog.showModal();
}
async function save(){
  if(!currentMeal||busy)return;
  if(!ready())throw new Error('Meal editing requires a live signed-in connection.');
  const items=collectItems();
  setBusy(true);
  try{
    await updateMeal(getDietV2Client(),{
      mealId:currentMeal.id,
      date:$('mealEditorDate').value,
      mealType:$('mealEditorType').value,
      title:$('mealEditorTitle').value,
      items,
      expectedUpdatedAt:currentMeal.updatedAt
    });
    await refresh({silent:true});
    dialog.close();
    toast('Meal updated.');
  }finally{setBusy(false);}
}
async function removeMeal(){
  if(!currentMeal||busy||!ready())return;
  if(!confirm('Delete "'+currentMeal.title+'" from your log?'))return;
  setBusy(true);
  try{
    await deleteMeal(getDietV2Client(),{mealId:currentMeal.id,expectedUpdatedAt:currentMeal.updatedAt});
    await refresh({silent:true});dialog.close();toast('Meal deleted.');
  }catch(error){toast(error?.message||'Meal could not be deleted.');}
  finally{setBusy(false);}
}
async function copyMeal(){
  if(!currentMeal||busy||!ready())return;
  const date=$('mealCopyDate').value;
  if(!date){toast('Choose a copy date.');return;}
  setBusy(true);
  try{
    await repeatMeal(getDietV2Client(),{mealId:currentMeal.id,date,mealType:$('mealEditorType').value});
    await refresh({silent:true});toast('Meal copied to '+date+'.');
  }catch(error){toast(error?.message||'Meal could not be copied.');}
  finally{setBusy(false);}
}
async function saveReusable(meal=currentMeal){
  if(!meal||busy||!ready())return;
  setBusy(true);
  try{
    await saveMealFromHistory(getDietV2Client(),{mealId:meal.id,name:meal.title});
    await refresh({silent:true});toast('Saved as reusable meal.');
  }catch(error){toast(error?.message||'Meal could not be saved.');}
  finally{setBusy(false);}
}

document.addEventListener('click',event=>{
  const edit=event.target.closest('[data-edit-meal]');
  if(edit){const meal=findMeal(edit.dataset.editMeal);if(meal)openMeal(meal);return;}
  const saveButton=event.target.closest('[data-save-meal-history]');
  if(saveButton){const meal=findMeal(saveButton.dataset.saveMealHistory);if(meal)saveReusable(meal);return;}
  if(event.target.closest('[data-remove-editor-item]')){
    const row=event.target.closest('[data-editor-item]');
    if(itemsEl.querySelectorAll('[data-editor-item]').length>1)row?.remove();
    else row?.querySelectorAll('input').forEach(input=>{if(input.type!=='hidden')input.value='';});
    return;
  }
  const close=event.target.closest('[data-close-dialog="mealEditorDialog"]');
  if(close&&dialog?.open)dialog.close();
});
$('mealEditorAddItem')?.addEventListener('click',()=>itemsEl.insertAdjacentHTML('beforeend',itemRow({name:'',calories:0,protein:0})));
$('mealDeleteButton')?.addEventListener('click',removeMeal);
$('mealCopyButton')?.addEventListener('click',copyMeal);
$('mealSaveReusableButton')?.addEventListener('click',()=>saveReusable());
form?.addEventListener('submit',event=>{
  event.preventDefault();
  save().catch(error=>toast(error?.message||'Meal could not be saved.'));
});
dialog?.addEventListener('close',()=>{currentMeal=null;});
