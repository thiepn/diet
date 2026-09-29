const RPC=Object.freeze({
  manual:'diet_app_log_meal',
  savedFood:'diet_app_log_saved_food',
  savedMeal:'diet_app_log_saved_meal',
  repeatMeal:'diet_app_repeat_meal',
  deleteMeal:'diet_app_delete_meal'
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
async function call(client,name,args,{retry=true}={}){
  if(!client?.rpc)throw new Error('Diet account connection is unavailable.');
  const run=async()=>{
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    return data;
  };
  try{return await run();}
  catch(error){
    if(!retry||!isTransient(error))throw error;
    await new Promise(resolve=>setTimeout(resolve,320));
    return run();
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

export const DietWriteRPC=RPC;
