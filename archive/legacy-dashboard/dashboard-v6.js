'use strict';

// V6 — low-friction capture, barcode lookup, recipes, activity surface and
// clearer coaching. Nutrition writes remain ChatGPT-controlled; the dashboard
// only reads Diet Copilot data and prepares/share prompts for ChatGPT.

function v6EnsureShape() {
  dashboard.activityDays ||= [];
  dashboard.savedMeals ||= [];
  dashboard.recipeItems ||= {};
}

function v6ActivityFor(date) {
  v6EnsureShape();
  return dashboard.activityDays.find(x => x.date === date) || null;
}

function v6Recipes() {
  v6EnsureShape();
  return dashboard.savedMeals.filter(x => x.isRecipe);
}

async function v6LoadExtras() {
  if (!cloud.client || !cloud.user) return;
  const [activity, meals, items] = await Promise.all([
    cloud.client.from('activity_daily').select('activity_date,steps,active_calories,exercise_minutes,distance_km,resting_heart_rate,source,synced_at,updated_at').order('activity_date'),
    cloud.client.from('saved_meals').select('id,name,meal_type,calories,protein,carbs,fat,fiber,aliases,favorite,use_count,last_used_at,photo_url,is_recipe,servings,serving_text,recipe_notes,updated_at').order('use_count',{ascending:false}).limit(100),
    cloud.client.from('saved_meal_items').select('id,saved_meal_id,saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber,confidence,source,sort_order').order('sort_order')
  ]);
  for (const result of [activity, meals, items]) if (result.error) throw result.error;

  const byMeal = {};
  (items.data || []).forEach(item => {
    (byMeal[item.saved_meal_id] ||= []).push({
      id:item.id,savedFoodId:item.saved_food_id,name:item.name,quantity:item.quantity_text||'',
      calories:Number(item.calories||0),protein:Number(item.protein||0),
      carbs:item.carbs==null?null:Number(item.carbs),fat:item.fat==null?null:Number(item.fat),fiber:item.fiber==null?null:Number(item.fiber),
      confidence:item.confidence,source:item.source,sortOrder:Number(item.sort_order||0)
    });
  });

  dashboard.activityDays = (activity.data || []).map(x => ({
    date:x.activity_date,steps:x.steps==null?null:Number(x.steps),activeCalories:x.active_calories==null?null:Number(x.active_calories),
    exerciseMinutes:x.exercise_minutes==null?null:Number(x.exercise_minutes),distanceKm:x.distance_km==null?null:Number(x.distance_km),
    restingHeartRate:x.resting_heart_rate==null?null:Number(x.resting_heart_rate),source:x.source,syncedAt:x.synced_at,updatedAt:x.updated_at
  }));

  dashboard.savedMeals = (meals.data || []).map(x => ({
    id:x.id,name:x.name,mealType:x.meal_type,calories:x.calories==null?null:Number(x.calories),protein:x.protein==null?null:Number(x.protein),
    carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],
    favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,
    isRecipe:Boolean(x.is_recipe),servings:x.servings==null?null:Number(x.servings),servingText:x.serving_text||'',recipeNotes:x.recipe_notes||'',
    items:byMeal[x.id]||[],updatedAt:x.updated_at
  }));
  dashboard.recipeItems = byMeal;
  saveDashboardCache();
}

const v6RefreshBase = refreshData;
refreshData = async function refreshDataV6(options={}) {
  await v6RefreshBase(options);
  if (!cloud.user) return;
  try {
    await v6LoadExtras();
    render();
  } catch (error) {
    console.warn('V6 extras refresh failed', error);
  }
};

function v6Icon(name) {
  const icons = {
    text:'<path d="M5 6h14M5 12h10M5 18h7"/>',
    camera:'<path d="M4 8h4l2-3h4l2 3h4v11H4Z"/><circle cx="12" cy="13" r="3"/>',
    barcode:'<path d="M5 5v14M8 5v14M12 5v14M15 5v14M19 5v14"/>',
    recipe:'<path d="M7 4h10v16H7z"/><path d="M10 8h4M10 12h4M10 16h3"/>',
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',
    share:'<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    steps:'<path d="M8 5c1.8 0 3 1.3 3 3.2 0 2.2-1.2 4.1-3.3 5.8C6.2 15.2 5 16.6 5 18.2 5 19.8 6.2 21 8 21s3-1.2 3-3c0-1.4-.8-2.4-2.1-3.5"/><path d="M16 3c1.8 0 3 1.2 3 3 0 1.6-1.2 3-2.7 4.2-2.1 1.7-3.3 3.6-3.3 5.8 0 1.9 1.2 3.2 3 3.2s3-1.2 3-2.8c0-1.6-1.2-3-2.7-4.2"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.text}</svg>`;
}

function v6CaptureMarkup() {
  return `<section class="v6-capture-card" aria-label="Quick capture">
    <div class="v6-section-head"><div><span>Quick capture</span><h3>Log without hunting through menus</h3></div><small>ChatGPT remains the logger</small></div>
    <div class="v6-capture-grid">
      <button type="button" data-v6-capture="text">${v6Icon('text')}<span><strong>Describe meal</strong><small>Type or dictate</small></span></button>
      <button type="button" data-v6-capture="photo">${v6Icon('camera')}<span><strong>Photo</strong><small>Share straight to ChatGPT</small></span></button>
      <button type="button" data-v6-capture="barcode">${v6Icon('barcode')}<span><strong>Barcode</strong><small>Scan packaged food</small></span></button>
      <button type="button" data-v6-capture="recipe">${v6Icon('recipe')}<span><strong>Recipe</strong><small>Reuse a saved recipe</small></span></button>
    </div>
  </section>`;
}

function v6EnsureCaptureDialog() {
  let dialog = document.getElementById('v6CaptureDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'v6CaptureDialog';
  dialog.className = 'v6-dialog';
  dialog.innerHTML = `<div class="v6-sheet"><header><div><span id="v6DialogEyebrow">Quick capture</span><h2 id="v6DialogTitle">Log with ChatGPT</h2></div><button type="button" class="v6-close" aria-label="Close">×</button></header><div id="v6DialogBody" class="v6-dialog-body"></div></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('.v6-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{ if(e.target===dialog) dialog.close(); });
  dialog.addEventListener('close',v6StopBarcodeCamera);
  return dialog;
}

function v6OpenDialog(title, body, eyebrow='Quick capture') {
  const dialog = v6EnsureCaptureDialog();
  dialog.querySelector('#v6DialogEyebrow').textContent = eyebrow;
  dialog.querySelector('#v6DialogTitle').textContent = title;
  dialog.querySelector('#v6DialogBody').innerHTML = body;
  if (!dialog.open) dialog.showModal();
  return dialog;
}

async function v6Copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const area=document.createElement('textarea'); area.value=text; area.style.position='fixed'; area.style.opacity='0'; document.body.appendChild(area); area.select();
    const ok=document.execCommand('copy'); area.remove(); return ok;
  }
}

async function v6CopyAndOpenChatGPT(prompt) {
  await v6Copy(prompt);
  showToast('Copied for ChatGPT');
  window.open('https://chatgpt.com/','_blank','noopener');
}

function v6OpenTextCapture() {
  const dialog=v6OpenDialog('Describe what you ate',`<div class="v6-capture-form"><label for="v6MealText">Meal or snack</label><textarea id="v6MealText" rows="6" placeholder="e.g. two eggs, toast with butter and an apple"></textarea><div class="v6-form-row"><button type="button" class="v6-secondary" id="v6DictateBtn">${v6Icon('mic')} Dictate</button><button type="button" class="v6-primary" id="v6SendTextBtn">Open ChatGPT</button></div><p class="v6-helper">The description is copied first, then ChatGPT opens. Your normal Diet Copilot logging rules still apply.</p></div>`);
  const area=dialog.querySelector('#v6MealText');
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  const dictate=dialog.querySelector('#v6DictateBtn');
  if (!Speech) dictate.disabled=true;
  dictate.addEventListener('click',()=>{
    if(!Speech)return;
    const recognition=new Speech(); recognition.lang=navigator.language||'en-US'; recognition.interimResults=false; recognition.maxAlternatives=1;
    dictate.disabled=true; dictate.textContent='Listening…';
    recognition.onresult=e=>{area.value=[area.value,e.results[0][0].transcript].filter(Boolean).join(' ');};
    recognition.onend=()=>{dictate.disabled=false; dictate.innerHTML=`${v6Icon('mic')} Dictate`;};
    recognition.onerror=recognition.onend; recognition.start();
  });
  dialog.querySelector('#v6SendTextBtn').addEventListener('click',()=>{
    const text=area.value.trim(); if(!text){showToast('Describe the food first');return;}
    v6CopyAndOpenChatGPT(`Log this in Diet Copilot for today: ${text}`);
  });
  setTimeout(()=>area.focus(),50);
}

function v6OpenPhotoCapture() {
  const dialog=v6OpenDialog('Photograph your food',`<div class="v6-photo-capture"><div class="v6-photo-icon">${v6Icon('camera')}</div><p>Take a photo or choose one. On supported phones Diet Copilot opens the share sheet so you can send the image directly to ChatGPT.</p><input id="v6PhotoInput" type="file" accept="image/*" capture="environment"><button type="button" class="v6-primary" id="v6ChoosePhoto">Take / choose photo</button><p class="v6-helper">If file sharing is unavailable, the logging prompt is copied and ChatGPT opens so you can attach the photo there.</p></div>`);
  const input=dialog.querySelector('#v6PhotoInput');
  dialog.querySelector('#v6ChoosePhoto').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0]; if(!file)return;
    const text='Log this food photo in Diet Copilot for today. Estimate portions carefully, include an uncertainty range when needed, and use exact label values if visible.';
    try {
      if(navigator.share && navigator.canShare?.({files:[file]})) {
        await navigator.share({title:'Diet Copilot',text,files:[file]});
        dialog.close(); return;
      }
    } catch(e) { if(e?.name==='AbortError')return; }
    await v6CopyAndOpenChatGPT(text);
  });
}

let v6BarcodeStream=null;
let v6BarcodeFrame=0;
function v6StopBarcodeCamera(){
  cancelAnimationFrame(v6BarcodeFrame); v6BarcodeFrame=0;
  if(v6BarcodeStream){v6BarcodeStream.getTracks().forEach(t=>t.stop());v6BarcodeStream=null;}
}

async function v6LookupBarcode(code) {
  const clean=String(code||'').replace(/\D/g,'');
  const result=document.getElementById('v6BarcodeResult');
  if(!clean){showToast('Enter a barcode');return;}
  if(result) result.innerHTML='<div class="v6-loading">Looking up product…</div>';

  const remembered=(dashboard.savedFoods||[]).find(f=>String(f.barcode||'')===clean);
  if(remembered){
    const prompt=`Log my saved food ${remembered.name} (barcode ${clean}) in Diet Copilot for today. Ask me only if the amount eaten is unclear.`;
    if(result) result.innerHTML=v6BarcodeProductMarkup({name:remembered.name,brand:remembered.brand,barcode:clean,calories:remembered.calories,protein:remembered.protein,carbs:remembered.carbs,fat:remembered.fat,fiber:remembered.fiber,quantity:remembered.quantity,source:'Saved Diet Copilot food'},prompt);
    v6BindBarcodeResult(prompt); return;
  }

  try {
    const url=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=code,product_name,brands,serving_size,nutriments`;
    const response=await fetch(url,{headers:{Accept:'application/json'}}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json(); if(data.status!==1||!data.product)throw new Error('Product not found');
    const p=data.product,n=p.nutriments||{};
    const product={name:p.product_name||'Packaged food',brand:p.brands||'',barcode:clean,quantity:p.serving_size||'per 100 g',calories:n['energy-kcal_100g'],protein:n.proteins_100g,carbs:n.carbohydrates_100g,fat:n.fat_100g,fiber:n.fiber_100g,source:'Open Food Facts'};
    const macro=[['calories',product.calories,'kcal'],['protein',product.protein,'g protein'],['carbs',product.carbs,'g carbs'],['fat',product.fat,'g fat'],['fiber',product.fiber,'g fiber']].filter(([,v])=>v!=null).map(([k,v,u])=>`${v} ${u}/100 g`).join(', ');
    const prompt=`Log this packaged food in Diet Copilot for today. Barcode: ${clean}. Product: ${product.brand?product.brand+' ':''}${product.name}. Open Food Facts lists ${macro||'nutrition values unavailable'}. Ask me how much I ate if I have not specified an amount, and prefer a photographed package label over database values if I provide one.`;
    if(result) result.innerHTML=v6BarcodeProductMarkup(product,prompt); v6BindBarcodeResult(prompt);
  } catch(error) {
    if(result) result.innerHTML=`<div class="v6-barcode-error"><strong>Product not found</strong><p>${esc(error.message||'Lookup failed')}. You can still send barcode ${esc(clean)} to ChatGPT or photograph the nutrition label.</p><button type="button" class="v6-primary" id="v6BarcodeFallback">Open ChatGPT</button></div>`;
    document.getElementById('v6BarcodeFallback')?.addEventListener('click',()=>v6CopyAndOpenChatGPT(`I scanned barcode ${clean}. Help me identify it and log what I ate in Diet Copilot.`));
  }
}

function v6BarcodeProductMarkup(p) {
  const macros=[['Calories',p.calories==null?'—':`${fmt(p.calories)} kcal`],['Protein',p.protein==null?'—':`${fmt(p.protein,1)} g`],['Fiber',p.fiber==null?'—':`${fmt(p.fiber,1)} g`]];
  return `<div class="v6-product"><span>${esc(p.source||'Barcode result')}</span><h3>${esc([p.brand,p.name].filter(Boolean).join(' '))}</h3><small>${esc(p.barcode||'')} · ${esc(p.quantity||'per 100 g')}</small><div class="v6-product-macros">${macros.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><label for="v6BarcodeAmount">Amount eaten</label><input id="v6BarcodeAmount" type="text" inputmode="decimal" placeholder="e.g. 50 g or whole pack"><button type="button" class="v6-primary" id="v6BarcodeLog">Open ChatGPT to log</button><p class="v6-helper">A package photo still outranks crowd-sourced database values.</p></div>`;
}

function v6BindBarcodeResult(basePrompt){
  document.getElementById('v6BarcodeLog')?.addEventListener('click',()=>{
    const amount=document.getElementById('v6BarcodeAmount')?.value.trim();
    v6CopyAndOpenChatGPT(`${basePrompt}${amount?` I ate ${amount}.`:''}`);
  });
}

async function v6StartBarcodeCamera(video,status,input){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){status.textContent='Camera barcode scanning is not supported here. Enter the number manually.';return;}
  try{
    const formats=await BarcodeDetector.getSupportedFormats();
    const preferred=['ean_13','ean_8','upc_a','upc_e'].filter(x=>formats.includes(x));
    const detector=new BarcodeDetector({formats:preferred.length?preferred:formats});
    v6BarcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
    video.srcObject=v6BarcodeStream; await video.play(); status.textContent='Point the camera at the barcode';
    const tick=async()=>{
      if(!v6BarcodeStream)return;
      try{const codes=await detector.detect(video);if(codes?.[0]?.rawValue){input.value=codes[0].rawValue;v6StopBarcodeCamera();status.textContent='Barcode detected';v6LookupBarcode(input.value);return;}}catch{}
      v6BarcodeFrame=requestAnimationFrame(tick);
    }; tick();
  }catch(error){status.textContent=`Camera unavailable: ${error.message||'permission denied'}`;}
}

function v6OpenBarcodeCapture(){
  const dialog=v6OpenDialog('Scan a packaged food',`<div class="v6-barcode"><video id="v6BarcodeVideo" playsinline muted></video><p id="v6BarcodeStatus">Starting camera…</p><div class="v6-barcode-manual"><input id="v6BarcodeInput" inputmode="numeric" autocomplete="off" placeholder="EAN / UPC barcode"><button type="button" class="v6-secondary" id="v6BarcodeLookup">Look up</button></div><div id="v6BarcodeResult"></div></div>`);
  const video=dialog.querySelector('#v6BarcodeVideo'),status=dialog.querySelector('#v6BarcodeStatus'),input=dialog.querySelector('#v6BarcodeInput');
  dialog.querySelector('#v6BarcodeLookup').addEventListener('click',()=>{v6StopBarcodeCamera();v6LookupBarcode(input.value);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();v6StopBarcodeCamera();v6LookupBarcode(input.value);}});
  v6StartBarcodeCamera(video,status,input);
}

function v6RecipePrompt(recipe,multiplier=1){
  const amount=multiplier===1?(recipe.servingText||'1 serving'):`${multiplier} serving${multiplier===1?'':'s'}`;
  return `Log ${amount} of my saved recipe “${recipe.name}” in Diet Copilot for today. Use the saved recipe values and scale the portion exactly; do not re-estimate it.`;
}

function v6OpenRecipeCapture(){
  const recipes=v6Recipes();
  const body=recipes.length?`<div class="v6-recipe-list">${recipes.map(v6RecipeCard).join('')}</div>`:`<div class="v6-empty"><strong>No saved recipes yet</strong><p>Tell ChatGPT the ingredients and total servings once, then Diet Copilot can reuse exact scaled portions later.</p><button type="button" class="v6-primary" id="v6CreateRecipe">Create with ChatGPT</button></div>`;
  const dialog=v6OpenDialog('Saved recipes',body,'Recipe memory');
  dialog.querySelectorAll('[data-v6-recipe-log]').forEach(button=>button.addEventListener('click',()=>{const recipe=recipes.find(r=>r.id===button.dataset.v6RecipeLog);if(recipe)v6CopyAndOpenChatGPT(v6RecipePrompt(recipe,Number(button.dataset.multiplier||1)));}));
  dialog.querySelector('#v6CreateRecipe')?.addEventListener('click',()=>v6CopyAndOpenChatGPT('Create a reusable recipe in Diet Copilot. Ask me for the ingredients, exact package/weight values where available, total servings, and a useful recipe name.'));
}

function v6RecipeCard(recipe){
  const servings=recipe.servings&&recipe.servings>0?recipe.servings:1;
  const cal=recipe.calories==null?null:recipe.calories/servings,pro=recipe.protein==null?null:recipe.protein/servings,fiber=recipe.fiber==null?null:recipe.fiber/servings;
  return `<article class="v6-recipe"><div class="v6-recipe-top"><div><span>${esc(recipe.mealType||'Recipe')}</span><h3>${esc(recipe.name)}</h3><small>${esc(recipe.servingText||`${fmt(servings,1)} total serving${servings===1?'':'s'}`)}</small></div>${recipe.favorite?'<b>★</b>':''}</div><div class="v6-recipe-macros"><span>${cal==null?'—':`${fmt(cal)} kcal`}</span><span>${pro==null?'—':`${fmt(pro,1)} g protein`}</span><span>${fiber==null?'fiber —':`${fmt(fiber,1)} g fiber`}</span></div><div class="v6-recipe-actions"><button type="button" data-v6-recipe-log="${recipe.id}" data-multiplier="1">Log serving</button><button type="button" data-v6-recipe-log="${recipe.id}" data-multiplier="0.5">½ serving</button></div></article>`;
}

function v6TodayActivityMarkup(activity){
  if(!activity)return '';
  return `<section class="today-metric v6-activity" aria-label="Activity"><div class="metric-v2-head"><span class="metric-v2-title">Activity</span><span class="metric-v2-icon">${v6Icon('steps')}</span></div><div class="metric-v2-value">${activity.steps==null?'—':fmt(activity.steps)}</div><div class="metric-v2-sub">${activity.steps==null?'Steps not synced':'steps'}${activity.exerciseMinutes==null?'':` · ${fmt(activity.exerciseMinutes)} min exercise`}</div></section>`;
}

function v6CoachActions(){
  if(typeof v52Metrics!=='function')return [];
  const m=v52Metrics(28), actions=[];
  if(m.loggedDays<7)actions.push({type:'baseline',title:'Keep building the baseline',copy:`${m.loggedDays}/7 logged intake days. Everything already counts; more days will make coaching steadier.`});
  if(m.proteinHitRate!=null&&m.proteinHitRate<70)actions.push({type:'protein',title:'Protein consistency',copy:`Protein target hit rate is ${m.proteinHitRate}%. Aim to make protein easier to hit rather than perfecting every macro.`});
  if(m.avgFiber!=null&&m.fiberTarget&&m.avgFiber<m.fiberTarget)actions.push({type:'fiber',title:'Fiber opportunity',copy:`Known fiber averages ${fmt(m.avgFiber,1)} g vs ${fmt(m.fiberTarget)} g target. Coverage is shown separately.`});
  if(m.calorieHitRate!=null&&m.calorieHitRate<60)actions.push({type:'calories',title:'Calorie consistency',copy:`${m.calorieHitRate}% of logged days are within ±150 kcal of target.`});
  if(m.pace!=null&&m.desired!=null&&Math.abs(m.pace-m.desired)>.15)actions.push({type:'pace',title:'Watch the weight trend',copy:`Observed ${v52Sign(m.pace,2,' kg/week')} vs ${v52Sign(m.desired,2,' kg/week')} planned. Do not change calories from one weigh-in.`});
  const min=Number(dashboard.profile?.adaptiveMinCompleteDays||14),need=Math.max(0,min-m.loggedDays);
  if(need>0)actions.push({type:'calibration',title:'Adaptive calories are still learning',copy:`${need} more logged intake day${need===1?'':'s'} needed before calorie calibration has enough intake history.`});
  if(!actions.length)actions.push({type:'good',title:'No obvious intervention',copy:'Current logged-data consistency and available trend signals do not show a clear change to make.'});
  return actions.slice(0,4);
}

function v6CoachMarkup(){
  const actions=v6CoachActions();
  return `<section class="v6-coach"><div class="v6-section-head"><div><span>Next actions</span><h3>Coach priorities</h3></div><small>Based on logged data</small></div><div class="v6-coach-grid">${actions.map((a,i)=>`<article class="${esc(a.type)}"><b>${i+1}</b><div><strong>${esc(a.title)}</strong><p>${esc(a.copy)}</p></div></article>`).join('')}</div></section>`;
}

function v6HealthMarkup(){
  const bridge=Boolean(window.DietHealthConnect?.syncDailyActivity);
  const latest=[...(dashboard.activityDays||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
  return `<section class="v6-health"><div class="v6-section-head"><div><span>Activity</span><h3>Health Connect</h3></div><small>${bridge?'Bridge detected':'Backend ready'}</small></div><div class="v6-health-card"><div><strong>${latest?.steps!=null?`${fmt(latest.steps)} steps`:'No activity synced yet'}</strong><p>${latest?`${prettyDate(latest.date,{day:'numeric',month:'short'})}${latest.exerciseMinutes!=null?` · ${fmt(latest.exerciseMinutes)} exercise min`:''}`:'Steps, active calories and exercise minutes can be stored separately from food intake.'}</p></div>${bridge?'<button type="button" id="v6HealthSync" class="v6-secondary">Sync now</button>':'<span class="v6-health-note">Direct Android Health Connect access needs the native bridge. Until then, tell ChatGPT your steps/activity and it can store them.</span>'}</div></section>`;
}

async function v6SyncHealth(){
  if(!window.DietHealthConnect?.syncDailyActivity)return;
  const button=document.getElementById('v6HealthSync'); if(button){button.disabled=true;button.textContent='Syncing…';}
  try{await window.DietHealthConnect.syncDailyActivity();await refreshData({silent:true});showToast('Health activity synced');}
  catch(error){showToast(`Health sync failed: ${error.message||error}`);}
  finally{if(button){button.disabled=false;button.textContent='Sync now';}}
}

const v6RenderTodayBase=renderToday;
renderToday=function renderTodayV6(){
  const result=v6RenderTodayBase(); v6EnsureShape();
  const root=app.querySelector('.today-v2'); if(!root)return result;
  const metrics=root.querySelector('.today-metrics');
  if(metrics&&!root.querySelector('.v6-capture-card'))metrics.insertAdjacentHTML('beforebegin',v6CaptureMarkup());
  const activity=v6ActivityFor(localDateKey());
  if(activity&&metrics&&!metrics.querySelector('.v6-activity'))metrics.insertAdjacentHTML('beforeend',v6TodayActivityMarkup(activity));
  root.querySelectorAll('[data-v6-capture]').forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.v6Capture;
    if(mode==='text')v6OpenTextCapture(); else if(mode==='photo')v6OpenPhotoCapture(); else if(mode==='barcode')v6OpenBarcodeCapture(); else v6OpenRecipeCapture();
  }));
  return result;
};

const v6RenderInsightsBase=renderInsights;
renderInsights=function renderInsightsV6(){
  const result=v6RenderInsightsBase(); v6EnsureShape();
  const root=app.querySelector('.p3-insights-view'); if(!root)return result;
  if(!root.querySelector('.v6-coach'))root.insertAdjacentHTML('afterbegin',v6CoachMarkup());
  if(!root.querySelector('.v6-health'))root.insertAdjacentHTML('beforeend',v6HealthMarkup());
  const recipes=v6Recipes();
  if(!root.querySelector('.v6-recipes-section'))root.insertAdjacentHTML('beforeend',`<section class="v6-recipes-section"><div class="v6-section-head"><div><span>Reusable food</span><h3>Recipes</h3></div><button type="button" class="v6-link" id="v6OpenRecipes">${recipes.length?`${recipes.length} saved`:'Create one'}</button></div>${recipes.length?`<div class="v6-recipe-preview">${recipes.slice(0,3).map(v6RecipeCard).join('')}</div>`:'<p class="v6-muted">Save a recipe once with ingredients and total servings, then log half, one or multiple servings without re-estimating.</p>'}</section>`);
  root.querySelector('#v6HealthSync')?.addEventListener('click',v6SyncHealth);
  root.querySelector('#v6OpenRecipes')?.addEventListener('click',v6OpenRecipeCapture);
  root.querySelectorAll('[data-v6-recipe-log]').forEach(button=>button.addEventListener('click',()=>{const recipe=recipes.find(r=>r.id===button.dataset.v6RecipeLog);if(recipe)v6CopyAndOpenChatGPT(v6RecipePrompt(recipe,Number(button.dataset.multiplier||1)));}));
  return result;
};

// If this layer loads after the initial cloud bootstrap, enrich the first view
// once a session is already available.
queueMicrotask(()=>{
  v6EnsureShape();
  if(cloud.user)v6LoadExtras().then(()=>render()).catch(error=>console.warn('V6 bootstrap failed',error));
});
