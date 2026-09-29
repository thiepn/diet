import { getDietV2Client, getDietV2Model, getDietV2State, refresh } from './data.js';
import {
  saveFood, logSavedFood, setSavedFoodFavorite, deleteSavedFood,
  setSavedMealFavorite, deleteSavedMeal
} from './write-api.mjs';
import { searchOpenFoodFacts, lookupOpenFoodFactsBarcode, scaleOpenFoodFactsProduct } from './open-food-facts.mjs';
import { localDateKey } from './read-model.mjs';

const libraryDialog=document.getElementById('foodLibraryDialog');
const editorDialog=document.getElementById('foodEditorDialog');
const editorForm=document.getElementById('foodEditorForm');
const externalProducts=new Map();
let editorContext={kind:'new',product:null};
let busy=false;

function $(id){return document.getElementById(id);}
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function fmt(value,digits=1){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});}
function ready(){const s=getDietV2State();return s.signedIn&&s.source==='cloud'&&navigator.onLine!==false;}
function selectedMealType(){return document.querySelector('[data-food-meal-type].is-selected')?.dataset.foodMealType||'Other';}
function toast(message){
  const el=document.querySelector('[data-toast]');
  if(!el)return;
  el.textContent=message;el.classList.add('is-visible');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('is-visible'),2800);
}
function setBusy(next){
  busy=next;
  [libraryDialog,editorDialog].forEach(root=>root?.querySelectorAll('button,input,select').forEach(el=>{
    if(el.matches('[data-close-dialog]'))return;
    el.disabled=next;
  }));
}
function n(id){
  const value=$(id)?.value??'';
  return value===''?null:Number(value);
}
function set(id,value=''){const el=$(id);if(el)el.value=value??'';}
function resetEditor(){
  ['foodEditorId','foodEditorUpdatedAt','foodEditorName','foodEditorBrand','foodEditorBarcode','foodEditorQuantity','foodEditorCalories','foodEditorProtein','foodEditorCarbs','foodEditorFat','foodEditorFiber','foodEditorPhotoUrl'].forEach(id=>set(id,''));
  set('foodEditorSource','manual_exact');
  $('foodEditorGramsWrap').hidden=true;
  $('foodEditorSourceNote').textContent='Saved directly to your private Diet food library.';
}
function fillFood(food){
  resetEditor();
  editorContext={kind:'saved',product:null};
  set('foodEditorId',food.id);
  set('foodEditorUpdatedAt',food.updatedAt);
  set('foodEditorName',food.name);
  set('foodEditorBrand',food.brand);
  set('foodEditorBarcode',food.barcode);
  set('foodEditorQuantity',food.quantity);
  set('foodEditorCalories',food.calories);
  set('foodEditorProtein',food.protein);
  set('foodEditorCarbs',food.carbs);
  set('foodEditorFat',food.fat);
  set('foodEditorFiber',food.fiber);
  set('foodEditorPhotoUrl',food.photoUrl);
  set('foodEditorSource','manual_exact');
  $('foodEditorEyebrow').textContent='Saved food';
  $('foodEditorHeading').textContent='Edit food';
  $('foodEditorSourceNote').textContent='Editing makes these values your manually confirmed saved-food values.';
}
function fillExternal(product){
  resetEditor();
  editorContext={kind:'external',product};
  const grams=product.servingQuantity||100;
  const scaled=scaleOpenFoodFactsProduct(product,grams);
  set('foodEditorName',scaled.name);
  set('foodEditorBrand',scaled.brand);
  set('foodEditorBarcode',scaled.barcode);
  set('foodEditorQuantity',scaled.quantityText);
  set('foodEditorCalories',scaled.calories);
  set('foodEditorProtein',scaled.protein);
  set('foodEditorCarbs',scaled.carbs);
  set('foodEditorFat',scaled.fat);
  set('foodEditorFiber',scaled.fiber);
  set('foodEditorPhotoUrl',scaled.photoUrl);
  set('foodEditorSource','open_food_facts');
  set('foodEditorGrams',grams);
  $('foodEditorGramsWrap').hidden=false;
  $('foodEditorEyebrow').textContent='Open Food Facts';
  $('foodEditorHeading').textContent='Review before importing';
  $('foodEditorSourceNote').textContent='Community-supplied data can be incomplete or inaccurate. Check the package label before saving.';
}
function openNewFood(){
  resetEditor();
  editorContext={kind:'new',product:null};
  $('foodEditorEyebrow').textContent='Custom food';
  $('foodEditorHeading').textContent='Create saved food';
  if(editorDialog&&!editorDialog.open)editorDialog.showModal();
  requestAnimationFrame(()=>$('foodEditorName')?.focus());
}
function openSavedFood(food){
  fillFood(food);
  if(editorDialog&&!editorDialog.open)editorDialog.showModal();
}
function openExternalFood(product){
  fillExternal(product);
  if(editorDialog&&!editorDialog.open)editorDialog.showModal();
}
function payload(){
  const name=$('foodEditorName').value.trim();
  const calories=n('foodEditorCalories');
  const protein=n('foodEditorProtein')??0;
  if(!name||calories==null||!Number.isFinite(calories)||calories<0)throw new Error('Name and valid calories are required.');
  return {
    savedFoodId:$('foodEditorId').value||null,
    expectedUpdatedAt:$('foodEditorUpdatedAt').value||null,
    name,
    quantityText:$('foodEditorQuantity').value.trim()||null,
    calories,
    protein,
    carbs:n('foodEditorCarbs'),
    fat:n('foodEditorFat'),
    fiber:n('foodEditorFiber'),
    brand:$('foodEditorBrand').value.trim()||null,
    barcode:$('foodEditorBarcode').value.trim()||null,
    source:$('foodEditorSource').value||'manual_exact',
    photoUrl:$('foodEditorPhotoUrl').value||null
  };
}
async function saveCurrent({log=false}={}){
  if(busy||!ready())throw new Error('Food changes require a live signed-in connection.');
  const p=payload();
  setBusy(true);
  try{
    const saved=await saveFood(getDietV2Client(),p);
    if(log){
      await logSavedFood(getDietV2Client(),{
        savedFoodId:saved.data.saved_food_id,
        date:localDateKey(),
        mealType:selectedMealType(),
        multiplier:1,
        quantityText:p.quantityText
      });
    }
    await refresh({silent:true});
    editorDialog.close();
    renderLibrary();
    toast(log?p.name+' saved and logged.':p.name+' saved.');
  }finally{setBusy(false);}
}
function foodRow(food){
  return '<div class="dc-library-row">'+
    '<button class="dc-library-star '+(food.favorite?'is-active':'')+'" type="button" data-food-favorite="'+esc(food.id)+'" aria-label="Toggle favorite">'+(food.favorite?'★':'☆')+'</button>'+
    '<button class="dc-library-main" type="button" data-food-edit="'+esc(food.id)+'"><strong>'+esc(food.name)+'</strong><span>'+(food.brand?esc(food.brand)+' · ':'')+fmt(food.calories,0)+' kcal · '+fmt(food.protein,1)+' g P</span></button>'+
    '<button class="dc-library-delete" type="button" data-food-delete="'+esc(food.id)+'" aria-label="Delete '+esc(food.name)+'">×</button>'+
  '</div>';
}
function mealRow(meal){
  return '<div class="dc-library-row">'+
    '<button class="dc-library-star '+(meal.favorite?'is-active':'')+'" type="button" data-saved-meal-favorite="'+esc(meal.id)+'" aria-label="Toggle favorite">'+(meal.favorite?'★':'☆')+'</button>'+
    '<div class="dc-library-main dc-library-main--static"><strong>'+esc(meal.name)+'</strong><span>'+esc(meal.mealType)+' · '+fmt(meal.calories,0)+' kcal · '+fmt(meal.protein,1)+' g P</span></div>'+
    '<button class="dc-library-delete" type="button" data-saved-meal-delete="'+esc(meal.id)+'" aria-label="Delete '+esc(meal.name)+'">×</button>'+
  '</div>';
}
function renderLibrary(){
  const model=getDietV2Model();
  if(!model)return;
  const q=String($('foodLibraryFilter')?.value??'').trim().toLowerCase();
  const foods=(model.food.savedFoods??[]).filter(x=>!q||[x.name,x.brand,x.barcode].some(v=>String(v??'').toLowerCase().includes(q)));
  const meals=(model.food.savedMeals??[]).filter(x=>!q||[x.name,x.mealType].some(v=>String(v??'').toLowerCase().includes(q)));
  $('foodLibraryFoods').innerHTML=foods.length?foods.map(foodRow).join(''):'<div class="dc-food-empty">No matching saved foods.</div>';
  $('foodLibraryMeals').innerHTML=meals.length?meals.map(mealRow).join(''):'<div class="dc-food-empty">No matching saved meals.</div>';
  $('foodLibraryFoodCount').textContent=String(foods.length);
  $('foodLibraryMealCount').textContent=String(meals.length);
}
function openLibrary(){
  renderLibrary();
  if(libraryDialog&&!libraryDialog.open)libraryDialog.showModal();
}
function externalCard(product){
  const n=product.per100;
  return '<article class="dc-external-card">'+
    (product.imageUrl?'<img src="'+esc(product.imageUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="dc-external-image">OFF</span>')+
    '<div><strong>'+esc(product.name)+'</strong><span>'+(product.brand?esc(product.brand)+' · ':'')+esc(product.code)+'</span><small>'+fmt(n.calories,0)+' kcal · '+fmt(n.protein,1)+' g P per 100 g</small></div>'+
    '<button class="dc-secondary-action dc-compact-action" type="button" data-external-code="'+esc(product.code)+'">Use</button>'+
  '</article>';
}
async function onlineSearch({barcode=false}={}){
  const input=$('foodSearchInput');
  const results=$('foodOnlineResults');
  const query=String(input?.value??'').trim();
  if(!query){toast(barcode?'Enter a barcode first.':'Enter a food name first.');input?.focus();return;}
  results.hidden=false;
  results.innerHTML='<div class="dc-food-empty">Searching Open Food Facts…</div>';
  try{
    let products=[];
    if(barcode){
      const product=await lookupOpenFoodFactsBarcode(query);
      products=product?[product]:[];
    }else{
      products=await searchOpenFoodFacts(query,{pageSize:10});
    }
    externalProducts.clear();
    products.forEach(p=>externalProducts.set(p.code,p));
    results.innerHTML=products.length?
      '<div class="dc-online-head"><strong>Open Food Facts</strong><span>Review label data before logging</span></div>'+products.map(externalCard).join(''):
      '<div class="dc-food-empty">No usable Open Food Facts result found.</div>';
  }catch(error){
    results.innerHTML='<div class="dc-food-empty">'+esc(error?.message||'Online food search failed.')+'</div>';
  }
}
async function toggleFoodFavorite(id){
  if(busy||!ready())return;
  const food=getDietV2Model()?.food?.savedFoods?.find(x=>String(x.id)===String(id));
  if(!food)return;
  setBusy(true);
  try{await setSavedFoodFavorite(getDietV2Client(),{savedFoodId:food.id,favorite:!food.favorite});await refresh({silent:true});renderLibrary();}
  catch(error){toast(error?.message||'Favorite could not be changed.');}
  finally{setBusy(false);}
}
async function removeFood(id){
  if(busy||!ready())return;
  const food=getDietV2Model()?.food?.savedFoods?.find(x=>String(x.id)===String(id));
  if(!food||!confirm('Delete saved food "'+food.name+'"? Logged meal history will remain.'))return;
  setBusy(true);
  try{await deleteSavedFood(getDietV2Client(),{savedFoodId:food.id,expectedUpdatedAt:food.updatedAt});await refresh({silent:true});renderLibrary();toast('Saved food deleted.');}
  catch(error){toast(error?.message||'Saved food could not be deleted.');}
  finally{setBusy(false);}
}
async function toggleMealFavorite(id){
  if(busy||!ready())return;
  const meal=getDietV2Model()?.food?.savedMeals?.find(x=>String(x.id)===String(id));
  if(!meal)return;
  setBusy(true);
  try{await setSavedMealFavorite(getDietV2Client(),{savedMealId:meal.id,favorite:!meal.favorite});await refresh({silent:true});renderLibrary();}
  catch(error){toast(error?.message||'Favorite could not be changed.');}
  finally{setBusy(false);}
}
async function removeSavedMeal(id){
  if(busy||!ready())return;
  const meal=getDietV2Model()?.food?.savedMeals?.find(x=>String(x.id)===String(id));
  if(!meal||!confirm('Delete saved meal "'+meal.name+'"? Existing food logs will remain.'))return;
  setBusy(true);
  try{await deleteSavedMeal(getDietV2Client(),{savedMealId:meal.id,expectedUpdatedAt:meal.updatedAt});await refresh({silent:true});renderLibrary();toast('Saved meal deleted.');}
  catch(error){toast(error?.message||'Saved meal could not be deleted.');}
  finally{setBusy(false);}
}
function rescaleExternal(){
  if(editorContext.kind!=='external'||!editorContext.product)return;
  try{
    const scaled=scaleOpenFoodFactsProduct(editorContext.product,Number($('foodEditorGrams').value));
    set('foodEditorQuantity',scaled.quantityText);
    set('foodEditorCalories',scaled.calories);
    set('foodEditorProtein',scaled.protein);
    set('foodEditorCarbs',scaled.carbs);
    set('foodEditorFat',scaled.fat);
    set('foodEditorFiber',scaled.fiber);
  }catch{}
}

document.addEventListener('click',event=>{
  if(event.target.closest('#foodLibraryButton,[data-open-food-library]')){openLibrary();return;}
  const ext=event.target.closest('[data-external-code]');
  if(ext){const p=externalProducts.get(ext.dataset.externalCode);if(p)openExternalFood(p);return;}
  const edit=event.target.closest('[data-food-edit]');
  if(edit){const f=getDietV2Model()?.food?.savedFoods?.find(x=>String(x.id)===String(edit.dataset.foodEdit));if(f)openSavedFood(f);return;}
  const fav=event.target.closest('[data-food-favorite]');if(fav){toggleFoodFavorite(fav.dataset.foodFavorite);return;}
  const del=event.target.closest('[data-food-delete]');if(del){removeFood(del.dataset.foodDelete);return;}
  const mf=event.target.closest('[data-saved-meal-favorite]');if(mf){toggleMealFavorite(mf.dataset.savedMealFavorite);return;}
  const md=event.target.closest('[data-saved-meal-delete]');if(md){removeSavedMeal(md.dataset.savedMealDelete);return;}
  const close=event.target.closest('[data-close-dialog]');
  if(close){const d=document.getElementById(close.dataset.closeDialog);if(d?.open)d.close();}
});
$('foodLibraryFilter')?.addEventListener('input',renderLibrary);
$('foodLibraryNew')?.addEventListener('click',openNewFood);
$('foodShortcutOnline')?.addEventListener('click',()=>onlineSearch({barcode:false}));
$('foodShortcutBarcode')?.addEventListener('click',()=>{
  const input=$('foodSearchInput');
  if(/^\d{8,14}$/.test(String(input?.value??'').replace(/\D/g,'')))onlineSearch({barcode:true});
  else{input.placeholder='Enter barcode, then press Enter';input.focus();input.select();}
});
$('foodSearchInput')?.addEventListener('keydown',event=>{
  if(event.key!=='Enter')return;
  event.preventDefault();
  const digits=String(event.currentTarget.value??'').replace(/\D/g,'');
  onlineSearch({barcode:/^\d{8,14}$/.test(digits)});
});
$('foodEditorGrams')?.addEventListener('input',rescaleExternal);
$('foodEditorSaveOnly')?.addEventListener('click',()=>saveCurrent({log:false}).catch(error=>toast(error?.message||'Food could not be saved.')));
editorForm?.addEventListener('submit',event=>{event.preventDefault();saveCurrent({log:true}).catch(error=>toast(error?.message||'Food could not be saved.'));});
window.addEventListener('diet-v2-data-updated',()=>{if(libraryDialog?.open)renderLibrary();});
