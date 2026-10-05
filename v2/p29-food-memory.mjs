function text(value){return String(value??'').trim().toLocaleLowerCase();}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function roundStep(value,step=.05){return Math.round(Number(value)/step)*step;}
function median(values){
  const rows=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(!rows.length)return null;
  const mid=Math.floor(rows.length/2);
  return rows.length%2?rows[mid]:(rows[mid-1]+rows[mid])/2;
}
function modeText(values){
  const counts=new Map();
  for(const raw of values){
    const value=String(raw??'').trim();
    if(!value)continue;
    counts.set(value,(counts.get(value)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;
}
function eventTime(meal){
  return Date.parse(meal?.eatenAt??meal?.updatedAt??(meal?.date?meal.date+'T12:00:00Z':''));
}
function itemMultiplier(item,food){
  const baseCalories=Number(food?.calories);
  const itemCalories=Number(item?.calories);
  let ratio=null;
  if(baseCalories>0&&itemCalories>=0)ratio=itemCalories/baseCalories;
  else{
    const baseProtein=Number(food?.protein);
    const itemProtein=Number(item?.protein);
    if(baseProtein>0&&itemProtein>=0)ratio=itemProtein/baseProtein;
  }
  if(!Number.isFinite(ratio)||ratio<.1||ratio>10)return null;
  return roundStep(clamp(ratio,.1,10),.05);
}

export function buildFoodMemory(savedFoods=[],meals=[],{maxMeals=120,minObservations=3}={}){
  const foods=new Map((savedFoods??[]).filter(x=>x?.id).map(x=>[String(x.id),x]));
  const observations=new Map();
  const ordered=(meals??[]).slice().sort((a,b)=>(eventTime(b)||0)-(eventTime(a)||0)).slice(0,maxMeals);
  for(const meal of ordered){
    for(const item of meal?.items??[]){
      const id=String(item?.savedFoodId??'');
      const food=foods.get(id);
      if(!food)continue;
      const multiplier=itemMultiplier(item,food);
      if(multiplier==null)continue;
      const list=observations.get(id)??[];
      list.push({
        multiplier,
        quantity:String(item.quantity??'').trim()||null,
        mealType:String(meal.type??'Other'),
        date:String(meal.date??''),
        at:meal.eatenAt??meal.updatedAt??null
      });
      observations.set(id,list);
    }
  }

  const foodsById={};
  let learnedCount=0,totalObservations=0;
  for(const [id,food] of foods){
    const rows=observations.get(id)??[];
    totalObservations+=rows.length;
    const multipliers=rows.map(x=>x.multiplier);
    const med=median(multipliers);
    const tolerance=med==null?0:Math.max(.1,med*.12);
    const agreeing=med==null?[]:rows.filter(x=>Math.abs(x.multiplier-med)<=tolerance);
    const agreement=rows.length?agreeing.length/rows.length:0;
    const eligible=rows.length>=minObservations&&agreement>=2/3;
    const learnedMultiplier=eligible?roundStep(median(agreeing.map(x=>x.multiplier))??med,.05):1;
    const mealTypeCounts={};
    for(const row of rows)mealTypeCounts[row.mealType]=(mealTypeCounts[row.mealType]||0)+1;
    const dominantMealType=Object.entries(mealTypeCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;
    const usualQuantity=eligible?modeText(agreeing.map(x=>x.quantity)):null;
    if(eligible)learnedCount++;
    foodsById[id]={
      foodId:id,
      observations:rows.length,
      lastObservedAt:rows[0]?.at??null,
      lastObservedDate:rows[0]?.date??null,
      mealTypeCounts,
      dominantMealType,
      usualPortion:{
        eligible,
        multiplier:eligible?learnedMultiplier:1,
        evidence:rows.length,
        agreement:Math.round(agreement*100)/100,
        quantityText:usualQuantity
      }
    };
  }
  return {version:'P29.1',foodsById,learnedCount,totalObservations};
}

export function foodMemoryFor(memory,foodId){
  return memory?.foodsById?.[String(foodId)]??null;
}

export function learnedFoodMultiplier(memory,foodId){
  const row=foodMemoryFor(memory,foodId);
  return row?.usualPortion?.eligible?Number(row.usualPortion.multiplier)||1:1;
}

export function rankFoodsForMealType(savedFoods=[],memory=null,mealType='Other',{limit=8}={}){
  return (savedFoods??[]).map((food,index)=>{
    const m=foodMemoryFor(memory,food.id);
    const contextUses=Number(m?.mealTypeCounts?.[mealType]??0);
    const score=(food.favorite?120:0)+Math.min(Number(food.useCount)||0,60)+contextUses*30+
      (m?.dominantMealType===mealType?24:0)+(m?.usualPortion?.eligible?8:0)-index*.02;
    return {food,score};
  }).sort((a,b)=>b.score-a.score||String(a.food.name).localeCompare(String(b.food.name)))
    .slice(0,limit).map(x=>x.food);
}

export function rankMealsForMealType(savedMeals=[],mealType='Other',{limit=6}={}){
  return (savedMeals??[]).map((meal,index)=>({
    meal,
    score:(meal.favorite?120:0)+Math.min(Number(meal.useCount)||0,60)+(String(meal.mealType)===String(mealType)?50:0)-index*.02
  })).sort((a,b)=>b.score-a.score||String(a.meal.name).localeCompare(String(b.meal.name)))
    .slice(0,limit).map(x=>x.meal);
}

function mealItemToken(item){
  if(item?.savedFoodId)return 'sf:'+String(item.savedFoodId);
  const name=text(item?.name);
  return name?'n:'+name:null;
}
function mealSignature(meal){
  const tokens=(meal?.items??[]).map(mealItemToken).filter(Boolean).sort();
  if(tokens.length<2)return null;
  return text(meal?.type)+'|'+tokens.join('|');
}

export function buildRecurringMealMemory(meals=[],savedMeals=[],{maxMeals=80,minOccurrences=2,limit=5}={}){
  const ordered=(meals??[]).slice().sort((a,b)=>(eventTime(b)||0)-(eventTime(a)||0)).slice(0,maxMeals);
  const groups=new Map();
  for(const meal of ordered){
    const signature=mealSignature(meal);
    if(!signature||!meal?.id)continue;
    const group=groups.get(signature)??[];
    group.push(meal);
    groups.set(signature,group);
  }
  const savedNames=new Set((savedMeals??[]).map(x=>text(x.name)).filter(Boolean));
  const patterns=[];
  for(const [signature,rows] of groups){
    if(rows.length<minOccurrences)continue;
    const representative=rows[0];
    const titleCounts=new Map();
    for(const row of rows){
      const title=String(row.title??'Meal').trim()||'Meal';
      titleCounts.set(title,(titleCounts.get(title)||0)+1);
    }
    const title=[...titleCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??representative.title??'Meal';
    patterns.push({
      signature,
      representativeId:representative.id,
      title,
      mealType:String(representative.type??'Other'),
      occurrences:rows.length,
      lastDate:String(representative.date??''),
      itemNames:(representative.items??[]).map(x=>String(x.name??'Food')).slice(0,5),
      calories:Number(representative.calories)||0,
      protein:Number(representative.protein)||0,
      alreadySaved:savedNames.has(text(title))
    });
  }
  return patterns.sort((a,b)=>b.occurrences-a.occurrences||String(b.lastDate).localeCompare(String(a.lastDate))).slice(0,limit);
}

function closeNumber(a,b,{absolute=0,relative=.05}={}){
  if(!finite(a)||!finite(b))return true;
  const x=Number(a),y=Number(b);
  return Math.abs(x-y)<=Math.max(absolute,Math.max(Math.abs(x),Math.abs(y))*relative);
}

export function findDuplicateSavedFood(savedFoods=[],candidate={},currentId=null){
  const current=String(currentId??candidate.savedFoodId??'');
  const barcode=text(candidate.barcode);
  if(barcode){
    const exact=(savedFoods??[]).find(food=>String(food.id)!==current&&text(food.barcode)===barcode);
    if(exact)return {food:exact,reason:'barcode'};
  }
  const name=text(candidate.name);
  if(!name)return null;
  const brand=text(candidate.brand);
  const quantity=text(candidate.quantityText??candidate.quantity);
  const exact=(savedFoods??[]).find(food=>{
    if(String(food.id)===current)return false;
    if(text(food.name)!==name||text(food.brand)!==brand||text(food.quantity)!==quantity)return false;
    return closeNumber(food.calories,candidate.calories,{absolute:10,relative:.05})&&
      closeNumber(food.protein,candidate.protein,{absolute:2,relative:.1});
  });
  return exact?{food:exact,reason:'same_food'}:null;
}


export function duplicateReuseMultiplier(existing={},candidate={}){
  const ratios=[];
  const pairs=[
    [existing.calories,candidate.calories],
    [existing.protein,candidate.protein],
    [existing.carbs,candidate.carbs],
    [existing.fat,candidate.fat]
  ];
  for(const [base,next] of pairs){
    if(!finite(base)||!finite(next)||Number(base)<=0||Number(next)<0)continue;
    ratios.push(Number(next)/Number(base));
  }
  if(!ratios.length)return null;
  const med=median(ratios);
  if(!Number.isFinite(med)||med<.1||med>10)return null;
  const tolerance=Math.max(.08,med*.12);
  if(ratios.some(r=>Math.abs(r-med)>tolerance))return null;
  return Math.round(clamp(med,.1,10)*100)/100;
}
