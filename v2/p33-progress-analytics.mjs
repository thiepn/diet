export const DietProgressP33=Object.freeze({version:'1.0.0-p33',adherenceBand:.1,minimumPaceSpanDays:7});

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=(v,fallback=null)=>finite(v)?Number(v):fallback;
const round=(v,d=0)=>{
  if(!Number.isFinite(Number(v)))return null;
  const p=10**d;
  return Math.round(Number(v)*p)/p;
};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const ms=date=>{
  const value=Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(value)?value:NaN;
};
const key=value=>{
  const d=new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
};
const addDays=(date,days)=>Number.isFinite(ms(date))?key(ms(date)+Number(days)*86400000):String(date||'');
const dayDiff=(a,b)=>Number.isFinite(ms(a))&&Number.isFinite(ms(b))?Math.round((ms(b)-ms(a))/86400000):0;
const mean=values=>{
  const clean=values.map(Number).filter(Number.isFinite);
  return clean.length?clean.reduce((sum,v)=>sum+v,0)/clean.length:null;
};
const sorted=(series=[])=>[...series].filter(x=>x?.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

export const progressRangeStart=(asOfDate,days)=>addDays(asOfDate,-Math.max(0,Number(days||1)-1));

export function filterProgressSeries(series=[],asOfDate,days){
  const start=progressRangeStart(asOfDate,days);
  return sorted(series).filter(x=>String(x.date)>=start&&String(x.date)<=String(asOfDate));
}

function paceState(observed,target,spanDays){
  if(!finite(observed)||spanDays<DietProgressP33.minimumPaceSpanDays)
    return {state:'building',label:'Building pace',detail:'At least 7 days of trend history are needed.'};

  const o=Number(observed);
  if(!finite(target))
    return {state:'observed',label:'Observed pace',detail:`${o>0?'+':''}${round(o,2)} kg/week in this range.`};

  const t=Number(target);
  if(Math.abs(t)<.05){
    return Math.abs(o)<=.15
      ?{state:'on_track',label:'Maintenance range',detail:'Observed trend is near maintenance.'}
      :{state:'off_track',label:o>0?'Trending up':'Trending down',detail:'Observed trend is outside the maintenance band.'};
  }
  if(Math.sign(o)!==Math.sign(t)&&Math.abs(o)>.05)
    return {state:'off_track',label:'Moving away from target pace',detail:'Observed trend is moving opposite the selected pace.'};

  const gap=Math.abs(o-t);
  if(gap<=Math.max(.12,Math.abs(t)*.35))
    return {state:'on_track',label:'On pace',detail:'Observed trend is close to the selected weekly pace.'};

  return Math.abs(o)>Math.abs(t)
    ?{state:'faster',label:'Faster than planned',detail:'Observed trend is faster than the selected pace.'}
    :{state:'slower',label:'Slower than planned',detail:'Observed trend is slower than the selected pace.'};
}

function weekStart(date){
  const value=ms(date);
  if(!Number.isFinite(value))return String(date||'');
  const d=new Date(value);
  return key(value-((d.getUTCDay()+6)%7)*86400000);
}

function weeklyNutrition(intake=[]){
  const groups=new Map();
  for(const row of sorted(intake)){
    if(!finite(row.calories))continue;
    const week=weekStart(row.date);
    if(!groups.has(week))groups.set(week,[]);
    groups.get(week).push(row);
  }
  return [...groups].map(([startDate,rows])=>{
    const targeted=rows.filter(x=>finite(x.target)&&Number(x.target)>0);
    const avgCalories=mean(rows.map(x=>x.calories));
    const avgTarget=mean(targeted.map(x=>x.target));
    const adherent=targeted.filter(x=>Math.abs(Number(x.calories)-Number(x.target))/Number(x.target)<=DietProgressP33.adherenceBand).length;
    return {
      startDate,
      loggedDays:rows.length,
      averageCalories:round(avgCalories),
      averageTarget:round(avgTarget),
      averageVariance:avgCalories==null||avgTarget==null?null:round(avgCalories-avgTarget),
      adherenceRate:targeted.length?round(adherent/targeted.length,3):null
    };
  }).sort((a,b)=>a.startDate.localeCompare(b.startDate));
}

function intakeBars(intake,days){
  if(days<=35)return sorted(intake).map(x=>({
    date:x.date,calories:num(x.calories,0),target:num(x.target,0),kind:'day'
  }));
  return weeklyNutrition(intake).map(x=>({
    date:x.startDate,calories:x.averageCalories,target:x.averageTarget,kind:'week',loggedDays:x.loggedDays
  }));
}

export function buildProgressAnalytics({progress={},strategy={},asOfDate,days=90}={}){
  const rangeDays=Math.max(1,Math.round(Number(days)||90));
  const trend=filterProgressSeries(progress.trendWeights,asOfDate,rangeDays).filter(x=>finite(x.value));
  const rawWeights=filterProgressSeries(progress.rawWeights,asOfDate,rangeDays).filter(x=>finite(x.value));
  const expenditure=filterProgressSeries(progress.expenditure,asOfDate,rangeDays).filter(x=>finite(x.value));
  const intake=filterProgressSeries(progress.intake,asOfDate,rangeDays).filter(x=>finite(x.calories));

  const firstTrend=trend.at(0)??null,lastTrend=trend.at(-1)??null;
  const trendSpanDays=firstTrend&&lastTrend?Math.max(0,dayDiff(firstTrend.date,lastTrend.date)):0;
  const change=firstTrend&&lastTrend?Number(lastTrend.value)-Number(firstTrend.value):null;
  const weeklyRate=trendSpanDays>=DietProgressP33.minimumPaceSpanDays&&finite(change)?change/(trendSpanDays/7):null;
  const pace=paceState(weeklyRate,strategy.targetRateKgPerWeek,trendSpanDays);

  const targeted=intake.filter(x=>finite(x.target)&&Number(x.target)>0);
  const adherent=targeted.filter(x=>Math.abs(Number(x.calories)-Number(x.target))/Number(x.target)<=DietProgressP33.adherenceBand);
  const averageCalories=mean(intake.map(x=>x.calories));
  const averageTarget=mean(targeted.map(x=>x.target));

  const firstExp=expenditure.at(0)??null,lastExp=expenditure.at(-1)??null;
  const expChange=firstExp&&lastExp?Number(lastExp.value)-Number(firstExp.value):null;

  const currentWeight=lastTrend?Number(lastTrend.value):null;
  const goalWeight=num(strategy.goalWeight);
  const firstDistance=finite(goalWeight)&&firstTrend?Math.abs(Number(firstTrend.value)-goalWeight):null;
  const distance=finite(goalWeight)&&finite(currentWeight)?Math.abs(currentWeight-goalWeight):null;
  const movement=finite(firstDistance)&&finite(distance)?firstDistance-distance:null;

  const evidenceScore=clamp(
    intake.length/rangeDays*.45+
    Math.min(1,rawWeights.length/Math.max(2,Math.ceil(rangeDays/14)))*.30+
    Math.min(1,trendSpanDays/Math.min(rangeDays,28))*.25,
    0,1
  );

  return {
    version:DietProgressP33.version,
    range:{
      days:rangeDays,
      intakeDays:intake.length,
      weighIns:rawWeights.length,
      trendSpanDays,
      evidenceScore:round(evidenceScore,3),
      evidenceLabel:evidenceScore>=.8?'Strong':evidenceScore>=.55?'Useful':evidenceScore>=.3?'Partial':'Sparse'
    },
    weight:{
      first:firstTrend?round(firstTrend.value,2):null,
      current:lastTrend?round(lastTrend.value,2):null,
      change:round(change,2),
      weeklyRate:round(weeklyRate,2),
      targetRate:round(strategy.targetRateKgPerWeek,2),
      pace
    },
    nutrition:{
      targetDays:targeted.length,
      averageCalories:round(averageCalories),
      averageTarget:round(averageTarget),
      averageVariance:averageCalories==null||averageTarget==null?null:round(averageCalories-averageTarget),
      adherenceRate:targeted.length?round(adherent.length/targeted.length,3):null,
      adherenceDays:adherent.length,
      bandPercent:Math.round(DietProgressP33.adherenceBand*100)
    },
    expenditure:{
      current:lastExp?round(lastExp.value):null,
      change:round(expChange)
    },
    goal:{
      goalWeight:round(goalWeight,2),
      currentWeight:round(currentWeight,2),
      distanceKg:round(distance,2),
      movementTowardGoalKg:round(movement,2),
      projectedDate:progress.goalProjection?.projectedDate??null
    },
    chart:{trend,rawWeights,expenditure,intakeBars:intakeBars(intake,rangeDays)},
    weeks:weeklyNutrition(intake).slice(-8)
  };
}
