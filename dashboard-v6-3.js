'use strict';

// V6.3 — Food Intelligence & Memory 2.0.
// This layer stays passive in the dashboard. It learns from foods already logged
// through ChatGPT and surfaces useful memory in Insights without adding manual
// logging or management controls to Today.

function v63EnsureShape(){
  dashboard.foodPortions ||= [];
}

async function v63LoadFoodPortions(){
  v63EnsureShape();
  if(!cloud.client||!cloud.user)return;
  const {data,error}=await cloud.client
    .from('saved_food_portions')
    .select('id,saved_food_id,multiplier,quantity_text,use_count,last_used_at,updated_at')
    .order('use_count',{ascending:false});
  if(error)throw error;
  dashboard.foodPortions=(data||[]).map(x=>({
    id:x.id,
    savedFoodId:x.saved_food_id,
    multiplier:Number(x.multiplier||1),
    quantity:x.quantity_text||'',
    useCount:Number(x.use_count||0),
    lastUsedAt:x.last_used_at,
    updatedAt:x.updated_at
  }));
  saveDashboardCache();
}

function v63UsualPortion(foodId){
  v63EnsureShape();
  return [...dashboard.foodPortions]
    .filter(p=>p.savedFoodId===foodId)
    .sort((a,b)=>b.useCount-a.useCount || String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||'')))[0]||null;
}

function v63PortionLabel(food,portion){
  if(!portion)return food.quantity||'';
  if(portion.quantity)return portion.quantity;
  if(Math.abs(Number(portion.multiplier||1)-1)<.001)return food.quantity||'usual portion';
  return `${fmt(portion.multiplier,2)} × ${food.quantity||'saved portion'}`;
}

function v63ScaleFoodToUsual(food){
  const portion=v63UsualPortion(food.id);
  const mult=portion?Number(portion.multiplier||1):1;
  const scale=v=>v==null?null:Number(v)*mult;
  return {
    ...food,
    calories:scale(food.calories),
    protein:scale(food.protein),
    carbs:scale(food.carbs),
    fat:scale(food.fat),
    fiber:scale(food.fiber),
    usualMultiplier:mult,
    usualQuantity:v63PortionLabel(food,portion),
    portionUseCount:portion?.useCount||0
  };
}

// V6.2 food suggestions now use the user's learned usual amount rather than
// blindly assuming the saved base portion when enough portion history exists.
if(typeof v62FoodSuggestions==='function'){
  v62FoodSuggestions=function v63FoodSuggestions(d,limit=2){
    if(!['calories_tight','protein_priority','fiber_priority'].includes(d.state))return [];
    return [...(dashboard.savedFoods||[])]
      .filter(f=>Number(f.calories||0)>0)
      .map(base=>{
        const food=v63ScaleFoodToUsual(base);
        const score=v62FoodScore(food,d)+Math.min(food.portionUseCount||0,6)*.75;
        return {food,score};
      })
      .filter(x=>Number.isFinite(x.score))
      .sort((a,b)=>b.score-a.score || Number(b.food.useCount||0)-Number(a.food.useCount||0))
      .slice(0,limit)
      .map(x=>({...x.food,why:v62FoodWhy(x.food,d),score:x.score}));
  };
}

if(typeof v62GuidanceMarkup==='function'){
  v62GuidanceMarkup=function v63GuidanceMarkup(d){
    const suggestions=v62FoodSuggestions(d,2);
    const uncertainty=d.uncertaintyMaterial
      ? `<div class="v62-uncertainty"><strong>Estimate uncertainty matters</strong><span>Today is roughly ${fmt(d.caloriesLow)}–${fmt(d.caloriesHigh)} kcal from the stored ranges, so do not over-correct the point estimate.</span></div>`
      : '';
    const foodRows=suggestions.length?`<div class="v62-food-fit"><span>Best fit from remembered foods</span>${suggestions.map(f=>`<div class="v62-food-row"><div><strong>${esc(f.name)}</strong><small>${esc(f.why)}${f.usualQuantity?` · usual ${esc(f.usualQuantity)}`:''}</small></div><div><b>${fmt(f.protein,1)} g</b><small>${fmt(f.calories)} kcal</small></div></div>`).join('')}</div>`:'';
    const fiberLabel=d.fiberComplete?`${fmt(d.fiberRemaining,1)} g fiber left`:`${fmt(d.fiber,1)} g known fiber`;
    return `<section class="v62-guidance ${esc(d.state)}" aria-label="Today's guidance">
      <div class="v62-guidance-head"><div><span>Today's guidance</span><strong>${esc(d.title)}</strong></div><small>${d.exactRate==null?'':`${d.exactRate}% exact / reused`}</small></div>
      <p>${esc(d.copy)}</p>
      <div class="v62-guidance-metrics"><span><b>${fmt(Math.max(0,d.calRemaining))}</b> kcal left</span><span><b>${fmt(d.proteinRemaining,1)}</b> g protein left</span><span><b>${esc(fiberLabel)}</b></span></div>
      ${uncertainty}${foodRows}
    </section>`;
  };
}

function v63RecentCutoff(days=90){
  const d=new Date(`${localDateKey()}T12:00:00`);
  d.setDate(d.getDate()-Math.max(1,days)+1);
  return d.toISOString().slice(0,10);
}

function v63MealPatterns(days=90){
  const cutoff=v63RecentCutoff(days), map=new Map();
  for(const meal of dashboard.meals||[]){
    if(!meal.date||meal.date<cutoff)continue;
    for(const item of meal.items||[]){
      if(!item.savedFoodId)continue;
      const key=`${item.savedFoodId}|${meal.type||'Other'}`;
      const prev=map.get(key)||{savedFoodId:item.savedFoodId,name:item.name||'Food',mealType:meal.type||'Other',uses:0,lastUsed:meal.date};
      prev.uses+=1;
      if(meal.date>prev.lastUsed)prev.lastUsed=meal.date;
      map.set(key,prev);
    }
  }
  return [...map.values()].filter(x=>x.uses>=2).sort((a,b)=>b.uses-a.uses||b.lastUsed.localeCompare(a.lastUsed));
}

function v63Pairings(days=90){
  const cutoff=v63RecentCutoff(days), map=new Map();
  for(const meal of dashboard.meals||[]){
    if(!meal.date||meal.date<cutoff)continue;
    const unique=[...new Map((meal.items||[]).filter(i=>i.savedFoodId).map(i=>[i.savedFoodId,i])).values()];
    for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
      const pair=[unique[i],unique[j]].sort((a,b)=>String(a.savedFoodId).localeCompare(String(b.savedFoodId)));
      const key=`${pair[0].savedFoodId}|${pair[1].savedFoodId}`;
      const prev=map.get(key)||{nameA:pair[0].name||'Food',nameB:pair[1].name||'Food',uses:0,lastUsed:meal.date};
      prev.uses+=1;
      if(meal.date>prev.lastUsed)prev.lastUsed=meal.date;
      map.set(key,prev);
    }
  }
  return [...map.values()].filter(x=>x.uses>=2).sort((a,b)=>b.uses-a.uses||b.lastUsed.localeCompare(a.lastUsed));
}

function v63MemoryStats(){
  v63EnsureShape();
  const foods=dashboard.savedFoods||[];
  const aliases=foods.reduce((n,f)=>n+(f.aliases||[]).length,0);
  const barcodes=foods.filter(f=>f.barcode&&f.verifiedAt).length;
  const favorites=foods.filter(f=>f.favorite).length;
  const learnedFoods=new Set(dashboard.foodPortions.map(p=>p.savedFoodId)).size;
  const patterns=v63MealPatterns(90);
  const pairings=v63Pairings(90);
  return {foods,aliases,barcodes,favorites,learnedFoods,patterns,pairings};
}

function v63TopFoodRows(foods){
  const top=[...foods].sort((a,b)=>Number(b.useCount||0)-Number(a.useCount||0)||String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||''))).slice(0,4);
  if(!top.length)return '<div class="v53-empty">Food memory will build automatically as exact foods are logged through ChatGPT.</div>';
  return `<div class="v63-memory-list">${top.map(food=>{
    const portion=v63UsualPortion(food.id);
    const label=v63PortionLabel(food,portion);
    const badges=[];
    if(food.favorite)badges.push('favorite');
    if(food.barcode&&food.verifiedAt)badges.push('verified barcode');
    return `<div class="v63-memory-row"><div><strong>${esc(food.name)}</strong><small>${label?`usual ${esc(label)}`:'portion still learning'}${badges.length?` · ${esc(badges.join(' · '))}`:''}</small></div><div><b>${fmt(food.protein,1)} g</b><small>${fmt(food.calories)} kcal saved</small></div></div>`;
  }).join('')}</div>`;
}

function v63PatternRows(patterns,pairings){
  const rows=[];
  for(const p of patterns.slice(0,3))rows.push(`<div class="v63-pattern-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.mealType)} pattern</small></div><b>${p.uses}×</b></div>`);
  for(const p of pairings.slice(0,2))rows.push(`<div class="v63-pattern-row"><div><strong>${esc(p.nameA)} + ${esc(p.nameB)}</strong><small>Repeated together</small></div><b>${p.uses}×</b></div>`);
  return rows.length?`<div class="v63-pattern-list">${rows.join('')}</div>`:'<div class="v53-empty">No repeated meal pattern is strong enough yet. This appears automatically after repeat use.</div>';
}

function v63FoodIntelligenceMarkup(){
  const s=v63MemoryStats();
  return `<section class="v63-food-intelligence">
    <div class="v6-section-head"><div><span>Memory 2.0</span><h3>Food intelligence</h3></div><small>Learned automatically</small></div>
    <div class="v63-memory-stats">
      <div><span>Saved foods</span><strong>${s.foods.length}</strong></div>
      <div><span>Learned portions</span><strong>${s.learnedFoods}</strong></div>
      <div><span>Aliases</span><strong>${s.aliases}</strong></div>
      <div><span>Verified barcodes</span><strong>${s.barcodes}</strong></div>
    </div>
    <div class="v63-memory-columns">
      <div class="v63-memory-block"><div class="v63-block-head"><strong>Remembered foods</strong><small>Most used first</small></div>${v63TopFoodRows(s.foods)}</div>
      <div class="v63-memory-block"><div class="v63-block-head"><strong>Recognized routines</strong><small>Last 90 days</small></div>${v63PatternRows(s.patterns,s.pairings)}</div>
    </div>
    <p class="v63-memory-note">Aliases, usual portions and meal patterns are learned from normal ChatGPT logging. The dashboard remains read-only.</p>
  </section>`;
}

const v63RenderInsightsBase=renderInsights;
renderInsights=function renderInsightsV63(){
  const result=v63RenderInsightsBase();
  const root=app.querySelector('.p3-insights-view');
  if(!root)return result;
  root.querySelector('.v63-food-intelligence')?.remove();
  const coach=root.querySelector('.v6-coach');
  if(coach)coach.insertAdjacentHTML('afterend',v63FoodIntelligenceMarkup());
  else root.insertAdjacentHTML('afterbegin',v63FoodIntelligenceMarkup());
  return result;
};

const v63RefreshBase=refreshData;
refreshData=async function refreshDataV63(options={}){
  await v63RefreshBase(options);
  if(!cloud.user)return;
  try{
    await v63LoadFoodPortions();
    render();
  }catch(error){
    console.warn('V6.3 food memory refresh failed',error);
  }
};

// Preserve the no-Quick-Capture product invariant and enrich an already-open
// session without waiting for a manual refresh.
queueMicrotask(()=>{
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  v63EnsureShape();
  if(cloud.user)v63LoadFoodPortions().then(()=>render()).catch(error=>console.warn('V6.3 bootstrap failed',error));
});
