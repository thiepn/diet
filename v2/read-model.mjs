import { mapLegacyDietData } from '../src/engine/legacy-data-adapter.mjs';
import { runAdaptiveNutritionEngine } from '../src/engine/adaptive-nutrition.mjs';

function finite(value){
  return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
}
function num(value,fallback=null){return finite(value)?Number(value):fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function round(value,digits=0){
  if(!Number.isFinite(Number(value)))return null;
  const p=10**digits;
  return Math.round(Number(value)*p)/p;
}

export function localDateKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function activePhase(phases=[],asOfDate){
  const eligible=phases.filter(p=>{
    const start=String(p.start_date??'');
    const end=p.end_date?String(p.end_date):null;
    return (!start||start<=asOfDate)&&(!end||end>=asOfDate);
  }).sort((a,b)=>String(a.start_date??'').localeCompare(String(b.start_date??'')));
  return eligible.at(-1)??phases.filter(p=>p.active).sort((a,b)=>String(a.start_date??'').localeCompare(String(b.start_date??''))).at(-1)??null;
}

export function normalizeDietV1Rows(raw={},asOfDate=localDateKey()){
  const profile=Array.isArray(raw.profile)?raw.profile[0]??null:raw.profile??null;
  const dailyLogs=(raw.dailyLogs??raw.daily_logs??[]).filter(Boolean);
  const meals=(raw.meals??[]).filter(Boolean);
  const mealItems=(raw.mealItems??raw.meal_items??[]).filter(Boolean);
  const weights=(raw.weights??raw.weightEntries??raw.weight_entries??[]).filter(Boolean);
  const goalPhases=(raw.goalPhases??raw.goal_phases??[]).filter(Boolean);
  const savedFoods=(raw.savedFoods??raw.saved_foods??[]).filter(Boolean);
  const savedMeals=(raw.savedMeals??raw.saved_meals??[]).filter(Boolean);
  const phase=activePhase(goalPhases,asOfDate);

  const logById=new Map();
  const logByDate=new Map();
  for(const row of dailyLogs){
    if(row?.id)logById.set(String(row.id),row);
    if(row?.log_date)logByDate.set(String(row.log_date),row);
  }

  const itemsByMeal=new Map();
  for(const row of mealItems){
    const id=String(row?.meal_id??'');
    if(!id)continue;
    const list=itemsByMeal.get(id)??[];
    list.push({
      id:row.id??null,
      name:String(row.name??'Food'),
      quantity:String(row.quantity_text??''),
      calories:num(row.calories,0),
      protein:num(row.protein,0),
      caloriesLow:num(row.calories_low),
      caloriesHigh:num(row.calories_high),
      confidence:String(row.confidence??'medium'),
      source:String(row.source??'text_estimate'),
      sortOrder:num(row.sort_order,0)
    });
    itemsByMeal.set(id,list);
  }
  for(const list of itemsByMeal.values())list.sort((a,b)=>a.sortOrder-b.sortOrder);

  const normalizedMeals=meals.map(row=>{
    const log=logById.get(String(row.daily_log_id??''));
    const date=String(log?.log_date??String(row.eaten_at??'').slice(0,10));
    return {
      id:row.id??null,
      date,
      type:String(row.meal_type??'Other'),
      title:String(row.title??'Meal'),
      calories:num(row.calories,0),
      protein:num(row.protein,0),
      caloriesLow:num(row.calories_low),
      caloriesHigh:num(row.calories_high),
      confidence:String(row.confidence??'medium'),
      source:String(row.source??'text_estimate'),
      eatenAt:row.eaten_at??null,
      updatedAt:row.updated_at??row.created_at??null,
      items:itemsByMeal.get(String(row.id??''))??[]
    };
  }).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.date<=asOfDate);

  const mealsByDate=new Map();
  for(const meal of normalizedMeals){
    const list=mealsByDate.get(meal.date)??[];
    list.push(meal);
    mealsByDate.set(meal.date,list);
  }
  for(const list of mealsByDate.values())list.sort((a,b)=>String(a.eatenAt??a.updatedAt??'').localeCompare(String(b.eatenAt??b.updatedAt??'')));

  const snapshotDaily=[...new Set([
    ...dailyLogs.map(x=>String(x.log_date??'')),
    ...normalizedMeals.map(x=>x.date)
  ])].filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=asOfDate).sort().map(date=>{
    const log=logByDate.get(date);
    const dayMeals=mealsByDate.get(date)??[];
    const calories=dayMeals.reduce((s,m)=>s+m.calories,0);
    const protein=dayMeals.reduce((s,m)=>s+m.protein,0);
    const uncertaintyKcal=dayMeals.reduce((sum,m)=>{
      const low=m.caloriesLow??m.calories;
      const high=m.caloriesHigh??m.calories;
      return sum+Math.max(0,high-low);
    },0);
    return {
      date,
      status:String(log?.status??'open'),
      calorie_target:num(log?.calorie_target,num(phase?.calorie_target,num(profile?.calorie_target))),
      protein_target:num(log?.protein_target,num(phase?.protein_target,num(profile?.protein_target))),
      meals:dayMeals.length,
      calories,
      protein,
      uncertainty_kcal:uncertaintyKcal
    };
  });

  const normalizedWeights=weights.map(row=>({
    id:row.id??null,
    date:String(row.entry_date??row.date??''),
    weight:num(row.weight),
    updatedAt:row.updated_at??row.created_at??null
  })).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.date<=asOfDate&&row.weight!=null&&row.weight>0)
    .sort((a,b)=>a.date.localeCompare(b.date));

  const normalizedSavedFoods=savedFoods.map(row=>({
    id:row.id??null,
    name:String(row.name??'Saved food'),
    brand:String(row.brand??''),
    quantity:String(row.quantity_text??''),
    calories:num(row.calories,0),
    protein:num(row.protein,0),
    carbs:num(row.carbs),
    fat:num(row.fat),
    fiber:num(row.fiber),
    barcode:String(row.barcode??''),
    favorite:Boolean(row.favorite),
    useCount:num(row.use_count,0),
    lastUsedAt:row.last_used_at??null,
    verified:Boolean(row.verified_at),
  })).filter(row=>row.id&&row.name).sort((a,b)=>
    Number(b.favorite)-Number(a.favorite) ||
    b.useCount-a.useCount ||
    String(b.lastUsedAt??'').localeCompare(String(a.lastUsedAt??''))
  );

  const normalizedSavedMeals=savedMeals.map(row=>({
    id:row.id??null,
    name:String(row.name??'Saved meal'),
    mealType:String(row.meal_type??'Other'),
    calories:num(row.calories,0),
    protein:num(row.protein,0),
    carbs:num(row.carbs),
    fat:num(row.fat),
    fiber:num(row.fiber),
    favorite:Boolean(row.favorite),
    useCount:num(row.use_count,0),
    lastUsedAt:row.last_used_at??null,
    isRecipe:Boolean(row.is_recipe),
    servings:num(row.servings),
    servingText:String(row.serving_text??''),
  })).filter(row=>row.id&&row.name).sort((a,b)=>
    Number(b.favorite)-Number(a.favorite) ||
    b.useCount-a.useCount ||
    String(b.lastUsedAt??'').localeCompare(String(a.lastUsedAt??''))
  );

  return {
    asOfDate,
    profile,
    phase,
    daily:snapshotDaily,
    weights:normalizedWeights.map(({date,weight})=>({date,weight})),
    normalizedMeals,
    normalizedWeights,
    normalizedSavedFoods,
    normalizedSavedMeals,
    logByDate
  };
}

function targetForDate(normalized,date){
  const log=normalized.logByDate.get(date);
  return {
    calories:num(log?.calorie_target,num(normalized.phase?.calorie_target,num(normalized.profile?.calorie_target))),
    protein:num(log?.protein_target,num(normalized.phase?.protein_target,num(normalized.profile?.protein_target)))
  };
}

function goalLabel(mode){
  if(mode==='lose')return 'Lose weight';
  if(mode==='gain')return 'Gain weight';
  return 'Maintain weight';
}

export function buildDietV2ReadModel(raw={},options={}){
  const asOfDate=options.asOfDate??localDateKey();
  const normalized=normalizeDietV1Rows(raw,asOfDate);
  const snapshot={
    asOfDate,
    profile:normalized.profile,
    phase:normalized.phase,
    daily:normalized.daily,
    weights:normalized.weights
  };
  const adapted=mapLegacyDietData(snapshot,{asOfDate});
  const p1=runAdaptiveNutritionEngine(adapted.engineInput);

  const todayMeals=normalized.normalizedMeals.filter(m=>m.date===asOfDate);
  const todayCalories=todayMeals.reduce((s,m)=>s+m.calories,0);
  const todayProtein=todayMeals.reduce((s,m)=>s+m.protein,0);
  const todayTarget=targetForDate(normalized,asOfDate);
  const latestWeight=normalized.normalizedWeights.at(-1)??null;
  const latestTrend=p1.estimate.trend.filter(x=>x.date<=asOfDate).at(-1)??null;
  const currentExpenditure=p1.estimate.current?.expenditure??null;
  const confidence=p1.estimate.confidence??{level:'building_baseline',score:0,uncertaintyKcal:null};
  const rec=p1.calorieRecommendation??{};
  const currentTarget=adapted.engineInput.currentTarget??todayTarget.calories;

  const progressIntake=normalized.daily.map(day=>({
    date:day.date,
    calories:round(day.calories,0),
    target:round(day.calorie_target,0),
    protein:round(day.protein,1),
    status:day.status
  }));

  const recentMeals=[...normalized.normalizedMeals]
    .sort((a,b)=>String(b.eatenAt??b.updatedAt??b.date).localeCompare(String(a.eatenAt??a.updatedAt??a.date)))
    .slice(0,20);

  return {
    asOfDate,
    today:{
      calories:round(todayCalories,0),
      calorieTarget:round(todayTarget.calories,0),
      caloriesRemaining:todayTarget.calories==null?null:round(todayTarget.calories-todayCalories,0),
      calorieProgress:todayTarget.calories?clamp(todayCalories/todayTarget.calories*100,0,100):0,
      protein:round(todayProtein,1),
      proteinTarget:round(todayTarget.protein,0),
      proteinRemaining:todayTarget.protein==null?null:round(todayTarget.protein-todayProtein,1),
      meals:todayMeals,
      latestWeight:latestWeight?round(latestWeight.weight,2):null,
      latestWeightDate:latestWeight?.date??null,
      trendWeight:latestTrend?round(latestTrend.trendWeight,2):null,
      expenditure:currentExpenditure==null?null:round(currentExpenditure,0),
      expenditureRangeLow:p1.estimate.current?.rangeLow??null,
      expenditureRangeHigh:p1.estimate.current?.rangeHigh??null,
      confidenceLevel:confidence.level,
      confidenceScore:confidence.score,
      currentTarget:round(currentTarget,0),
      goalMode:adapted.engineInput.goalMode,
      goalLabel:goalLabel(adapted.engineInput.goalMode)
    },
    food:{
      todayMeals,
      recentMeals,
      savedFoods:normalized.normalizedSavedFoods,
      savedMeals:normalized.normalizedSavedMeals,
      quickFoods:normalized.normalizedSavedFoods.slice(0,8),
      quickMeals:normalized.normalizedSavedMeals.slice(0,6)
    },
    progress:{
      rawWeights:normalized.normalizedWeights.map(w=>({date:w.date,value:round(w.weight,2)})),
      trendWeights:p1.estimate.trend.map(w=>({date:w.date,value:round(w.trendWeight,3),observed:Boolean(w.observed)})),
      expenditure:p1.estimate.series.map(x=>({date:x.date,value:round(x.expenditure,0),confidence:round(x.measurementConfidence,3)})),
      intake:progressIntake,
      goalProjection:p1.goalProjection
    },
    strategy:{
      goalMode:adapted.engineInput.goalMode,
      goalLabel:goalLabel(adapted.engineInput.goalMode),
      goalWeight:adapted.engineInput.goalWeight,
      targetRateKgPerWeek:adapted.engineInput.targetRateKgPerWeek,
      currentTarget:round(currentTarget,0),
      estimatedExpenditure:currentExpenditure==null?null:round(currentExpenditure,0),
      confidenceLevel:confidence.level,
      confidenceScore:confidence.score,
      uncertaintyKcal:confidence.uncertaintyKcal??null,
      decision:rec.decision??'need_more_data',
      recommendedTarget:rec.recommendedTarget??currentTarget??null,
      rawTarget:rec.rawTarget??null,
      reason:rec.reason??'More data is needed before changing the plan.',
      remainingKg:rec.remainingKg??null
    },
    meta:{
      adapter:adapted.meta,
      engineVersion:p1.version,
      legacyRows:{
        daily:normalized.daily.length,
        meals:normalized.normalizedMeals.length,
        weights:normalized.normalizedWeights.length,
        savedFoods:normalized.normalizedSavedFoods.length,
        savedMeals:normalized.normalizedSavedMeals.length
      }
    }
  };
}
