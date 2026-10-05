import { recordTelemetry, startTelemetrySpan, telemetryErrorCode } from './telemetry.mjs';
let uncertainWrite=null;

const RPC=Object.freeze({
  manual:'diet_app_log_meal',
  savedFood:'diet_app_log_saved_food',
  savedMeal:'diet_app_log_saved_meal',
  repeatMeal:'diet_app_repeat_meal',
  deleteMeal:'diet_app_delete_meal',
  updateMeal:'diet_app_update_meal',
  saveMealFromHistory:'diet_app_save_meal_from_history',
  saveFood:'diet_app_save_food',
  setSavedFoodFavorite:'diet_app_set_saved_food_favorite',
  deleteSavedFood:'diet_app_delete_saved_food',
  setSavedMealFavorite:'diet_app_set_saved_meal_favorite',
  deleteSavedMeal:'diet_app_delete_saved_meal',
  stageStrategyReview:'diet_app_stage_strategy_review',
  resolveStrategyReview:'diet_app_resolve_strategy_review',
  revertStrategyReview:'diet_app_revert_strategy_review',
  saveTrainingDistribution:'diet_app_save_training_distribution',
  upsertTrainingDay:'diet_app_upsert_training_day',
  deleteTrainingDay:'diet_app_delete_training_day',
  completeOnboarding:'diet_app_complete_onboarding'
});

function requestId(kind){
  const id=globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `app:${kind}:${id}`;
}
function cleanMealType(value){
  const text=String(value??'').trim();
  return text||'Other';
}
function isTransient(error){
  const status=Number(error?.status);
  const code=String(error?.code??'');
  return status>=500 || status===429 || code.startsWith('PGRST') || ['TypeError','AbortError','TimeoutError'].includes(error?.name);
}
function reconciliationError(){
  const error=new Error('A previous write could not be confirmed. Refresh Diet Copilot before writing again.');
  error.code='DIET_WRITE_RECONCILE_REQUIRED';
  error.uncertainWrite=uncertainWrite;
  return error;
}
function markUncertain(name,args,error){
  uncertainWrite={
    rpc:name,
    requestId:args?.p_request_id??null,
    at:new Date().toISOString(),
    reason:String(error?.message??error??'unknown')
  };
  const wrapped=new Error('A write may have reached the server but could not be confirmed. Refresh Diet Copilot before writing again.');
  wrapped.code='DIET_WRITE_UNCERTAIN';
  wrapped.uncertainWrite=uncertainWrite;
  wrapped.cause=error;
  return wrapped;
}
async function call(client,name,args,{retry=true}={}){
  if(uncertainWrite){
    recordTelemetry('write_blocked',{operation:name,code:'reconcile_required',writeBlocked:true});
    throw reconciliationError();
  }
  if(!client?.rpc){
    recordTelemetry('write_failure',{operation:name,code:'client_unavailable'});
    throw new Error('Diet account connection is unavailable.');
  }
  const span=startTelemetrySpan('write',{operation:name});
  const run=async()=>{
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    return data;
  };
  try{
    const data=await run();
    span.end({outcome:'success',retried:false});
    return data;
  }catch(error){
    if(!retry||!isTransient(error)){
      span.end({outcome:'failure',code:telemetryErrorCode(error),retried:false});
      throw error;
    }
    recordTelemetry('write_retry',{operation:name,code:telemetryErrorCode(error),retried:true});
    await new Promise(resolve=>setTimeout(resolve,320));
    try{
      const data=await run();
      span.end({outcome:'success',retried:true});
      return data;
    }catch(secondError){
      if(isTransient(secondError)){
        span.end({outcome:'uncertain',code:telemetryErrorCode(secondError),retried:true,writeBlocked:true});
        throw markUncertain(name,args,secondError);
      }
      span.end({outcome:'failure',code:telemetryErrorCode(secondError),retried:true});
      throw secondError;
    }
  }
}

export async function logManualMeal(client,{date,mealType,title,items,requestId:existing}){
  const rid=existing??requestId('manual');
  const data=await call(client,RPC.manual,{
    p_log_date:date,
    p_meal_type:cleanMealType(mealType),
    p_title:String(title??'').trim(),
    p_items:items,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function logSavedFood(client,{savedFoodId,date,mealType,multiplier=1,quantityText=null,requestId:existing}){
  const rid=existing??requestId('food');
  const data=await call(client,RPC.savedFood,{
    p_saved_food_id:savedFoodId,
    p_log_date:date,
    p_meal_type:cleanMealType(mealType),
    p_multiplier:Number(multiplier),
    p_quantity_text:quantityText||null,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function logSavedMeal(client,{savedMealId,date,mealType=null,multiplier=1,quantityText=null,requestId:existing}){
  const rid=existing??requestId('meal');
  const data=await call(client,RPC.savedMeal,{
    p_saved_meal_id:savedMealId,
    p_log_date:date,
    p_meal_type:mealType?cleanMealType(mealType):null,
    p_multiplier:Number(multiplier),
    p_quantity_text:quantityText||null,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function repeatMeal(client,{mealId,date,mealType=null,requestId:existing}){
  const rid=existing??requestId('repeat');
  const data=await call(client,RPC.repeatMeal,{
    p_meal_id:mealId,
    p_log_date:date,
    p_meal_type:mealType?cleanMealType(mealType):null,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function deleteMeal(client,{mealId,expectedUpdatedAt=null,requestId:existing}){
  const rid=existing??requestId('delete');
  const data=await call(client,RPC.deleteMeal,{
    p_meal_id:mealId,
    p_expected_updated_at:expectedUpdatedAt,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function updateMeal(client,{mealId,date,mealType,title,items,expectedUpdatedAt=null,requestId:existing}){
  const rid=existing??requestId('edit');
  const data=await call(client,RPC.updateMeal,{
    p_meal_id:mealId,
    p_log_date:date,
    p_meal_type:cleanMealType(mealType),
    p_title:String(title??'').trim(),
    p_items:items,
    p_expected_updated_at:expectedUpdatedAt,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function saveMealFromHistory(client,{mealId,name=null,requestId:existing}){
  const rid=existing??requestId('save-meal');
  const data=await call(client,RPC.saveMealFromHistory,{
    p_meal_id:mealId,
    p_name:name?String(name).trim():null,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function saveFood(client,{
  savedFoodId=null,expectedUpdatedAt=null,name,quantityText=null,calories,protein=0,carbs=null,fat=null,fiber=null,
  brand=null,barcode=null,source='manual_exact',photoUrl=null,requestId:existing
}){
  const rid=existing??requestId('save-food');
  const data=await call(client,RPC.saveFood,{
    p_saved_food_id:savedFoodId,
    p_expected_updated_at:expectedUpdatedAt,
    p_name:String(name??'').trim(),
    p_quantity_text:quantityText?String(quantityText).trim():null,
    p_calories:Number(calories),
    p_protein:Number(protein||0),
    p_carbs:carbs==null||carbs===''?null:Number(carbs),
    p_fat:fat==null||fat===''?null:Number(fat),
    p_fiber:fiber==null||fiber===''?null:Number(fiber),
    p_brand:brand?String(brand).trim():null,
    p_barcode:barcode?String(barcode).trim():null,
    p_source:source,
    p_photo_url:photoUrl?String(photoUrl).trim():null,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function setSavedFoodFavorite(client,{savedFoodId,favorite,requestId:existing}){
  const rid=existing??requestId('food-favorite');
  const data=await call(client,RPC.setSavedFoodFavorite,{
    p_saved_food_id:savedFoodId,p_favorite:Boolean(favorite),p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function deleteSavedFood(client,{savedFoodId,expectedUpdatedAt=null,requestId:existing}){
  const rid=existing??requestId('delete-food');
  const data=await call(client,RPC.deleteSavedFood,{
    p_saved_food_id:savedFoodId,p_expected_updated_at:expectedUpdatedAt,p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function setSavedMealFavorite(client,{savedMealId,favorite,requestId:existing}){
  const rid=existing??requestId('meal-favorite');
  const data=await call(client,RPC.setSavedMealFavorite,{
    p_saved_meal_id:savedMealId,p_favorite:Boolean(favorite),p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function deleteSavedMeal(client,{savedMealId,expectedUpdatedAt=null,requestId:existing}){
  const rid=existing??requestId('delete-saved-meal');
  const data=await call(client,RPC.deleteSavedMeal,{
    p_saved_meal_id:savedMealId,p_expected_updated_at:expectedUpdatedAt,p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function stageStrategyReview(client,{
  engineVersion,generatedOn,lookbackDays=28,decision,currentTarget,recommendedTarget=null,rawTarget=null,
  estimatedExpenditure=null,confidenceLevel,confidenceScore,reason,recommendedProtein=null,
  recommendedFat=null,recommendedCarbs=null,payload={},requestId:existing
}){
  const rid=existing??requestId('strategy-stage');
  const data=await call(client,RPC.stageStrategyReview,{
    p_engine_version:String(engineVersion??'').trim(),
    p_generated_on:generatedOn,
    p_lookback_days:Number(lookbackDays),
    p_decision:String(decision??'').trim(),
    p_current_target:Number(currentTarget),
    p_recommended_target:recommendedTarget==null?null:Number(recommendedTarget),
    p_raw_target:rawTarget==null?null:Number(rawTarget),
    p_estimated_expenditure:estimatedExpenditure==null?null:Number(estimatedExpenditure),
    p_confidence_level:String(confidenceLevel??'').trim(),
    p_confidence_score:Number(confidenceScore),
    p_reason:String(reason??'').trim(),
    p_recommended_protein:recommendedProtein==null?null:Number(recommendedProtein),
    p_recommended_fat:recommendedFat==null?null:Number(recommendedFat),
    p_recommended_carbs:recommendedCarbs==null?null:Number(recommendedCarbs),
    p_payload:payload,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function resolveStrategyReview(client,{recommendationId,resolution,effectiveDate=null,requestId:existing}){
  const rid=existing??requestId('strategy-resolve');
  const data=await call(client,RPC.resolveStrategyReview,{
    p_recommendation_id:recommendationId,
    p_resolution:resolution,
    p_effective_date:effectiveDate,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function revertStrategyReview(client,{recommendationId,requestId:existing}){
  const rid=existing??requestId('strategy-revert');
  const data=await call(client,RPC.revertStrategyReview,{
    p_recommendation_id:recommendationId,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function saveTrainingDistribution(client,{
  enabled,weeklyTemplate,hardExtraKcal=150,moderateExtraKcal=75,lightExtraKcal=25,
  expectedUpdatedAt=null,requestId:existing
}){
  const rid=existing??requestId('training-distribution');
  const data=await call(client,RPC.saveTrainingDistribution,{
    p_enabled:Boolean(enabled),
    p_weekly_template:weeklyTemplate??{},
    p_hard_extra_kcal:Number(hardExtraKcal),
    p_moderate_extra_kcal:Number(moderateExtraKcal),
    p_light_extra_kcal:Number(lightExtraKcal),
    p_expected_updated_at:expectedUpdatedAt,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function upsertTrainingDay(client,{
  trainingDayId=null,date,dayType,status='planned',title=null,durationMinutes=null,notes=null,
  expectedUpdatedAt=null,requestId:existing
}){
  const rid=existing??requestId('training-day');
  const data=await call(client,RPC.upsertTrainingDay,{
    p_training_day_id:trainingDayId,
    p_training_date:date,
    p_day_type:String(dayType??'rest'),
    p_status:String(status??'planned'),
    p_title:title==null?null:String(title),
    p_duration_minutes:durationMinutes==null?null:Number(durationMinutes),
    p_notes:notes==null?null:String(notes),
    p_expected_updated_at:expectedUpdatedAt,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function deleteTrainingDay(client,{trainingDayId,expectedUpdatedAt=null,requestId:existing}){
  const rid=existing??requestId('training-delete');
  const data=await call(client,RPC.deleteTrainingDay,{
    p_training_day_id:trainingDayId,
    p_expected_updated_at:expectedUpdatedAt,
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export async function completeOnboarding(client,{
  startDate,currentWeight,goalMode,goalWeight,desiredRate,calorieTarget,proteinTarget,fiberTarget=30,
  requestId:existing
}){
  const rid=existing??requestId('onboarding');
  const data=await call(client,RPC.completeOnboarding,{
    p_start_date:startDate,
    p_current_weight:Number(currentWeight),
    p_goal_mode:String(goalMode??'').trim(),
    p_goal_weight:goalWeight==null||goalWeight===''?null:Number(goalWeight),
    p_desired_weekly_weight_change:Number(desiredRate??0),
    p_calorie_target:Number(calorieTarget),
    p_protein_target:Number(proteinTarget),
    p_fiber_target:Number(fiberTarget),
    p_request_id:rid
  });
  return {data,requestId:rid};
}

export function getDietWriteGuardState(){
  return uncertainWrite?{blocked:true,...uncertainWrite}:{blocked:false};
}
export function clearUncertainWriteGuard(){
  if(uncertainWrite)recordTelemetry('write_guard',{status:'cleared',writeBlocked:false});
  uncertainWrite=null;
}

export const DietWriteRPC=RPC;
