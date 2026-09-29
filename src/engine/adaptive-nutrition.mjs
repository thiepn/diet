const DAY_MS = 86400000;

export const ENGINE_VERSION = '1.0.0-p1';
export const DEFAULT_CONFIG = Object.freeze({
  trendWindowDays: 20,
  trendHalfLifeDays: 7,
  expenditureWindowDays: 20,
  minimumWeightSpanDays: 14,
  minimumReliableIntakeDays: 10,
  targetReliableIntakeDays: 16,
  targetWeighInsPerWeek: 3,
  energyDensityKcalPerKg: 7700,
  maximumDailyExpenditureStep: 50,
  recommendationDeadbandKcal: 50,
  maximumWeeklyTargetStepKcal: 150,
  minimumCalories: 1200,
  maximumCalories: 6000,
  proteinGramsPerKg: 1.8,
  fatGramsPerKg: 0.7,
});

function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
function round(v, digits=0){ if(v == null || !Number.isFinite(v)) return null; const p=10**digits; return Math.round(v*p)/p; }
function median(xs){
  if(!xs.length) return null;
  const a=[...xs].sort((x,y)=>x-y), m=Math.floor(a.length/2);
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
}
function mad(xs){
  if(xs.length<2) return 0;
  const m=median(xs); return median(xs.map(x=>Math.abs(x-m))) || 0;
}
function parseDate(date){
  const t=Date.parse(`${date}T00:00:00Z`);
  if(!Number.isFinite(t)) throw new Error(`Invalid ISO date: ${date}`);
  return t;
}
function isoDate(t){ return new Date(t).toISOString().slice(0,10); }
function dayDiff(a,b){ return Math.round((parseDate(a)-parseDate(b))/DAY_MS); }
function addDays(date, n){ return isoDate(parseDate(date)+n*DAY_MS); }

export function normalizeWeightEntries(entries=[]){
  const byDate=new Map();
  for(const raw of entries){
    const date=String(raw?.date ?? raw?.entry_date ?? '');
    const weight=Number(raw?.weight);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(weight) || weight<=0) continue;
    byDate.set(date,{date,weight});
  }
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function weightedLinearFit(points, targetX, halfLifeDays=7){
  if(!points.length) return null;
  if(points.length===1) return {estimate:points[0].y,slope:0,residualMad:0,r2:null};
  let robust=points.map(()=>1);
  let fit=null;
  for(let iter=0;iter<3;iter++){
    const weights=points.map((p,i)=>Math.pow(0.5,Math.max(0,targetX-p.x)/halfLifeDays)*robust[i]);
    const sw=weights.reduce((a,b)=>a+b,0) || 1;
    const mx=points.reduce((s,p,i)=>s+weights[i]*p.x,0)/sw;
    const my=points.reduce((s,p,i)=>s+weights[i]*p.y,0)/sw;
    const den=points.reduce((s,p,i)=>s+weights[i]*(p.x-mx)**2,0);
    const slope=den>0 ? points.reduce((s,p,i)=>s+weights[i]*(p.x-mx)*(p.y-my),0)/den : 0;
    const intercept=my-slope*mx;
    const residuals=points.map(p=>p.y-(intercept+slope*p.x));
    const scale=Math.max(0.08,1.4826*mad(residuals));
    robust=residuals.map(r=>{
      const a=Math.abs(r), k=1.5*scale;
      return a<=k ? 1 : k/a;
    });
    const ssRes=points.reduce((s,p,i)=>s+weights[i]*(p.y-(intercept+slope*p.x))**2,0);
    const ssTot=points.reduce((s,p,i)=>s+weights[i]*(p.y-my)**2,0);
    fit={estimate:intercept+slope*targetX,slope,residualMad:mad(residuals),r2:ssTot>0?clamp(1-ssRes/ssTot,0,1):1};
  }
  return fit;
}

export function buildTrendWeights(entries, options={}){
  const cfg={...DEFAULT_CONFIG,...options};
  const weights=normalizeWeightEntries(entries);
  if(!weights.length) return [];
  const first=parseDate(weights[0].date), last=parseDate(weights.at(-1).date);
  const points=weights.map(w=>({x:(parseDate(w.date)-first)/DAY_MS,y:w.weight,date:w.date}));
  const out=[];
  for(let t=first;t<=last;t+=DAY_MS){
    const x=(t-first)/DAY_MS;
    const minX=Math.max(0,x-cfg.trendWindowDays+1);
    const available=points.filter(p=>p.x>=minX && p.x<=x);
    if(!available.length) continue;
    const fit=weightedLinearFit(available,x,cfg.trendHalfLifeDays);
    const recent=available.at(-1);
    const maxDeviation=Math.max(1.2,recent.y*0.018);
    const estimate=clamp(fit.estimate,recent.y-maxDeviation,recent.y+maxDeviation);
    out.push({
      date:isoDate(t),
      trendWeight:estimate,
      localSlopeKgPerDay:fit.slope,
      residualMadKg:fit.residualMad,
      r2:fit.r2,
      observed:available.some(p=>p.x===x),
      observationsInWindow:available.length,
    });
  }
  return out;
}

export function assessIntakeCoverage(days=[], options={}){
  const normalized=days.map(d=>({
    date:String(d.date ?? d.log_date ?? ''),
    calories:Number(d.calories),
    meals:Number(d.meals ?? d.mealCount ?? d.meal_count ?? 0),
    status:String(d.coverage ?? d.status ?? '').toLowerCase(),
    uncertaintyKcal:Number(d.uncertaintyKcal ?? d.uncertainty_kcal ?? 0),
    dayClosed:Boolean(d.dayClosed ?? d.day_closed ?? false),
  })).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(d.calories) && d.calories>=0)
    .sort((a,b)=>a.date.localeCompare(b.date));

  const explicitlyReliable=normalized.filter(d=>['complete','likely_complete'].includes(d.status) && d.calories>0).map(d=>d.calories);
  const positive=normalized.filter(d=>d.calories>0).map(d=>d.calories);
  const intakeMedian=median(explicitlyReliable.length>=3?explicitlyReliable:positive);

  return normalized.map(d=>{
    let coverage='unknown';
    let reason='No reliable completeness signal.';
    if(['excluded','ignore'].includes(d.status)){ coverage='excluded'; reason='Explicitly excluded.'; }
    else if(['partial','incomplete'].includes(d.status)){ coverage='partial'; reason='Explicitly marked partial.'; }
    else if(d.status==='complete'){ coverage='complete'; reason='Explicitly marked complete.'; }
    else if(d.status==='likely_complete'){ coverage='likely_complete'; reason='Explicitly marked likely complete.'; }
    else if(d.calories<=0){ coverage='unknown'; reason='No logged energy.'; }
    else {
      const reference=intakeMedian || null;
      const ratio=reference ? d.calories/reference : null;
      if(d.dayClosed && d.meals>=2 && (!reference || ratio>=0.55)){
        coverage='likely_complete'; reason='Closed day with multiple meals and plausible total intake.';
      } else if(reference && d.meals>=2 && ratio>=0.70 && ratio<=1.45 && d.uncertaintyKcal<350){
        coverage='likely_complete'; reason='Intake is consistent with established logged-day pattern.';
      } else if(reference && ratio<0.55){
        coverage='partial'; reason='Logged energy is far below the established intake pattern.';
      }
    }
    const reliability=coverage==='complete'?1:coverage==='likely_complete'?0.75:0;
    const uncertaintyPenalty=Number.isFinite(d.uncertaintyKcal) ? clamp(1-d.uncertaintyKcal/600,0.25,1) : 1;
    return {...d,coverage,reliability:reliability*uncertaintyPenalty,reason};
  });
}

function trendSlice(trend,start,end){ return trend.filter(x=>x.date>=start&&x.date<=end); }
function weightedIntakeMean(days,start,end){
  const rows=days.filter(d=>d.date>=start&&d.date<=end&&d.reliability>0&&d.calories>0);
  const sw=rows.reduce((s,d)=>s+d.reliability,0);
  return {mean:sw?rows.reduce((s,d)=>s+d.calories*d.reliability,0)/sw:null,effectiveDays:sw,rows};
}

export function estimateExpenditure({weights=[],intakeDays=[],initialTdee=null,endDate=null,config={}}={}){
  const cfg={...DEFAULT_CONFIG,...config};
  const trend=buildTrendWeights(weights,cfg);
  const assessed=assessIntakeCoverage(intakeDays,cfg);
  if(!trend.length) return {version:ENGINE_VERSION,status:'building_baseline',trend,assessedIntake:assessed,series:[],current:null,confidence:buildConfidence({trend,assessed,series:[],cfg})};
  const lastDate=endDate || trend.at(-1).date;
  const series=[];
  let state=Number.isFinite(Number(initialTdee))?Number(initialTdee):null;
  let sameDirection=0, lastSign=0;
  for(const point of trend){
    if(point.date>lastDate) break;
    const start=addDays(point.date,-cfg.expenditureWindowDays+1);
    const t=trendSlice(trend,start,point.date);
    if(t.length<cfg.minimumWeightSpanDays) continue;
    const intake=weightedIntakeMean(assessed,start,point.date);
    const observedCount=t.filter(x=>x.observed).length;
    const span=dayDiff(t.at(-1).date,t[0].date);
    if(span<cfg.minimumWeightSpanDays || intake.effectiveDays<cfg.minimumReliableIntakeDays || observedCount<4) continue;
    const fit=weightedLinearFit(t.map(x=>({x:dayDiff(x.date,t[0].date),y:x.trendWeight})),span,cfg.trendHalfLifeDays);
    const weeklyRate=fit.slope*7;
    const energyChangePerDay=weeklyRate*cfg.energyDensityKcalPerKg/7;
    const observation=intake.mean-energyChangePerDay;
    const noiseScore=clamp(1-(fit.residualMad/0.35),0,1);
    const intakeScore=clamp(intake.effectiveDays/cfg.targetReliableIntakeDays,0,1);
    const weightScore=clamp(observedCount/(cfg.targetWeighInsPerWeek*(cfg.expenditureWindowDays/7)),0,1);
    const measurementConfidence=0.4*intakeScore+0.35*weightScore+0.25*noiseScore;
    if(state==null) state=observation;
    const innovation=observation-state;
    const sign=Math.sign(innovation);
    sameDirection=sign!==0&&sign===lastSign?sameDirection+1:1;
    lastSign=sign;
    const persistence=clamp(1+(sameDirection-1)*0.08,1,1.45);
    const alpha=clamp((0.10+0.22*measurementConfidence)*persistence,0.10,0.45);
    const proposed=state+innovation*alpha;
    const step=clamp(proposed-state,-cfg.maximumDailyExpenditureStep,cfg.maximumDailyExpenditureStep);
    state+=step;
    series.push({
      date:point.date,
      expenditure:state,
      observedExpenditure:observation,
      avgIntake:intake.mean,
      effectiveIntakeDays:intake.effectiveDays,
      weighIns:observedCount,
      weeklyWeightRate:weeklyRate,
      trendResidualMadKg:fit.residualMad,
      measurementConfidence,
      updateStep:step,
    });
  }
  const confidence=buildConfidence({trend,assessed,series,cfg});
  const current=series.length?series.at(-1):null;
  const currentRounded=current?round(current.expenditure,0):null;
  return {
    version:ENGINE_VERSION,
    status:current?confidence.level:'building_baseline',
    trend,
    assessedIntake:assessed,
    series,
    current:current?{...current,expenditure:currentRounded,observedExpenditure:round(current.observedExpenditure,0),avgIntake:round(current.avgIntake,0),weeklyWeightRate:round(current.weeklyWeightRate,3),measurementConfidence:round(current.measurementConfidence,3),rangeLow:round(currentRounded-confidence.uncertaintyKcal,0),rangeHigh:round(currentRounded+confidence.uncertaintyKcal,0)}:null,
    confidence,
  };
}

function buildConfidence({trend,assessed,series,cfg}){
  const lastDate=trend.at(-1)?.date;
  if(!lastDate) return {score:0,level:'building_baseline',components:{}};
  const start=addDays(lastDate,-cfg.expenditureWindowDays+1);
  const recentTrend=trendSlice(trend,start,lastDate);
  const recentIntake=assessed.filter(d=>d.date>=start&&d.date<=lastDate);
  const reliable=recentIntake.filter(d=>d.reliability>0);
  const reliableWeight=reliable.reduce((s,d)=>s+d.reliability,0);
  const weighIns=recentTrend.filter(x=>x.observed).length;
  const span=recentTrend.length?dayDiff(recentTrend.at(-1).date,recentTrend[0].date):0;
  const noise=series.at(-1)?.trendResidualMadKg ?? median(recentTrend.map(x=>x.residualMadKg).filter(Number.isFinite)) ?? 1;
  const intake=clamp(reliableWeight/cfg.targetReliableIntakeDays,0,1);
  const weight=clamp(weighIns/(cfg.targetWeighInsPerWeek*(cfg.expenditureWindowDays/7)),0,1);
  const time=clamp(span/cfg.expenditureWindowDays,0,1);
  const stability=clamp(1-noise/0.35,0,1);
  const score=round(0.38*intake+0.30*weight+0.17*time+0.15*stability,3);
  const level=score>=0.82?'high':score>=0.62?'medium':score>=0.42?'low':'building_baseline';
  const recentObservations=series.slice(-10).map(x=>x.observedExpenditure).filter(Number.isFinite);
  const observationSpread=recentObservations.length>=3 ? 1.4826*mad(recentObservations) : 250;
  const uncertaintyKcal=round(clamp(Math.max(50,observationSpread)+250*(1-score),50,500),0);
  return {score,level,uncertaintyKcal,components:{intake:round(intake,3),weight:round(weight,3),time:round(time,3),stability:round(stability,3)},reliableIntakeDays:round(reliableWeight,2),weighIns,spanDays:span};
}

export function recommendCalories({expenditure,currentTarget,goalMode='maintain',targetRateKgPerWeek=0,currentTrendWeight=null,goalWeight=null,confidence=null,config={}}={}){
  const cfg={...DEFAULT_CONFIG,...config};
  const tdee=Number(expenditure);
  const current=Number(currentTarget);
  if(!Number.isFinite(tdee)) return {decision:'need_more_data',reason:'No expenditure estimate is available.',recommendedTarget:Number.isFinite(current)?current:null};
  const score=typeof confidence==='number'?confidence:Number(confidence?.score ?? 0);
  const level=confidence?.level ?? (score>=0.82?'high':score>=0.62?'medium':score>=0.42?'low':'building_baseline');
  let rate=Number(targetRateKgPerWeek)||0;
  if(goalMode==='maintain') rate=0;
  if(goalMode==='lose' && rate>0) rate=-rate;
  if(goalMode==='gain' && rate<0) rate=-rate;

  const hasCurrent=currentTrendWeight!==null&&currentTrendWeight!==undefined&&Number.isFinite(Number(currentTrendWeight));
  const hasGoal=goalWeight!==null&&goalWeight!==undefined&&Number.isFinite(Number(goalWeight));
  const remaining=(hasCurrent&&hasGoal)?Math.abs(Number(currentTrendWeight)-Number(goalWeight)):null;
  if(goalMode!=='maintain' && remaining!=null && remaining<=0.3){
    const target=round(clamp(tdee,cfg.minimumCalories,cfg.maximumCalories)/25)*25;
    return {decision:'transition_maintenance',reason:'Goal range is effectively reached.',rawTarget:round(tdee,0),recommendedTarget:target,remainingKg:round(remaining,2)};
  }
  if(goalMode!=='maintain' && remaining!=null && remaining<=1.5){
    return {decision:'prepare_maintenance',reason:'Goal is close; avoid aggressive target changes.',rawTarget:round(tdee+rate*cfg.energyDensityKcalPerKg/7,0),recommendedTarget:Number.isFinite(current)?current:round(tdee/25)*25,remainingKg:round(remaining,2)};
  }

  const raw=clamp(tdee+rate*cfg.energyDensityKcalPerKg/7,cfg.minimumCalories,cfg.maximumCalories);
  if(!Number.isFinite(current)) return {decision:'set_initial_target',reason:'No current calorie target exists.',rawTarget:round(raw,0),recommendedTarget:round(raw/25)*25};
  const delta=raw-current;
  if(level==='building_baseline' || level==='low') return {decision:'hold_for_confidence',reason:'Expenditure confidence is not high enough to change calories.',rawTarget:round(raw,0),recommendedTarget:current,delta:round(delta,0)};
  if(Math.abs(delta)<cfg.recommendationDeadbandKcal) return {decision:'keep_target',reason:'The calculated change is smaller than the adjustment deadband.',rawTarget:round(raw,0),recommendedTarget:current,delta:round(delta,0)};
  const cap=level==='high'?cfg.maximumWeeklyTargetStepKcal:Math.min(100,cfg.maximumWeeklyTargetStepKcal);
  const recommended=round((current+clamp(delta,-cap,cap))/25)*25;
  return {decision:recommended>current?'increase':'decrease',reason:'Move gradually toward the target implied by current expenditure and goal rate.',rawTarget:round(raw,0),recommendedTarget:recommended,delta:round(delta,0),appliedStep:recommended-current};
}

export function computeMacroTargets({calories,bodyWeightKg,proteinGramsPerKg=null,fatGramsPerKg=null,proteinFloorGrams=null,fatFloorGrams=null,config={}}={}){
  const cfg={...DEFAULT_CONFIG,...config};
  const kcal=Number(calories), bw=Number(bodyWeightKg);
  if(!Number.isFinite(kcal)||kcal<=0||!Number.isFinite(bw)||bw<=0) return null;
  const pRate=Number.isFinite(Number(proteinGramsPerKg))?Number(proteinGramsPerKg):cfg.proteinGramsPerKg;
  const fRate=Number.isFinite(Number(fatGramsPerKg))?Number(fatGramsPerKg):cfg.fatGramsPerKg;
  const protein=Math.max(Number(proteinFloorGrams)||0,bw*pRate);
  const fat=Math.max(Number(fatFloorGrams)||0,bw*fRate);
  const fixed=protein*4+fat*9;
  const carbs=Math.max(0,(kcal-fixed)/4);
  return {calories:round(kcal,0),proteinGrams:round(protein,0),fatGrams:round(fat,0),carbGrams:round(carbs,0),proteinKcal:round(protein*4,0),fatKcal:round(fat*9,0),carbKcal:round(carbs*4,0)};
}

export function projectGoal({currentTrendWeight,goalWeight,targetRateKgPerWeek,startDate}={}){
  const current=Number(currentTrendWeight), goal=Number(goalWeight), rate=Number(targetRateKgPerWeek);
  if(!Number.isFinite(current)||!Number.isFinite(goal)||!Number.isFinite(rate)||Math.abs(rate)<0.01||!startDate) return null;
  if((goal-current)*rate<=0) return null;
  const weeks=Math.abs(goal-current)/Math.abs(rate);
  return {weeks:round(weeks,1),projectedDate:addDays(startDate,Math.ceil(weeks*7)),label:'projection_not_guarantee'};
}

export function runAdaptiveNutritionEngine(input={}){
  const estimate=estimateExpenditure(input);
  const latestTrend=estimate.trend.at(-1)?.trendWeight ?? null;
  const calorieRecommendation=recommendCalories({
    expenditure:estimate.current?.expenditure,
    currentTarget:input.currentTarget,
    goalMode:input.goalMode,
    targetRateKgPerWeek:input.targetRateKgPerWeek,
    currentTrendWeight:latestTrend,
    goalWeight:input.goalWeight,
    confidence:estimate.confidence,
    config:input.config,
  });
  const macros=computeMacroTargets({
    calories:calorieRecommendation.recommendedTarget,
    bodyWeightKg:latestTrend ?? input.bodyWeightKg,
    proteinGramsPerKg:input.proteinGramsPerKg,
    fatGramsPerKg:input.fatGramsPerKg,
    proteinFloorGrams:input.proteinFloorGrams,
    fatFloorGrams:input.fatFloorGrams,
    config:input.config,
  });
  const goalProjection=projectGoal({currentTrendWeight:latestTrend,goalWeight:input.goalWeight,targetRateKgPerWeek:Number(input.targetRateKgPerWeek)||0,startDate:input.endDate ?? estimate.trend.at(-1)?.date});
  return {version:ENGINE_VERSION,estimate,calorieRecommendation,macros,goalProjection};
}
