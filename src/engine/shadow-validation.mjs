function num(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;}
function diff(a,b){a=num(a);b=num(b);return a==null||b==null?null:b-a;}
function holdLike(decision){return ['need_more_data','keep_target','observe_another_week','disabled','hold_for_confidence','prepare_maintenance'].includes(String(decision??''));}

export function buildShadowComparison({legacyV1={},p1Result=null,adapterMeta={}}={}){
  const v1Decision=legacyV1?.decision ?? legacyV1?.v1_decision?.decision ?? null;
  const v1Recommended=num(legacyV1?.recommended_target ?? legacyV1?.v1_decision?.recommended_target);
  const v1Tdee=num(legacyV1?.estimated_maintenance ?? legacyV1?.v1_decision?.estimated_maintenance);
  const v1TrendWeight=num(legacyV1?.trend_weight ?? legacyV1?.v1_decision?.trend_weight);
  const v1WeeklyRate=num(legacyV1?.observed_weekly_pace ?? legacyV1?.v1_decision?.observed_weekly_pace);
  const v1Confidence=legacyV1?.trend_confidence?.weight?.confidence ??
    legacyV1?.v1_decision?.trend_confidence?.weight?.confidence ?? null;

  const p1Decision=p1Result?.calorieRecommendation?.decision ?? null;
  const p1Recommended=num(p1Result?.calorieRecommendation?.recommendedTarget);
  const p1Tdee=num(p1Result?.estimate?.current?.expenditure);
  const p1TrendWeight=num(p1Result?.estimate?.trend?.at?.(-1)?.trendWeight);
  const p1WeeklyRate=num(p1Result?.estimate?.current?.weeklyWeightRate);
  const p1Confidence=p1Result?.estimate?.confidence?.level ?? null;

  const deltas={
    tdeeKcal:diff(v1Tdee,p1Tdee),
    recommendedTargetKcal:diff(v1Recommended,p1Recommended),
    trendWeightKg:diff(v1TrendWeight,p1TrendWeight),
    weeklyRateKg:diff(v1WeeklyRate,p1WeeklyRate),
  };

  const warnings=[];
  if(!p1Result?.estimate?.current) warnings.push('P1 has not accumulated enough reliable data for an expenditure estimate.');
  if((p1Result?.estimate?.confidence?.reliableIntakeDays??0)<10) warnings.push('Reliable intake coverage is below the P1 expenditure threshold.');
  if((p1Result?.estimate?.confidence?.spanDays??0)<14) warnings.push('Weight span is below the P1 expenditure threshold.');
  if(['building_baseline','low'].includes(p1Confidence) && p1Decision && !holdLike(p1Decision)) warnings.push('Safety violation: low-confidence P1 result proposed an active calorie adjustment.');

  let classification='method_difference';
  if(!p1Result?.estimate?.current) classification='p1_building_baseline';
  else if(holdLike(v1Decision)&&holdLike(p1Decision)&&v1Recommended===p1Recommended) classification='aligned_hold';
  else if(deltas.recommendedTargetKcal!=null&&Math.abs(deltas.recommendedTargetKcal)>=200) classification='material_target_disagreement';
  else if(deltas.tdeeKcal!=null&&Math.abs(deltas.tdeeKcal)>=250) classification='material_tdee_disagreement';
  else if(v1Decision===p1Decision) classification='decision_aligned';

  const safety={
    p1NoAdjustmentAtLowConfidence:!(['building_baseline','low'].includes(p1Confidence))||holdLike(p1Decision),
    p1TargetStepBounded:p1Result?.calorieRecommendation?.appliedStep==null||Math.abs(p1Result.calorieRecommendation.appliedStep)<=150,
    p1DeterministicInputs:Boolean(adapterMeta?.adapterVersion),
  };

  return {
    shadowVersion:'1.0.0-p1.5',
    classification,
    v1:{decision:v1Decision,recommendedTarget:v1Recommended,estimatedTdee:v1Tdee,trendWeight:v1TrendWeight,weeklyRate:v1WeeklyRate,confidence:v1Confidence},
    p1:{decision:p1Decision,recommendedTarget:p1Recommended,estimatedTdee:p1Tdee,trendWeight:p1TrendWeight,weeklyRate:p1WeeklyRate,confidence:p1Confidence,uncertaintyKcal:p1Result?.estimate?.confidence?.uncertaintyKcal??null},
    deltas,
    safety,
    warnings,
    adapterMeta,
  };
}

export function shadowGate(report){
  const failures=[];
  if(!report?.safety?.p1NoAdjustmentAtLowConfidence) failures.push('low_confidence_adjustment');
  if(!report?.safety?.p1TargetStepBounded) failures.push('target_step_unbounded');
  if(!report?.safety?.p1DeterministicInputs) failures.push('adapter_metadata_missing');
  return {pass:failures.length===0,failures};
}
