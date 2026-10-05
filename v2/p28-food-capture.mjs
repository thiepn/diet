const MEAL_TYPES=new Set(['Breakfast','Lunch','Dinner','Snack']);

export function normalizeFoodQuery(value){
  return String(value??'').trim().toLocaleLowerCase();
}

function recencyBonus(value){
  if(!value)return 0;
  const t=Date.parse(value);
  if(!Number.isFinite(t))return 0;
  const ageDays=Math.max(0,(Date.now()-t)/86400000);
  if(ageDays<=2)return 28;
  if(ageDays<=7)return 20;
  if(ageDays<=30)return 10;
  return 0;
}

export function rankFoodCaptureMatches(model,query,{mealType='Other',limit=10}={}){
  const q=normalizeFoodQuery(query);
  if(!q)return [];
  const foods=(model?.food?.savedFoods??[]).map(item=>{
    const name=normalizeFoodQuery(item.name),brand=normalizeFoodQuery(item.brand),barcode=normalizeFoodQuery(item.barcode);
    const memory=model?.food?.memory?.foodsById?.[String(item.id)]??null;
    const contextUses=Number(memory?.mealTypeCounts?.[mealType]??0);
    const matchScore=(barcode===q?700:0)+(name===q?260:0)+(name.startsWith(q)?145:0)+(name.includes(q)?85:0)+
      (brand.startsWith(q)?60:0)+(brand.includes(q)?35:0);
    const bonus=(item.favorite?24:0)+Math.min(Number(item.useCount)||0,35)+
      recencyBonus(item.lastUsedAt)+Math.min(contextUses*12,60)+(memory?.dominantMealType===mealType?18:0);
    return {type:'food',item,score:matchScore?matchScore+bonus:0};
  }).filter(x=>x.score>0);
  const meals=(model?.food?.savedMeals??[]).map(item=>{
    const name=normalizeFoodQuery(item.name);
    const sameMeal=String(item.mealType??'')===mealType;
    const matchScore=(name===q?250:0)+(name.startsWith(q)?140:0)+(name.includes(q)?82:0);
    const bonus=(item.favorite?24:0)+Math.min(Number(item.useCount)||0,35)+recencyBonus(item.lastUsedAt)+(sameMeal?36:0);
    return {type:'meal',item,score:matchScore?matchScore+bonus:0};
  }).filter(x=>x.score>0);
  return [...foods,...meals].sort((a,b)=>b.score-a.score || String(a.item.name).localeCompare(String(b.item.name))).slice(0,limit);
}

export function normalizePortionMultiplier(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 1;
  return Math.round(Math.max(.1,Math.min(10,n))*100)/100;
}

export function portionPreview(item,multiplier){
  const m=normalizePortionMultiplier(multiplier);
  return {
    multiplier:m,
    calories:Math.round((Number(item?.calories)||0)*m),
    protein:Math.round((Number(item?.protein)||0)*m*10)/10
  };
}

export function portionQuantityText(item,multiplier,override=''){
  const custom=String(override??'').trim();
  if(custom)return custom;
  const m=normalizePortionMultiplier(multiplier);
  const base=String(item?.quantity??item?.servingText??'').trim();
  if(m===1)return base||null;
  return base?`${m}× ${base}`:`${m}× serving`;
}

export function latestRepeatCandidate(recentMeals=[],mealType=null){
  const rows=(recentMeals??[]).filter(x=>x?.id);
  if(!rows.length)return null;
  const exactType=mealType?rows.find(x=>String(x.type)===String(mealType)):null;
  return exactType??rows[0]??null;
}

export function validMealType(value){
  return MEAL_TYPES.has(String(value))?String(value):null;
}
