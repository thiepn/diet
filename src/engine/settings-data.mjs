const ALLOWED_THEMES=new Set(['system','light','dark']);
const ALLOWED_DENSITIES=new Set(['comfortable','compact']);
const ALLOWED_MOTION=new Set(['system','reduce']);

function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function clone(value){
  try{return structuredClone(value);}catch{
    try{return JSON.parse(JSON.stringify(value));}catch{return null;}
  }
}
function csvCell(value){
  if(value==null)return '';
  const s=String(value);
  return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
export function encodeCsv(rows=[],headers=[]){
  return [headers.join(','),...rows.map(row=>headers.map(h=>csvCell(row?.[h])).join(','))].join('\r\n');
}
export function normalizeUiPreferences(value={}){
  return {
    theme:ALLOWED_THEMES.has(value?.theme)?value.theme:'system',
    density:ALLOWED_DENSITIES.has(value?.density)?value.density:'comfortable',
    motion:ALLOWED_MOTION.has(value?.motion)?value.motion:'system'
  };
}
function scrubSecrets(value,key=''){
  if(Array.isArray(value))return value.map(v=>scrubSecrets(v,key));
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [k,v] of Object.entries(value)){
    const lowered=k.toLowerCase();
    if(
      lowered==='access_token'||lowered==='refresh_token'||lowered==='provider_token'||
      lowered==='provider_refresh_token'||lowered==='token'||lowered==='jwt'||
      lowered==='authorization'||lowered==='apikey'||lowered==='api_key'||lowered==='service_role_key'
    )continue;
    out[k]=scrubSecrets(v,k);
  }
  return out;
}
export function buildDietJsonBackup(raw,model,{exportedAt=new Date().toISOString()}={}){
  if(!raw||!model)return null;
  return {
    format:'diet-copilot-backup',
    version:1,
    exportedAt,
    asOfDate:model.asOfDate??null,
    note:'Owner-scoped Diet Copilot export. Authentication tokens are not included.',
    data:scrubSecrets(clone(raw))
  };
}
export function buildNutritionCsv(model){
  const rows=(model?.progress?.intake??[]).map(x=>({
    date:x.date??'',
    calories:finite(x.calories)?Number(x.calories):'',
    calorie_target:finite(x.target)?Number(x.target):'',
    protein_g:finite(x.protein)?Number(x.protein):'',
    day_status:x.status??''
  }));
  return rows.length?encodeCsv(rows,['date','calories','calorie_target','protein_g','day_status']):null;
}
export function buildWeightCsv(model){
  const trend=new Map((model?.progress?.trendWeights??[]).map(x=>[x.date,x.value]));
  const rows=(model?.progress?.rawWeights??[]).map(x=>({
    date:x.date??'',
    scale_weight_kg:finite(x.value)?Number(x.value):'',
    trend_weight_kg:finite(trend.get(x.date))?Number(trend.get(x.date)):''
  }));
  return rows.length?encodeCsv(rows,['date','scale_weight_kg','trend_weight_kg']):null;
}
export const DietSettingsDataP9=Object.freeze({
  version:'1.0.0-p9',
  themes:[...ALLOWED_THEMES],
  densities:[...ALLOWED_DENSITIES],
  motion:[...ALLOWED_MOTION]
});
