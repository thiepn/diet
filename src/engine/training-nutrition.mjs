const DAY_MS=86400000;
const TYPES=Object.freeze(['rest','light','moderate','hard']);
const DOW=Object.freeze(['mon','tue','wed','thu','fri','sat','sun']);
const DEFAULT_TEMPLATE=Object.freeze({mon:'rest',tue:'rest',wed:'rest',thu:'rest',fri:'rest',sat:'rest',sun:'rest'});
const DEFAULT_SETTINGS=Object.freeze({
  enabled:false,
  hardExtraKcal:150,
  moderateExtraKcal:75,
  lightExtraKcal:25,
  weeklyTemplate:DEFAULT_TEMPLATE
});

function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function num(value,fallback=null){return finite(value)?Number(value):fallback;}
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
function round(value,digits=0){if(!Number.isFinite(Number(value)))return null;const p=10**digits;return Math.round(Number(value)*p)/p;}
function dateKey(date){return date.toISOString().slice(0,10);}
function parseDate(key){const d=new Date(key+'T12:00:00Z');return Number.isNaN(d.getTime())?null:d;}
function addDays(key,days){const d=parseDate(key);if(!d)return key;d.setUTCDate(d.getUTCDate()+days);return dateKey(d);}
function weekdayIndex(key){
  const d=parseDate(key); if(!d)return 0;
  return (d.getUTCDay()+6)%7;
}
function mondayOf(key){return addDays(key,-weekdayIndex(key));}
function median(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function normalizeType(value){return TYPES.includes(value)?value:'rest';}
function normalizeTemplate(value={}){
  const src=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return Object.fromEntries(DOW.map(k=>[k,normalizeType(src[k])]));
}
function normalizeSettings(settings={}){
  return {
    enabled:Boolean(settings.enabled),
    hardExtraKcal:clamp(num(settings.hardExtraKcal??settings.hard_extra_kcal,150),0,300),
    moderateExtraKcal:clamp(num(settings.moderateExtraKcal??settings.moderate_extra_kcal,75),0,250),
    lightExtraKcal:clamp(num(settings.lightExtraKcal??settings.light_extra_kcal,25),0,150),
    weeklyTemplate:normalizeTemplate(settings.weeklyTemplate??settings.weekly_template)
  };
}
function requestedExtra(type,settings){
  if(type==='hard')return settings.hardExtraKcal;
  if(type==='moderate')return settings.moderateExtraKcal;
  if(type==='light')return settings.lightExtraKcal;
  return 0;
}
function normalizedTrainingDays(rows=[]){
  return rows.map(row=>({
    id:row.id??null,
    date:String(row.training_date??row.date??''),
    dayType:normalizeType(String(row.day_type??row.dayType??'rest')),
    status:String(row.status??'planned'),
    title:String(row.title??''),
    durationMinutes:num(row.duration_minutes??row.durationMinutes),
    source:String(row.source??'manual'),
    notes:String(row.notes??''),
    updatedAt:row.updated_at??row.updatedAt??null
  })).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date));
}
function normalizeActivity(rows=[]){
  return rows.map(row=>({
    date:String(row.activity_date??row.date??''),
    steps:num(row.steps),
    activeCalories:num(row.active_calories??row.activeCalories),
    exerciseMinutes:num(row.exercise_minutes??row.exerciseMinutes),
    distanceKm:num(row.distance_km??row.distanceKm),
    restingHeartRate:num(row.resting_heart_rate??row.restingHeartRate),
    source:String(row.source??'manual'),
    syncedAt:row.synced_at??row.syncedAt??null,
    updatedAt:row.updated_at??row.updatedAt??null
  })).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)).sort((a,b)=>a.date.localeCompare(b.date));
}
function roundBalanced(targets,total,minCalories,maxCalories){
  const rounded=targets.map(v=>clamp(Math.round(v/25)*25,minCalories,maxCalories));
  let residual=total-rounded.reduce((s,v)=>s+v,0);
  const order=[...rounded.keys()].sort((a,b)=>{
    const da=Math.abs(targets[a]-rounded[a]), db=Math.abs(targets[b]-rounded[b]);
    return db-da;
  });
  let guard=0;
  while(Math.abs(residual)>=24.999&&guard<100){
    guard++;
    let changed=false;
    for(const i of order){
      const step=residual>0?25:-25;
      const next=rounded[i]+step;
      if(next<minCalories||next>maxCalories)continue;
      rounded[i]=next;
      residual-=step;
      changed=true;
      if(Math.abs(residual)<24.999)break;
    }
    if(!changed)break;
  }
  if(Math.abs(residual)>0.001){
    const i=order.find(index=>rounded[index]+residual>=minCalories&&rounded[index]+residual<=maxCalories);
    if(i!==undefined){rounded[i]+=residual;residual=0;}
  }
  return rounded;
}
function macroPlan(calories,protein,fat){
  const p=Math.max(0,num(protein,0));
  const f=Math.max(0,num(fat,0));
  const fixed=p*4+f*9;
  const carbs=Math.max(0,(calories-fixed)/4);
  return {calories:round(calories,0),protein:round(p,0),fat:round(f,0),carbs:round(carbs,0)};
}

export function buildWeeklyTrainingDistribution({
  asOfDate,
  baseCalories,
  protein,
  fat,
  settings={},
  trainingDays=[],
  minCalories=1200,
  maxCalories=6000
}={}){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate??''))?String(asOfDate):dateKey(new Date());
  const base=num(baseCalories);
  if(base==null||base<=0)return {enabled:false,week:[],weeklyBaseCalories:null,weeklyDistributedCalories:null,zeroSum:false};
  const cfg=normalizeSettings(settings);
  const monday=mondayOf(date);
  const overrides=new Map(normalizedTrainingDays(trainingDays).map(row=>[row.date,row]));
  const week=DOW.map((dow,i)=>{
    const dayDate=addDays(monday,i);
    const override=overrides.get(dayDate);
    const overrideType=override?.status==='skipped'?'rest':override?.dayType;
    const type=override?normalizeType(overrideType):cfg.weeklyTemplate[dow];
    return {
      date:dayDate,dow,dayType:type,
      source:override?'override':'template',
      trainingDay:override??null,
      requestedExtra:cfg.enabled?requestedExtra(type,cfg):0
    };
  });
  if(!cfg.enabled){
    const targets=week.map(()=>base);
    return {
      enabled:false,
      week:week.map((day,i)=>({...day,deltaKcal:0,targetCalories:round(targets[i],0),macros:macroPlan(targets[i],protein,fat)})),
      weeklyBaseCalories:round(base*7,0),
      weeklyDistributedCalories:round(base*7,0),
      zeroSum:true,
      settings:cfg
    };
  }

  const extras=week.map(day=>day.requestedExtra);
  const positiveTotal=extras.reduce((s,v)=>s+v,0);
  const restIndexes=week.map((d,i)=>d.dayType==='rest'?i:-1).filter(i=>i>=0);
  let rawTargets=week.map((day,i)=>base+extras[i]);
  if(positiveTotal>0){
    if(restIndexes.length){
      const restReduction=positiveTotal/restIndexes.length;
      rawTargets=rawTargets.map((v,i)=>restIndexes.includes(i)?base-restReduction:v);
    }else{
      const mean=positiveTotal/7;
      rawTargets=rawTargets.map(v=>v-mean);
    }
  }
  rawTargets=rawTargets.map(v=>clamp(v,minCalories,maxCalories));
  const targets=roundBalanced(rawTargets,base*7,minCalories,maxCalories);
  const distributedTotal=targets.reduce((s,v)=>s+v,0);
  return {
    enabled:true,
    week:week.map((day,i)=>({
      ...day,
      deltaKcal:round(targets[i]-base,0),
      targetCalories:round(targets[i],0),
      macros:macroPlan(targets[i],protein,fat)
    })),
    weeklyBaseCalories:round(base*7,0),
    weeklyDistributedCalories:round(distributedTotal,0),
    zeroSum:Math.abs(distributedTotal-base*7)<1,
    settings:cfg
  };
}

export function buildActivityContext({asOfDate,activity=[]}={}){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate??''))?String(asOfDate):dateKey(new Date());
  const rows=normalizeActivity(activity);
  const today=rows.find(row=>row.date===date)??null;
  const baselineStart=addDays(date,-21);
  const previous=rows.filter(row=>row.date<date&&row.date>=baselineStart).slice(-14);
  const baseline={
    steps:median(previous.map(x=>x.steps).filter(Number.isFinite)),
    activeCalories:median(previous.map(x=>x.activeCalories).filter(Number.isFinite)),
    exerciseMinutes:median(previous.map(x=>x.exerciseMinutes).filter(Number.isFinite))
  };
  const ratios=[];
  if(today?.steps!=null&&baseline.steps>0)ratios.push(today.steps/baseline.steps);
  if(today?.activeCalories!=null&&baseline.activeCalories>0)ratios.push(today.activeCalories/baseline.activeCalories);
  if(today?.exerciseMinutes!=null&&baseline.exerciseMinutes>0)ratios.push(today.exerciseMinutes/baseline.exerciseMinutes);
  const ratio=ratios.length?median(ratios):null;
  let level='building_baseline';
  if(ratio!=null){
    if(ratio>=1.8)level='very_high';
    else if(ratio>=1.35)level='high';
    else level='in_progress';
  }
  const lastSynced=rows.map(x=>x.syncedAt).filter(Boolean).sort().at(-1)??null;
  return {
    today,
    baseline,
    baselineDays:previous.length,
    relativeLoad:ratio==null?null:round(ratio,2),
    level,
    lastSynced,
    affectsCalorieTarget:false,
    note:'Activity is context only. The adaptive expenditure engine responds to sustained changes through intake and weight trend rather than eating back device calories.'
  };
}

export function buildTrainingNutritionPlan(input={}){
  const distribution=buildWeeklyTrainingDistribution(input);
  const activityContext=buildActivityContext({asOfDate:input.asOfDate,activity:input.activity});
  const today=distribution.week.find(day=>day.date===input.asOfDate)??null;
  return {
    version:'1.0.0-p6',
    distribution,
    activityContext,
    today,
    policy:{
      weeklyEnergyInvariant:'preserve_base_weekly_energy',
      activityCaloriePolicy:'context_only_no_eat_back',
      macroShiftPolicy:'hold_protein_and_fat_shift_carbs'
    }
  };
}
