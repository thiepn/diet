import { DEFAULT_CONFIG } from './adaptive-nutrition.mjs';

function finite(value){
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
function n(value){ return finite(value) ? Number(value) : null; }

export function legacyPhaseToGoalMode(phaseType, desiredRate=null){
  const phase=String(phaseType ?? '').toLowerCase();
  if(phase==='cut'||phase==='loss'||phase==='lose') return 'lose';
  if(phase==='gain'||phase==='bulk') return 'gain';
  if(phase==='maintain'||phase==='maintenance') return 'maintain';
  const rate=n(desiredRate);
  if(rate==null||Math.abs(rate)<0.01) return 'maintain';
  return rate<0?'lose':'gain';
}

export function deriveLegacyInitialTdee({currentTarget,desiredWeeklyWeightChange,energyDensityKcalPerKg=DEFAULT_CONFIG.energyDensityKcalPerKg}={}){
  const target=n(currentTarget);
  const rate=n(desiredWeeklyWeightChange);
  if(target==null) return {value:null,source:'unavailable'};
  if(rate==null) return {value:target,source:'current_target_no_rate'};
  return {
    value:target-rate*Number(energyDensityKcalPerKg)/7,
    source:'implied_by_current_target_and_goal_rate'
  };
}

export function mapLegacyDay(day,{asOfDate}={}){
  const date=String(day?.date ?? day?.log_date ?? '');
  const legacyStatus=String(day?.status ?? '').toLowerCase();
  let coverage='';
  // Legacy V1 explicitly treated Open/Partial/Complete as coverage metadata,
  // not as inclusion/exclusion semantics. Only "complete" is a strong positive
  // signal. Old "partial" is intentionally NOT mapped to P1 "partial".
  if(legacyStatus==='complete') coverage='complete';
  else if(['excluded','ignore'].includes(legacyStatus)) coverage='excluded';

  return {
    date,
    calories:n(day?.calories),
    meals:n(day?.meals ?? day?.meal_count) ?? 0,
    coverage,
    uncertaintyKcal:n(day?.uncertaintyKcal ?? day?.uncertainty_kcal) ?? 0,
    dayClosed:Boolean(asOfDate && date && date<asOfDate),
    legacyStatus,
    legacyCalorieTarget:n(day?.calorie_target),
    legacyProteinTarget:n(day?.protein_target),
  };
}

export function mapLegacyDietData(snapshot,{asOfDate=null,config={}}={}){
  const cfg={...DEFAULT_CONFIG,...config};
  const profile=snapshot?.profile ?? {};
  const phase=snapshot?.phase ?? {};
  const effectiveDate=asOfDate ?? snapshot?.asOfDate ?? snapshot?.as_of_date ??
    [...(snapshot?.weights??[]).map(x=>x.date),...(snapshot?.daily??[]).map(x=>x.date)].filter(Boolean).sort().at(-1) ?? null;

  const currentTarget=n(phase?.calorie_target) ?? n(profile?.calorie_target);
  const desiredRate=n(phase?.desired_weekly_weight_change) ?? n(profile?.desired_weekly_weight_change) ?? 0;
  const goalWeight=n(phase?.goal_weight) ?? n(profile?.goal_weight);
  const goalMode=legacyPhaseToGoalMode(phase?.phase_type,desiredRate);
  const initial=deriveLegacyInitialTdee({
    currentTarget,
    desiredWeeklyWeightChange:desiredRate,
    energyDensityKcalPerKg:cfg.energyDensityKcalPerKg
  });

  const daily=(snapshot?.daily??[])
    .map(row=>mapLegacyDay(row,{asOfDate:effectiveDate}))
    .filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date<=effectiveDate && finite(row.calories));

  const weights=(snapshot?.weights??[])
    .map(row=>({date:String(row?.date ?? row?.entry_date ?? ''),weight:n(row?.weight)}))
    .filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date<=effectiveDate && row.weight!=null && row.weight>0);

  const latestWeight=weights.length?weights.at(-1).weight:null;

  return {
    engineInput:{
      weights,
      intakeDays:daily,
      initialTdee:initial.value,
      currentTarget,
      goalMode,
      targetRateKgPerWeek:desiredRate,
      goalWeight,
      bodyWeightKg:latestWeight,
      endDate:effectiveDate,
      config,
    },
    meta:{
      adapterVersion:'1.0.0-p1.5',
      asOfDate:effectiveDate,
      source:'diet_v1_legacy_tables',
      initialTdeeSource:initial.source,
      legacyDailyRows:daily.length,
      legacyWeightRows:weights.length,
      legacyStatusCounts:daily.reduce((acc,row)=>{acc[row.legacyStatus||'blank']=(acc[row.legacyStatus||'blank']||0)+1;return acc;},{}),
      warning:'Legacy Open/Partial statuses are metadata only and are conservatively reclassified by the P1 intake-coverage engine.'
    }
  };
}
