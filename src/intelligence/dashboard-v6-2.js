'use strict';

// V6.2 — Smart Diet Coach & Decision Engine.
// This layer is intentionally passive on Today: it interprets existing data and
// never adds a logging control or an extra step between the user and ChatGPT.

function v62ExactSource(source) {
  return ['nutrition_label','weighed','manual_exact','saved_food','saved_meal','saved_recipe'].includes(String(source||''));
}

function v62TodayDecision() {
  if (typeof v5EnsureDashboardShape === 'function') v5EnsureDashboardShape();
  const date = localDateKey();
  const meals = mealsFor(date);
  if (!meals.length) return null;

  const totals = totalsFor(date);
  const target = targetsFor(date);
  const fiber = v5MacroForDate(date,'fiber');
  const fiberTarget = Number(dashboard.profile?.fiberTarget || 30);
  const calRemaining = Number(target.calories||0) - Number(totals.calories||0);
  const proteinRemaining = Math.max(0, Number(target.protein||0) - Number(totals.protein||0));
  const fiberRemaining = Math.max(0, fiberTarget - Number(fiber.value||0));
  const caloriesLow = meals.reduce((sum,m)=>sum+Number(m.caloriesLow ?? m.calories ?? 0),0);
  const caloriesHigh = meals.reduce((sum,m)=>sum+Number(m.caloriesHigh ?? m.calories ?? 0),0);
  const exactMeals = meals.filter(m=>v62ExactSource(m.source)).length;
  const rangeWidth = Math.max(0,caloriesHigh-caloriesLow);
  const localHour = new Date().getHours();

  let state='on_track', title='Day is still flexible', copy=`About ${fmt(Math.max(0,calRemaining))} kcal remain with ${fmt(proteinRemaining,1)} g protein still available to target.`;
  if (Number(totals.calories||0) >= Number(target.calories||0)+150) {
    state='over_target'; title='Above calorie target'; copy='No compensation is required from one day. If you eat again, prioritize hunger, protein and fiber rather than trying to correct the number.';
  } else if (calRemaining <= 250 && proteinRemaining >= 25) {
    state='calories_tight'; title='Protein is the constraint'; copy=`About ${fmt(Math.max(0,calRemaining))} kcal remain while ${fmt(proteinRemaining,1)} g protein is still needed. If you eat again, a lean protein source fits best.`;
  } else if (proteinRemaining >= 35 && calRemaining >= 250) {
    state='protein_priority'; title='Protein is the priority'; copy=`${fmt(proteinRemaining,1)} g protein remains with about ${fmt(calRemaining)} kcal available.`;
  } else if (fiberRemaining >= 10 && calRemaining >= 250) {
    state='fiber_priority'; title='Fiber is the clearest gap'; copy=`Known fiber is ${fmt(fiberRemaining,1)} g below target with about ${fmt(calRemaining)} kcal available.`;
  } else if (localHour >= 20 && calRemaining >= 500) {
    state='room_left'; title='Plenty of room remains'; copy=`About ${fmt(calRemaining)} kcal remain. There is no need to force food if you are not hungry, but the day is still well below target.`;
  } else if (calRemaining >= -150 && calRemaining <= 250 && proteinRemaining <= 20 && fiberRemaining <= 8) {
    state='no_action_needed'; title='No correction needed'; copy='Calories and the main nutrition targets are close enough that there is no useful adjustment to make.';
  }

  return {
    date, meals, state, title, copy,
    calories:Number(totals.calories||0), protein:Number(totals.protein||0), fiber:Number(fiber.value||0),
    calorieTarget:Number(target.calories||0), proteinTarget:Number(target.protein||0), fiberTarget,
    calRemaining, proteinRemaining, fiberRemaining,
    caloriesLow, caloriesHigh, rangeWidth,
    exactMeals, estimatedMeals:Math.max(0,meals.length-exactMeals), exactRate:meals.length?Math.round(exactMeals/meals.length*100):null,
    fiberComplete:fiber.complete, fiberUnknown:fiber.unknown, uncertaintyMaterial:rangeWidth>=300
  };
}

function v62FoodScore(food, d) {
  const calories=Number(food.calories||0), protein=Number(food.protein||0), fiber=food.fiber==null?null:Number(food.fiber);
  if (!(calories>0)) return -Infinity;
  let fit=0;
  if (d.calRemaining<=250) {
    if (calories<=Math.max(75,d.calRemaining+25)) fit+=27;
    else if (calories<=Math.max(150,d.calRemaining+100)) fit+=7;
    else fit-=25;
  } else if (calories<=d.calRemaining+75) fit+=18;
  else if (calories<=d.calRemaining+200) fit+=4;
  else fit-=18;

  if (d.proteinRemaining>0) fit+=Math.min(45,(protein/Math.max(1,d.proteinRemaining))*45);
  if (d.fiberRemaining>0 && fiber!=null) fit+=Math.min(20,(fiber/Math.max(1,d.fiberRemaining))*20);
  fit+=Math.min(18,(protein/calories*100)*0.9);
  if (food.favorite) fit+=4;
  fit+=Math.min(Number(food.useCount||0),10)*0.4;
  return fit;
}

function v62FoodWhy(food, d) {
  const calories=Number(food.calories||0), protein=Number(food.protein||0), fiber=food.fiber==null?null:Number(food.fiber);
  const proteinEfficiency=calories>0?protein/calories*100:0;
  if (d.state==='calories_tight' && calories<=Math.max(150,d.calRemaining+75) && proteinEfficiency>=10) return 'high protein for the calories';
  if (proteinEfficiency>=12) return 'protein-efficient';
  if (fiber!=null && fiber>=4) return 'fiber-efficient';
  if (d.calories+calories<=d.calorieTarget+150) return 'fits today';
  return 'familiar saved food';
}

function v62FoodSuggestions(d, limit=2) {
  if (!['calories_tight','protein_priority','fiber_priority'].includes(d.state)) return [];
  return [...(dashboard.savedFoods||[])]
    .filter(f=>Number(f.calories||0)>0)
    .map(f=>({food:f,score:v62FoodScore(f,d)}))
    .filter(x=>Number.isFinite(x.score))
    .sort((a,b)=>b.score-a.score || Number(b.food.useCount||0)-Number(a.food.useCount||0))
    .slice(0,limit)
    .map(x=>({...x.food,why:v62FoodWhy(x.food,d),score:x.score}));
}

function v62GuidanceMarkup(d) {
  const suggestions=v62FoodSuggestions(d,2);
  const uncertainty=d.uncertaintyMaterial
    ? `<div class="v62-uncertainty"><strong>Estimate uncertainty matters</strong><span>Today is roughly ${fmt(d.caloriesLow)}–${fmt(d.caloriesHigh)} kcal from the stored ranges, so do not over-correct the point estimate.</span></div>`
    : '';
  const foodRows=suggestions.length?`<div class="v62-food-fit"><span>Best fit from saved foods</span>${suggestions.map(f=>`<div class="v62-food-row"><div><strong>${esc(f.name)}</strong><small>${esc(f.why)}</small></div><div><b>${fmt(f.protein,1)} g</b><small>${fmt(f.calories)} kcal</small></div></div>`).join('')}</div>`:'';
  const fiberLabel=d.fiberComplete?`${fmt(d.fiberRemaining,1)} g fiber left`:`${fmt(d.fiber,1)} g known fiber`;
  return `<section class="v62-guidance ${esc(d.state)}" aria-label="Today's guidance">
    <div class="v62-guidance-head"><div><span>Today's guidance</span><strong>${esc(d.title)}</strong></div><small>${d.exactRate==null?'':`${d.exactRate}% exact / reused`}</small></div>
    <p>${esc(d.copy)}</p>
    <div class="v62-guidance-metrics"><span><b>${fmt(Math.max(0,d.calRemaining))}</b> kcal left</span><span><b>${fmt(d.proteinRemaining,1)}</b> g protein left</span><span><b>${esc(fiberLabel)}</b></span></div>
    ${uncertainty}${foodRows}
  </section>`;
}

function v62CoachActions() {
  if (typeof v52Metrics!=='function') return [];
  const m=v52Metrics(28), actions=[];
  const today=v62TodayDecision();
  if (today && !['no_action_needed','on_track'].includes(today.state)) actions.push({type:today.state,title:today.title,copy:today.copy});
  if (m.loggedDays<7) actions.push({type:'baseline',title:'Keep building the baseline',copy:`${m.loggedDays}/7 logged intake days. All logged data already counts; more days make trend decisions steadier.`});
  if (m.proteinHitRate!=null&&m.proteinHitRate<70) actions.push({type:'protein',title:'Make protein easier to hit',copy:`Protein reached target on ${m.proteinHitRate}% of logged days. Improving convenience is more useful than chasing perfect macros.`});
  if (m.avgFiber!=null&&m.fiberTarget&&m.avgFiber<m.fiberTarget) actions.push({type:'fiber',title:'Fiber remains a recurring gap',copy:`Known fiber averages ${fmt(m.avgFiber,1)} g against a ${fmt(m.fiberTarget)} g target. Missing fiber stays unknown rather than becoming zero.`});
  if (m.calorieHitRate!=null&&m.calorieHitRate<60) actions.push({type:'calories',title:'Calorie consistency is the bigger lever',copy:`${m.calorieHitRate}% of logged days are within ±150 kcal of target.`});
  if (m.pace!=null&&m.desired!=null&&Math.abs(m.pace-m.desired)>.15) actions.push({type:'pace',title:'Weight pace differs from plan',copy:`Observed ${v52Sign(m.pace,2,' kg/week')} versus ${v52Sign(m.desired,2,' kg/week')} planned. Wait for trend evidence before changing calories.`});
  if (m.exactRate!=null&&m.exactRate<50) actions.push({type:'confidence',title:'Treat precision cautiously',copy:`Only ${m.exactRate}% of recent meals are exact or reused. Large photo/restaurant estimates should not trigger aggressive corrections.`});
  const min=Number(dashboard.profile?.adaptiveMinCompleteDays||14),need=Math.max(0,min-m.loggedDays);
  if (need>0) actions.push({type:'calibration',title:'Adaptive calories are still learning',copy:`${need} more logged intake day${need===1?'':'s'} are needed before calibration has enough intake history.`});
  if (!actions.length) actions.push({type:'good',title:'No obvious intervention',copy:'Current logged intake and available trend data do not show a clear change to make.'});
  return actions.slice(0,4);
}

if (typeof v6CoachActions === 'function') v6CoachActions=v62CoachActions;
if (typeof v6CoachMarkup === 'function') {
  v6CoachMarkup=function v62CoachMarkup(){
    const actions=v62CoachActions();
    const m=typeof v52Metrics==='function'?v52Metrics(28):null;
    const confidence=m?.exactRate==null?'Building data quality':`${m.exactRate}% exact / reused`;
    return `<section class="v6-coach v62-coach"><div class="v6-section-head"><div><span>Decision engine</span><h3>Coach priorities</h3></div><small>${esc(confidence)}</small></div><div class="v6-coach-grid">${actions.map((a,i)=>`<article class="${esc(a.type)}"><b>${i+1}</b><div><strong>${esc(a.title)}</strong><p>${esc(a.copy)}</p></div></article>`).join('')}</div></section>`;
  };
}

// Wrap the final Today renderer after V6.1.2. The Quick Capture invariant is
// reinforced here so future V6 changes cannot accidentally bring it back.
const v62RenderTodayBase=renderToday;
renderToday=function renderTodayV62(){
  const result=v62RenderTodayBase();
  const root=app.querySelector('.today-v2');
  root?.querySelector('.v6-capture-card')?.remove();
  if(!root)return result;
  root.querySelector('.v62-guidance')?.remove();
  const decision=v62TodayDecision();
  const metrics=root.querySelector('.today-metrics');
  if(decision&&metrics)metrics.insertAdjacentHTML('afterend',v62GuidanceMarkup(decision));
  return result;
};

// Re-render once after this layer is installed so an already-open Today or
// Insights view receives V6.2 without waiting for the next realtime event.
queueMicrotask(()=>{
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  if(typeof render==='function')render();
});
