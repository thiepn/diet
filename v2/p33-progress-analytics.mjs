export const DietProgressP33=Object.freeze({
  version:'1.0.0-p33',
  adherenceBand:0.10,
  minimumPaceSpanDays:7
});

function finite(value){
  return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
}
function number(value,fallback=null){return finite(value)?Number(value):fallback;}
function round(value,digits=0){
  if(!Number.isFinite(Number(value)))return null;
  const p=10**digits;
  return Math.round(Number(value)*p)/p;
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function dateParts(key){
  const [y,m,d]=String(key||'').split('-').map(Number);
  return Number.isFinite(y)&&Number.isFinite(m)&&Number.isFinite(d)?{y,m,d}:null;
}
function dateMs(key){
  const p=dateParts(key);
  return p?Date.UTC(p.y,p.m-1,p.d):NaN;
}
function dateKey(ms){
  const d=new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function addDays(key,days){
  const ms=dateMs(key);
  return Number.isFinite(ms)?dateKey(ms+Number(days)*86400000):String(key||'');
}
function dayDiff(a,b){
  const start=dateMs(a),end=dateMs(b);
  return Number.isFinite(start)&&Number.isFinite(end)?Math.round((end-start)/86400000):0;
}
function mean(values){
  const clean=values.map(Number).filter(Number.isFinite);
  return clean.length?clean.reduce((sum,value)=>sum+value,0)/clean.length:null;
}
function sorted(series=[]){
  return [...series]
    .filter(item=>item&&item.date)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
export function progressRangeStart(asOfDate,days){
  return addDays(asOfDate,-Math.max(0,Number(days||1)-1));
}
export function filterProgressSeries(series=[],asOfDate,days){
  const start=progressRangeStart(asOfDate,days);
  return sorted(series).filter(item=>String(item.date)>=start&&String(item.date)<=String(asOfDate));
}

function paceState(observed,target,spanDays){
  if(!finite(observed)||spanDays<DietProgressP33.minimumPaceSpanDays){
    return {state:'building',label:'Building pace',detail:'At least 7 days of trend history are needed.'};
  }
  const o=Number(observed);
  if(!finite(target)){
    return {state:'observed',label:'Observed pace',detail:`${o>0?'+':''}${round(o,2)} kg/week over this range.`};
  }
  const t=Number(target);
  if(Math.abs(t)<0.05){
    if(Math.abs(o)<=0.15)return {state:'on_track',label:'Maintenance range',detail:'Observed trend is close to weight maintenance.'};
    return {state:'off_track',label:o>0?'Trending up':'Trending down',detail:'Observed trend is outside the maintenance band.'};
  }
  const sameDirection=Math.sign(o)===Math.sign(t);
  if(!sameDirection&&Math.abs(o)>0.05){
    return {state:'off_track',label:'Moving away from target pace',detail:'Observed trend is moving in the opposite direction from the selected pace.'};
  }
  const tolerance=Math.max(0.12,Math.abs(t)*0.35);
  const gap=Math.abs(o-t);
  if(gap<=tolerance){
    return {state:'on_track',label:'On pace',detail:'Observed trend is close to the selected weekly pace.'};
  }
  if(Math.abs(o)>Math.abs(t)){
    return {state:'faster',label:'Faster than planned',detail:'Observed trend is moving faster than the selected pace.'};
  }
  return {state:'slower',label:'Slower than planned',detail:'Observed trend is moving slower than the selected pace.'};
}

function weeklyKey(date){
  const ms=dateMs(date);
  if(!Number.isFinite(ms))return String(date||'');
  const d=new Date(ms);
  const offset=(d.getUTCDay()+6)%7;
  return dateKey(ms-offset*86400000);
}
function weeklyNutrition(intake=[]){
  const groups=new Map();
  for(const row of sorted(intake)){
    if(!finite(row.calories))continue;
    const key=weeklyKey(row.date);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([startDate,rows])=>{
    const eligible=rows.filter(row=>finite(row.target)&&Number(row.target)>0);
    const adherence=eligible.filter(row=>Math.abs(Number(row.calories)-Number(row.target))/Number(row.target)<=DietProgressP33.adherenceBand).length;
    const avgCalories=mean(rows.map(row=>row.calories));
    const avgTarget=mean(eligible.map(row=>row.target));
    return {
      startDate,
      endDate:addDays(startDate,6),
      loggedDays:rows.length,
      targetDays:eligible.length,
      averageCalories:round(avgCalories,0),
      averageTarget:round(avgTarget,0),
      averageVariance:avgCalories==null||avgTarget==null?null:round(avgCalories-avgTarget,0),
      adherenceRate:eligible.length?round(adherence/eligible.length,3):null,
      averageProtein:round(mean(rows.map(row=>row.protein)),1)
    };
  }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
}

function compressIntakeBars(intake=[],days=90){
  if(days<=35)return sorted(intake).map(row=>({
    date:row.date,
    calories:number(row.calories,0),
    target:number(row.target,0),
    kind:'day'
  }));
  return weeklyNutrition(intake).map(week=>({
    date:week.startDate,
    calories:week.averageCalories,
    target:week.averageTarget,
    kind:'week',
    loggedDays:week.loggedDays
  }));
}

export function buildProgressAnalytics({progress={},strategy={},asOfDate,days=90}={}){
  const rangeDays=Math.max(1,Math.round(Number(days)||90));
  const startDate=progressRangeStart(asOfDate,rangeDays);
  const trend=filterProgressSeries(progress.trendWeights,asOfDate,rangeDays).filter(row=>finite(row.value));
  const rawWeights=filterProgressSeries(progress.rawWeights,asOfDate,rangeDays).filter(row=>finite(row.value));
  const expenditure=filterProgressSeries(progress.expenditure,asOfDate,rangeDays).filter(row=>finite(row.value));
  const intake=filterProgressSeries(progress.intake,asOfDate,rangeDays).filter(row=>finite(row.calories));

  const firstTrend=trend.at(0)??null;
  const lastTrend=trend.at(-1)??null;
  const trendSpanDays=firstTrend&&lastTrend?Math.max(0,dayDiff(firstTrend.date,lastTrend.date)):0;
  const trendChange=firstTrend&&lastTrend?Number(lastTrend.value)-Number(firstTrend.value):null;
  const weeklyRate=trendSpanDays>=DietProgressP33.minimumPaceSpanDays&&finite(trendChange)
    ?Number(trendChange)/(trendSpanDays/7)
    :null;
  const pace=paceState(weeklyRate,strategy.targetRateKgPerWeek,trendSpanDays);

  const targeted=intake.filter(row=>finite(row.target)&&Number(row.target)>0);
  const adherent=targeted.filter(row=>Math.abs(Number(row.calories)-Number(row.target))/Number(row.target)<=DietProgressP33.adherenceBand);
  const averageCalories=mean(intake.map(row=>row.calories));
  const averageTarget=mean(targeted.map(row=>row.target));
  const intakeVariance=averageCalories==null||averageTarget==null?null:averageCalories-averageTarget;

  const firstExpenditure=expenditure.at(0)??null;
  const lastExpenditure=expenditure.at(-1)??null;
  const expChange=firstExpenditure&&lastExpenditure?Number(lastExpenditure.value)-Number(firstExpenditure.value):null;
  const expConfidence=lastExpenditure&&finite(lastExpenditure.confidence)?Number(lastExpenditure.confidence):null;

  const currentWeight=lastTrend?Number(lastTrend.value):null;
  const goalWeight=number(strategy.goalWeight);
  const firstDistance=finite(goalWeight)&&firstTrend?Math.abs(Number(firstTrend.value)-goalWeight):null;
  const currentDistance=finite(goalWeight)&&finite(currentWeight)?Math.abs(currentWeight-goalWeight):null;
  const movementTowardGoal=finite(firstDistance)&&finite(currentDistance)?Number(firstDistance)-Number(currentDistance):null;

  const intakeCoverage=clamp(intake.length/rangeDays,0,1);
  const weightCoverage=rawWeights.length;
  const evidenceScore=clamp(
    intakeCoverage*0.45+
    Math.min(1,rawWeights.length/Math.max(2,Math.ceil(rangeDays/14)))*0.30+
    Math.min(1,trendSpanDays/Math.min(rangeDays,28))*0.25,
    0,1
  );

  const weeks=weeklyNutrition(intake);
  const latestWeeks=weeks.slice(-8);

  return {
    version:DietProgressP33.version,
    range:{
      days:rangeDays,
      startDate,
      endDate:asOfDate,
      intakeDays:intake.length,
      weighIns:rawWeights.length,
      trendSpanDays,
      evidenceScore:round(evidenceScore,3),
      evidenceLabel:evidenceScore>=0.8?'Strong':evidenceScore>=0.55?'Useful':evidenceScore>=0.3?'Partial':'Sparse'
    },
    weight:{
      first:firstTrend?round(firstTrend.value,2):null,
      current:lastTrend?round(lastTrend.value,2):null,
      change:round(trendChange,2),
      weeklyRate:round(weeklyRate,2),
      targetRate:round(strategy.targetRateKgPerWeek,2),
      pace
    },
    nutrition:{
      loggedDays:intake.length,
      targetDays:targeted.length,
      averageCalories:round(averageCalories,0),
      averageTarget:round(averageTarget,0),
      averageVariance:round(intakeVariance,0),
      adherenceRate:targeted.length?round(adherent.length/targeted.length,3):null,
      adherenceDays:adherent.length,
      bandPercent:Math.round(DietProgressP33.adherenceBand*100)
    },
    expenditure:{
      first:firstExpenditure?round(firstExpenditure.value,0):null,
      current:lastExpenditure?round(lastExpenditure.value,0):null,
      average:round(mean(expenditure.map(row=>row.value)),0),
      change:round(expChange,0),
      confidence:round(expConfidence,3)
    },
    goal:{
      mode:strategy.goalMode??null,
      goalWeight:round(goalWeight,2),
      currentWeight:round(currentWeight,2),
      distanceKg:round(currentDistance,2),
      movementTowardGoalKg:round(movementTowardGoal,2),
      projectedDate:progress.goalProjection?.projectedDate??null,
      projectedWeeks:round(progress.goalProjection?.weeks,1),
      paceState:pace.state,
      paceLabel:pace.label
    },
    chart:{
      trend,
      rawWeights,
      expenditure,
      intakeBars:compressIntakeBars(intake,rangeDays)
    },
    weeks:latestWeeks
  };
}
