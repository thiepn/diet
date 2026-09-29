const DAY_MS=86400000;
const VERSION='1.0.0-p7';

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function num(v,fallback=null){return finite(v)?Number(v):fallback;}
function round(v,d=0){if(!Number.isFinite(Number(v)))return null;const p=10**d;return Math.round(Number(v)*p)/p;}
function parseDate(key){const d=new Date(String(key)+'T12:00:00Z');return Number.isNaN(d.getTime())?null:d;}
function addDays(key,days){const d=parseDate(key);if(!d)return key;d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function weekdayIndex(key){const d=parseDate(key);return d?(d.getUTCDay()+6)%7:0;}
function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function mean(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;}
function mad(values){const m=median(values);if(m==null)return null;return median(values.filter(Number.isFinite).map(v=>Math.abs(v-m)));}
function pearson(pairs){
  const rows=pairs.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(rows.length<8)return null;
  const mx=mean(rows.map(p=>p.x)),my=mean(rows.map(p=>p.y));
  const sx=Math.sqrt(rows.reduce((s,p)=>s+(p.x-mx)**2,0));
  const sy=Math.sqrt(rows.reduce((s,p)=>s+(p.y-my)**2,0));
  if(sx<1e-9||sy<1e-9)return null;
  return rows.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/(sx*sy);
}
function normalizeType(value){return ['rest','light','moderate','hard'].includes(value)?value:'rest';}
function dayTypeFor(date,settings={},trainingDays=[]){
  const override=trainingDays.find(row=>String(row.training_date??row.date??'')===date);
  if(override){
    if(String(override.status??'planned')==='skipped')return 'rest';
    return normalizeType(String(override.day_type??override.dayType??'rest'));
  }
  const keys=['mon','tue','wed','thu','fri','sat','sun'];
  const template=settings.weeklyTemplate??settings.weekly_template??{};
  return normalizeType(template[keys[weekdayIndex(date)]]);
}
function reliableDay(day){return Number(day?.reliability)>0&&Number(day?.calories)>0;}
function confidenceFromCount(count,good=14){
  if(count>=good)return 'high';
  if(count>=Math.max(6,Math.floor(good/2)))return 'medium';
  if(count>=3)return 'low';
  return 'insufficient';
}
function correlationLabel(r){
  if(r==null)return 'insufficient';
  const a=Math.abs(r);
  if(a<0.2)return 'little';
  if(a<0.4)return 'weak';
  if(a<0.6)return 'moderate';
  return 'strong';
}

export function buildPersonalIntelligence({
  asOfDate,daily=[],assessedIntake=[],trendWeights=[],activity=[],
  trainingSettings={},trainingDays=[],windowDays=28
}={}){
  const end=/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate??''))?String(asOfDate):new Date().toISOString().slice(0,10);
  const start=addDays(end,-Math.max(13,Number(windowDays)||28)+1);
  const assessedByDate=new Map((assessedIntake??[]).map(x=>[String(x.date),x]));
  const activityByDate=new Map((activity??[]).map(x=>[String(x.activity_date??x.date??''),x]));

  const rows=(daily??[]).map(day=>{
    const date=String(day.date??day.log_date??'');
    const assessed=assessedByDate.get(date);
    const a=activityByDate.get(date);
    return {
      date,
      calories:num(day.calories,0),
      protein:num(day.protein,0),
      carbs:num(day.carbs),
      fat:num(day.fat),
      fiber:num(day.fiber),
      calorieTarget:num(day.calorieTarget??day.calorie_target),
      proteinTarget:num(day.proteinTarget??day.protein_target),
      reliability:num(assessed?.reliability,0),
      coverage:String(assessed?.coverage??'unknown'),
      dayType:dayTypeFor(date,trainingSettings,trainingDays),
      weekend:[5,6].includes(weekdayIndex(date)),
      steps:num(a?.steps),
      activeCalories:num(a?.active_calories??a?.activeCalories),
      exerciseMinutes:num(a?.exercise_minutes??a?.exerciseMinutes)
    };
  }).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.date>=start&&row.date<=end)
    .sort((a,b)=>a.date.localeCompare(b.date));

  const reliable=rows.filter(reliableDay);
  const proteinEligible=reliable.filter(r=>r.proteinTarget>0);
  const calorieEligible=reliable.filter(r=>r.calorieTarget>0);
  const weekend=reliable.filter(r=>r.weekend);
  const weekday=reliable.filter(r=>!r.weekend);
  const training=reliable.filter(r=>['moderate','hard'].includes(r.dayType));
  const rest=reliable.filter(r=>r.dayType==='rest');
  const pairedActivity=reliable.filter(r=>r.steps!=null&&r.date<end);

  const avgCalories=mean(reliable.map(r=>r.calories));
  const calorieMad=mad(reliable.map(r=>r.calories));
  const calorieCV=avgCalories&&calorieMad!=null?1.4826*calorieMad/avgCalories:null;
  const calorieAdherence=calorieEligible.length
    ?calorieEligible.filter(r=>Math.abs(r.calories-r.calorieTarget)<=Math.max(100,r.calorieTarget*0.10)).length/calorieEligible.length
    :null;
  const proteinAdherence=proteinEligible.length
    ?proteinEligible.filter(r=>r.protein>=r.proteinTarget*0.90).length/proteinEligible.length
    :null;

  const weekendAvg=mean(weekend.map(r=>r.calories));
  const weekdayAvg=mean(weekday.map(r=>r.calories));
  const weekendDelta=(weekend.length>=2&&weekday.length>=4&&weekendAvg!=null&&weekdayAvg!=null)?weekendAvg-weekdayAvg:null;

  const trainingCarbs=mean(training.map(r=>r.carbs).filter(Number.isFinite));
  const restCarbs=mean(rest.map(r=>r.carbs).filter(Number.isFinite));
  const trainingCarbDelta=(training.filter(r=>r.carbs!=null).length>=2&&rest.filter(r=>r.carbs!=null).length>=3&&trainingCarbs!=null&&restCarbs!=null)
    ?trainingCarbs-restCarbs:null;

  const activityCorrelation=pearson(pairedActivity.map(r=>({x:r.steps,y:r.calories})));
  const activityRows=rows.filter(r=>r.steps!=null&&r.date<end);
  const recentStart=addDays(end,-7);
  const priorStart=addDays(end,-21);
  const recent7=activityRows.filter(r=>r.date>=recentStart&&r.date<end);
  const prior14=activityRows.filter(r=>r.date>=priorStart&&r.date<recentStart);
  const recentSteps=median(recent7.map(r=>r.steps));
  const priorSteps=median(prior14.map(r=>r.steps));
  const activityShift=(recent7.length>=4&&prior14.length>=7&&recentSteps!=null&&priorSteps>0)?recentSteps/priorSteps-1:null;

  const trend=(trendWeights??[]).filter(x=>x.date>=start&&x.date<=end&&finite(x.value??x.trendWeight))
    .map(x=>({date:x.date,value:num(x.value??x.trendWeight)}));
  let weeklyTrendRate=null;
  if(trend.length>=8){
    const days=Math.max(1,(parseDate(trend.at(-1).date)-parseDate(trend[0].date))/DAY_MS);
    weeklyTrendRate=(trend.at(-1).value-trend[0].value)/days*7;
  }

  const insights=[];
  if(proteinAdherence!=null&&proteinEligible.length>=6){
    insights.push({
      id:'protein_adherence',category:'nutrition',title:'Protein target consistency',
      value:round(proteinAdherence*100,0),unit:'%',
      tone:proteinAdherence>=0.8?'steady':proteinAdherence>=0.6?'mixed':'attention',
      confidence:confidenceFromCount(proteinEligible.length,14),evidenceDays:proteinEligible.length,
      summary:`Protein reached at least 90% of target on ${Math.round(proteinAdherence*proteinEligible.length)} of ${proteinEligible.length} reliable days.`
    });
  }
  if(weekendDelta!=null){
    insights.push({
      id:'weekend_intake',category:'pattern',title:'Weekend intake difference',
      value:round(weekendDelta,0),unit:'kcal/day',tone:Math.abs(weekendDelta)<150?'steady':'pattern',
      confidence:confidenceFromCount(weekend.length+weekday.length,18),evidenceDays:weekend.length+weekday.length,
      summary:`Reliable weekend days averaged ${weekendDelta>=0?'+':''}${round(weekendDelta,0)} kcal versus weekdays.`
    });
  }
  if(trainingCarbDelta!=null){
    insights.push({
      id:'training_carbs',category:'training',title:'Training-day carbohydrate difference',
      value:round(trainingCarbDelta,0),unit:'g/day',tone:trainingCarbDelta>15?'steady':'neutral',
      confidence:confidenceFromCount(training.length+rest.length,14),evidenceDays:training.length+rest.length,
      summary:`Moderate/hard training days averaged ${trainingCarbDelta>=0?'+':''}${round(trainingCarbDelta,0)} g carbohydrate versus rest days.`
    });
  }
  if(activityShift!=null){
    insights.push({
      id:'activity_shift',category:'activity',title:'Recent step baseline shift',
      value:round(activityShift*100,0),unit:'%',tone:Math.abs(activityShift)<0.15?'steady':'pattern',
      confidence:confidenceFromCount(recent7.length+prior14.length,14),evidenceDays:recent7.length+prior14.length,
      summary:`Recent median steps are ${activityShift>=0?'+':''}${round(activityShift*100,0)}% versus the preceding activity baseline.`
    });
  }
  if(activityCorrelation!=null){
    insights.push({
      id:'steps_intake_association',category:'association',title:'Steps and same-day intake',
      value:round(activityCorrelation,2),unit:'r',tone:'neutral',
      confidence:confidenceFromCount(pairedActivity.length,18),evidenceDays:pairedActivity.length,
      summary:`There is ${correlationLabel(activityCorrelation)} same-day association between steps and logged intake (r=${round(activityCorrelation,2)}). This is descriptive, not causal.`
    });
  }

  return {
    version:VERSION,
    window:{start,end,days:Number(windowDays)||28},
    quality:{
      reliableIntakeDays:round(reliable.reduce((s,r)=>s+r.reliability,0),1),
      observedReliableDays:reliable.length,proteinDays:proteinEligible.length,
      weekendDays:weekend.length,weekdayDays:weekday.length,trainingDays:training.length,
      restDays:rest.length,pairedActivityDays:pairedActivity.length,trendDays:trend.length
    },
    metrics:{
      averageCalories:round(avgCalories,0),calorieVariabilityCV:round(calorieCV,3),
      calorieTargetAdherence:calorieAdherence==null?null:round(calorieAdherence,3),
      proteinTargetAdherence:proteinAdherence==null?null:round(proteinAdherence,3),
      weekendAverageCalories:round(weekendAvg,0),weekdayAverageCalories:round(weekdayAvg,0),
      weekendDeltaCalories:round(weekendDelta,0),trainingAverageCarbs:round(trainingCarbs,0),
      restAverageCarbs:round(restCarbs,0),trainingCarbDelta:round(trainingCarbDelta,0),
      stepsIntakeCorrelation:round(activityCorrelation,3),recentMedianSteps:round(recentSteps,0),
      priorMedianSteps:round(priorSteps,0),activityShift:activityShift==null?null:round(activityShift,3),
      weeklyTrendRate:round(weeklyTrendRate,3)
    },
    insights,
    policy:{
      calculation:'deterministic_only',
      aiRole:'explanation_only_not_calculation',
      correlationMeaning:'association_not_causation',
      minimumEvidence:'insights withheld when sample thresholds are not met'
    }
  };
}
