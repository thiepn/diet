import { DIET_V2_AUTH_STORAGE_KEY, dietV2AuthStorage } from './auth-storage.mjs';
import { buildDietV2ReadModel, localDateKey } from './read-model.mjs';
import { isDefinitiveAuthFailure } from './engine/release-guards.mjs';
import { clearUncertainWriteGuard } from './write-api.mjs';

export const DIET_V2_SUPABASE_URL='https://hycegznamzjhwinegaai.supabase.co';
export const DIET_V2_SUPABASE_KEY='sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
const SUPABASE_URL=DIET_V2_SUPABASE_URL;
const SUPABASE_KEY=DIET_V2_SUPABASE_KEY;
const CACHE_KEY='diet-copilot-v2-read-cache-v2';
const LEGACY_CACHE_KEYS=['diet-copilot-v2-read-cache-v1'];
const CACHE_VERSION=2;
const OFFLINE_HISTORY_DAYS=400;
const DIET_V2_AUTH_RELAY='https://thiepn.dev/WORDSTRIKE/';
const DIET_V2_OAUTH_TARGET_KEY='diet-copilot:oauth-target-v2';
const DIET_V2_OAUTH_FLOW_KEY='diet-copilot:oauth-flow-v2';
const DIET_V2_OAUTH_QUERY_KEYS=['code','sb_flow_id','error','error_code','error_description'];
const state={
  client:null,
  authSubscription:null,
  user:null,
  model:null,
  raw:null,
  status:'initializing',
  source:'none',
  error:null,
  fetchedAt:null,
  requestEpoch:0,
  progressDays:90,
  channel:null,
  realtimeTimer:null
};

function text(id,value){
  const el=document.getElementById(id);
  if(el)el.textContent=value??'—';
}
function html(id,value){
  const el=document.getElementById(id);
  if(el)el.innerHTML=value;
}
function attr(id,name,value){
  const el=document.getElementById(id);
  if(el)el.setAttribute(name,String(value));
}
function escapeHtml(value=''){
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function fmt(value,digits=0){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
  return Number(value).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:digits});
}
function prettyDate(date){
  if(!date)return '—';
  try{return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});}catch{return date}
}
function confidenceLabel(level){
  return String(level??'building_baseline').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
}
function decisionLabel(decision){
  const map={
    need_more_data:'Need more data',
    hold_for_confidence:'Hold target',
    keep_target:'Keep target',
    increase:'Increase target',
    decrease:'Decrease target',
    set_initial_target:'Set initial target',
    prepare_maintenance:'Prepare maintenance',
    transition_maintenance:'Transition to maintenance'
  };
  return map[decision]??String(decision??'Need more data').replaceAll('_',' ');
}
function boundedFetch(input,options={}){
  const timeout=AbortSignal.timeout(12000);
  const signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  return fetch(input,{...options,signal});
}
function ensureClient(){
  if(state.client)return state.client;
  if(!window.supabase?.createClient)throw new Error('The account component did not load.');
  state.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{
      flowType:'pkce',
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false,
      storageKey:DIET_V2_AUTH_STORAGE_KEY,
      storage:dietV2AuthStorage
    },
    global:{fetch:boundedFetch}
  });
  const {data}=state.client.auth.onAuthStateChange((event,session)=>{
    if(event==='INITIAL_SESSION')return;
    queueMicrotask(async()=>{
      if(event==='SIGNED_OUT'||!session){
        clearPrivateState();
        setState('signed_out');
        render();
        return;
      }
      if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
        await refresh({silent:true}).catch(()=>{});
      }
    });
  });
  state.authSubscription=data?.subscription??null;
  return state.client;
}
function oauthCallback(){
  const url=new URL(location.href);
  return {
    url,
    code:url.searchParams.get('code'),
    flowId:url.searchParams.get('sb_flow_id'),
    error:url.searchParams.get('error_code')||url.searchParams.get('error')||(url.searchParams.has('error_description')?'oauth_error':null),
    description:url.searchParams.get('error_description')
  };
}
function stripOAuthCallback(url){
  const clean=new URL(url.href);
  for(const key of DIET_V2_OAUTH_QUERY_KEYS)clean.searchParams.delete(key);
  history.replaceState(null,'',`${clean.pathname}${clean.search}${clean.hash||'#today'}`);
}
function clearOAuthRelayState(){
  try{
    sessionStorage.removeItem(DIET_V2_OAUTH_TARGET_KEY);
    sessionStorage.removeItem(DIET_V2_OAUTH_FLOW_KEY);
  }catch{}
}
async function resolveOAuthCallback(){
  const callback=oauthCallback();
  if(!callback.code&&!callback.error)return false;
  setState('authenticating');
  render();
  stripOAuthCallback(callback.url);
  if(callback.error){
    clearOAuthRelayState();
    const error=new Error(callback.error==='access_denied'?'Google sign-in was cancelled. You can try again.':callback.description||'Google sign-in could not be completed.');
    error.code=callback.error;
    throw error;
  }
  const client=ensureClient();
  let result=await client.auth.exchangeCodeForSession(
    callback.code,
    callback.flowId?{flowId:callback.flowId}:undefined
  );
  if(result.error&&callback.flowId&&/PKCE code verifier not found|AuthPKCECodeVerifierMissingError/i.test(String(result.error?.message??result.error))){
    result=await client.auth.exchangeCodeForSession(callback.code);
  }
  clearOAuthRelayState();
  if(result.error)throw result.error;
  return true;
}
export async function signInWithGoogle(){
  const client=ensureClient();
  const existing=await client.auth.getSession();
  if(existing.data?.session)return existing.data.session;
  if(navigator.onLine===false)throw new Error('Connect to the internet before signing in.');
  setState('authenticating');
  render();
  clearOAuthRelayState();
  const {data,error}=await client.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo:DIET_V2_AUTH_RELAY,
      skipBrowserRedirect:true,
      queryParams:{prompt:'select_account'}
    }
  });
  if(error)throw error;
  const target=new URL(data?.url||'');
  if(target.origin!==new URL(SUPABASE_URL).origin||target.pathname!=='/auth/v1/authorize'){
    throw new Error('The account service returned an unexpected sign-in destination.');
  }
  try{
    sessionStorage.setItem(DIET_V2_OAUTH_TARGET_KEY,'web-v2');
    if(data?.flowId)sessionStorage.setItem(DIET_V2_OAUTH_FLOW_KEY,data.flowId);
    else sessionStorage.removeItem(DIET_V2_OAUTH_FLOW_KEY);
  }catch{
    throw new Error('This browser blocked temporary sign-in state. Allow site data and retry.');
  }
  location.assign(target.href);
  return null;
}
export async function signOutDietV2(){
  const client=ensureClient();
  const ownerId=state.user?.id??null;
  clearPrivateState();
  setState('signed_out');
  render();
  try{await client.auth.signOut({scope:'local'});}catch{}
  try{dietV2AuthStorage.removeItem(DIET_V2_AUTH_STORAGE_KEY);}catch{}
  if(ownerId){
    try{
      const cached=readCache(ownerId);
      if(cached)clearDietV2OfflineCache();
    }catch{}
  }
  clearOAuthRelayState();
  render();
}

function clearPrivateState(){
  state.requestEpoch++;
  if(state.realtimeTimer)clearTimeout(state.realtimeTimer);
  state.realtimeTimer=null;
  if(state.channel&&state.client){
    try{state.client.removeChannel(state.channel)}catch{}
  }
  state.channel=null;
  state.user=null;
  state.model=null;
  state.raw=null;
  state.fetchedAt=null;
  state.source='none';
}
function setState(status,error=null){
  state.status=status;
  state.error=error?String(error):null;
  document.documentElement.dataset.dataState=status;
  renderStatus();
}
function parseCacheKey(key,ownerId){
  try{
    const cached=JSON.parse(localStorage.getItem(key)||'null');
    if(cached?.ownerId===ownerId&&cached?.raw)return cached;
  }catch{}
  return null;
}
function readCache(ownerId){
  if(!ownerId)return null;
  const current=parseCacheKey(CACHE_KEY,ownerId);
  if(current?.version===CACHE_VERSION)return current;
  for(const key of LEGACY_CACHE_KEYS){
    const legacy=parseCacheKey(key,ownerId);
    if(legacy)return legacy;
  }
  return null;
}
function offlineCutoff(asOfDate=localDateKey()){
  const d=new Date(`${asOfDate}T12:00:00`);
  d.setDate(d.getDate()-OFFLINE_HISTORY_DAYS);
  return localDateKey(d);
}
function buildOfflineSnapshot(raw){
  const cutoff=offlineCutoff();
  const dailyLogs=(raw.dailyLogs??[]).filter(row=>String(row.log_date??'')>=cutoff);
  const keptLogIds=new Set(dailyLogs.map(row=>String(row.id??'')).filter(Boolean));
  const meals=(raw.meals??[]).filter(row=>{
    const date=String(row.eaten_at??'').slice(0,10);
    return keptLogIds.has(String(row.daily_log_id??''))||date>=cutoff;
  });
  const keptMealIds=new Set(meals.map(row=>String(row.id??'')).filter(Boolean));
  return {
    profile:raw.profile??null,
    dailyLogs,
    meals,
    mealItems:(raw.mealItems??[]).filter(row=>keptMealIds.has(String(row.meal_id??''))),
    weights:(raw.weights??[]).filter(row=>String(row.entry_date??'')>=cutoff),
    goalPhases:raw.goalPhases??[],
    savedFoods:(raw.savedFoods??[]).slice(0,500),
    savedMeals:(raw.savedMeals??[]).slice(0,300),
    targetRecommendations:(raw.targetRecommendations??[]).slice(0,20),
    activityDaily:(raw.activityDaily??[]).slice(0,120),
    trainingDistribution:raw.trainingDistribution??null,
    trainingDays:(raw.trainingDays??[]).slice(0,180)
  };
}
function saveCache(ownerId,raw){
  if(!ownerId||!raw)return false;
  try{
    const compact=buildOfflineSnapshot(raw);
    localStorage.setItem(CACHE_KEY,JSON.stringify({
      version:CACHE_VERSION,
      ownerId,
      savedAt:new Date().toISOString(),
      historyDays:OFFLINE_HISTORY_DAYS,
      raw:compact
    }));
    for(const key of LEGACY_CACHE_KEYS)try{localStorage.removeItem(key)}catch{}
    return true;
  }catch{return false;}
}
function currentSessionOwner(session){
  return typeof session?.user?.id==='string'&&session.user.id?session.user.id:null;
}

async function subscribeRealtime(){
  if(!state.client||!state.user||navigator.onLine===false)return;
  if(state.channel){
    try{await state.client.removeChannel(state.channel)}catch{}
    state.channel=null;
  }
  let channel=state.client.channel(`diet-v2-read-${state.user.id}`);
  for(const table of ['profiles','daily_logs','meals','meal_items','weight_entries','goal_phases','saved_foods','saved_meals','target_recommendations','activity_daily','training_distribution_settings','training_days']){
    channel=channel.on('postgres_changes',{event:'*',schema:'public',table},()=>{
      clearTimeout(state.realtimeTimer);
      state.realtimeTimer=setTimeout(()=>refresh({silent:true}).catch(()=>{}),450);
    });
  }
  state.channel=channel.subscribe();
}

async function fetchPagedRows(table,columns,{orders=[],pageSize=1000,maxPages=50}={}){
  const client=ensureClient();
  const rows=[];
  for(let page=0;page<maxPages;page++){
    let query=client.from(table).select(columns);
    for(const order of orders){
      query=query.order(order.column,{ascending:order.ascending!==false,nullsFirst:Boolean(order.nullsFirst)});
    }
    const from=page*pageSize;
    const to=from+pageSize-1;
    const result=await query.range(from,to);
    if(result.error)throw result.error;
    const batch=result.data??[];
    rows.push(...batch);
    if(batch.length<pageSize)return rows;
  }
  throw new Error(`Diet history exceeded the safe pagination cap for ${table}. Export or archive old data before continuing.`);
}

async function fetchOwnerRows(){
  const client=ensureClient();
  const [profile,dailyLogs,meals,mealItems,weights,goalPhases,savedFoods,savedMeals,targetRecommendations,activityDaily,trainingDistribution,trainingDays]=await Promise.all([
    client.from('profiles').select('calorie_target,protein_target,goal_weight,fiber_target,desired_weekly_weight_change,adaptive_target_enabled,adaptive_min_complete_days,updated_at').maybeSingle(),
    fetchPagedRows('daily_logs','id,log_date,calorie_target,protein_target,status,notes,updated_at',{orders:[{column:'log_date'}]}),
    fetchPagedRows('meals','id,daily_log_id,meal_type,title,calories,protein,confidence,source,calories_low,calories_high,eaten_at,created_at,updated_at',{orders:[{column:'eaten_at'},{column:'id'}]}),
    fetchPagedRows('meal_items','id,meal_id,saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber,calories_low,calories_high,confidence,source,sort_order,updated_at',{orders:[{column:'meal_id'},{column:'sort_order'},{column:'id'}]}),
    fetchPagedRows('weight_entries','id,entry_date,weight,created_at,updated_at',{orders:[{column:'entry_date'},{column:'id'}]}),
    fetchPagedRows('goal_phases','phase_type,start_date,end_date,calorie_target,protein_target,goal_weight,desired_weekly_weight_change,active,created_at,updated_at',{orders:[{column:'start_date'},{column:'created_at'}]}),
    fetchPagedRows('saved_foods','id,name,quantity_text,calories,protein,carbs,fat,fiber,brand,barcode,favorite,use_count,last_used_at,verified_at,source,photo_url,updated_at',{orders:[{column:'use_count',ascending:false},{column:'id'}]}),
    fetchPagedRows('saved_meals','id,name,meal_type,calories,protein,carbs,fat,fiber,favorite,use_count,last_used_at,is_recipe,servings,serving_text,updated_at',{orders:[{column:'use_count',ascending:false},{column:'id'}]}),
    client.from('target_recommendations').select('id,generated_on,lookback_days,complete_days,logged_days,weigh_in_count,avg_calories,weekly_weight_change,estimated_maintenance,desired_weekly_weight_change,current_target,raw_recommended_target,recommended_target,rationale,status,created_at,resolved_at,decision_payload,engine_version,confidence_level,confidence_score,recommended_protein,recommended_fat,recommended_carbs,effective_date,resolution,resolved_target,applied_phase_id').order('created_at',{ascending:false}).limit(20),
    client.from('activity_daily').select('activity_date,steps,active_calories,exercise_minutes,distance_km,resting_heart_rate,source,synced_at,updated_at').order('activity_date',{ascending:false}).limit(120),
    client.from('training_distribution_settings').select('enabled,weekly_template,hard_extra_kcal,moderate_extra_kcal,light_extra_kcal,updated_at').maybeSingle(),
    client.from('training_days').select('id,training_date,day_type,status,title,duration_minutes,source,notes,created_at,updated_at').order('training_date',{ascending:false}).limit(180)
  ]);
  for(const result of [profile,targetRecommendations,activityDaily,trainingDistribution,trainingDays]){
    if(result.error)throw result.error;
  }
  return {
    profile:profile.data??null,
    dailyLogs,
    meals,
    mealItems,
    weights,
    goalPhases,
    savedFoods,
    savedMeals,
    targetRecommendations:targetRecommendations.data??[],
    activityDaily:activityDaily.data??[],
    trainingDistribution:trainingDistribution.data??null,
    trainingDays:trainingDays.data??[]
  };
}

export async function refresh({silent=false}={}){
  const client=ensureClient();
  const epoch=++state.requestEpoch;
  if(!silent)setState('loading');

  const sessionResult=await client.auth.getSession();
  if(sessionResult.error){
    if(isDefinitiveAuthFailure(sessionResult.error)){
      try{await client.auth.signOut({scope:'local'});}catch{}
      try{dietV2AuthStorage.removeItem(DIET_V2_AUTH_STORAGE_KEY);}catch{}
      if(epoch!==state.requestEpoch)return;
      clearPrivateState();
      setState('signed_out');
      render();
      return;
    }
    throw sessionResult.error;
  }
  const session=sessionResult.data?.session??null;
  const ownerId=currentSessionOwner(session);
  if(!ownerId){
    if(epoch!==state.requestEpoch)return;
    clearPrivateState();
    setState('signed_out');
    render();
    return;
  }

  const cached=readCache(ownerId);
  if(navigator.onLine===false){
    if(epoch!==state.requestEpoch)return;
    state.user=session.user;
    if(cached){
      state.raw=cached.raw;
      state.model=buildDietV2ReadModel(cached.raw,{asOfDate:localDateKey()});
      state.fetchedAt=cached.savedAt??null;
      state.source='cache';
      setState('offline');
    }else{
      setState('offline_empty');
    }
    render();
    return;
  }

  try{
    const verified=await client.auth.getUser();
    if(verified.error){
      if(isDefinitiveAuthFailure(verified.error)){
        try{await client.auth.signOut({scope:'local'});}catch{}
        try{dietV2AuthStorage.removeItem(DIET_V2_AUTH_STORAGE_KEY);}catch{}
        if(epoch!==state.requestEpoch)return;
        clearPrivateState();
        setState('signed_out');
        render();
        return;
      }
      throw verified.error;
    }
    if(!verified.data?.user?.id||verified.data.user.id!==ownerId){
      try{await client.auth.signOut({scope:'local'});}catch{}
      try{dietV2AuthStorage.removeItem(DIET_V2_AUTH_STORAGE_KEY);}catch{}
      if(epoch!==state.requestEpoch)return;
      clearPrivateState();
      setState('signed_out');
      render();
      return;
    }
    const raw=await fetchOwnerRows();
    if(epoch!==state.requestEpoch)return;
    state.user=verified.data.user;
    state.raw=raw;
    state.model=buildDietV2ReadModel(raw,{asOfDate:localDateKey()});
    state.fetchedAt=new Date().toISOString();
    state.source='cloud';
    saveCache(ownerId,raw);
    clearUncertainWriteGuard();
    setState('ready');
    render();
    subscribeRealtime().catch(()=>{});
  }catch(error){
    if(epoch!==state.requestEpoch)return;
    state.user=session.user;
    if(cached){
      state.raw=cached.raw;
      state.model=buildDietV2ReadModel(cached.raw,{asOfDate:localDateKey()});
      state.fetchedAt=cached.savedAt??null;
      state.source='cache';
      setState('stale',error?.message||error);
    }else{
      setState('error',error?.message||error);
    }
    render();
  }
}

function renderStatus(){
  const banner=document.getElementById('dataStatus');
  const label=document.getElementById('dataStatusLabel');
  const detail=document.getElementById('dataStatusDetail');
  if(!banner||!label||!detail)return;
  const map={
    initializing:['Connecting','Checking your saved account session…'],
    authenticating:['Signing in','Completing your THIEPN Account sign-in…'],
    loading:['Refreshing','Loading your owner-scoped nutrition history…'],
    ready:['Live',state.fetchedAt?`Updated ${new Date(state.fetchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:'Connected'],
    offline:['Offline cache',state.fetchedAt?`Last synced ${new Date(state.fetchedAt).toLocaleString()}`:'Showing cached data'],
    stale:['Cached',state.error||'Live refresh failed; showing the last safe snapshot.'],
    signed_out:['Sign in required','Diet Copilot 2.0 only reads data for the signed-in THIEPN account.'],
    offline_empty:['Offline','No owner-scoped cache is available on this device yet.'],
    error:['Data unavailable',state.error||'The nutrition record could not be loaded.']
  };
  const [title,sub]=map[state.status]??map.initializing;
  label.textContent=title;
  detail.textContent=sub;
  banner.dataset.state=state.status;
  banner.hidden=state.status==='ready';
}

function mealMarkup(meal){
  const items=(meal.items??[]).slice(0,4).map(i=>`<span>${escapeHtml(i.name)}${i.quantity?` · ${escapeHtml(i.quantity)}`:''}</span>`).join('');
  const time=meal.eatenAt?new Date(meal.eatenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  return `<article class="dc-meal-row" data-meal-id="${escapeHtml(meal.id??'')}">
    <div class="dc-meal-main">
      <div class="dc-meal-title"><strong>${escapeHtml(meal.type)} · ${escapeHtml(meal.title)}</strong><span>${time}</span></div>
      ${items?`<div class="dc-meal-items">${items}</div>`:''}
      <div class="dc-meal-actions">
        <button type="button" data-edit-meal="${escapeHtml(meal.id??'')}">Edit</button>
        <button type="button" data-save-meal-history="${escapeHtml(meal.id??'')}">Save meal</button>
      </div>
    </div>
    <div class="dc-meal-nutrition"><strong>${fmt(meal.calories)} kcal</strong><span>${fmt(meal.protein,1)} g protein</span></div>
  </article>`;
}

function emptyMarkup(title,detail){
  return `<div class="dc-empty-state dc-empty-state--compact"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div></div>`;
}

function renderToday(model){
  const t=model.today;
  text('todayCaloriesValue',fmt(t.calories));
  text('todayCaloriesTarget',t.calorieTarget==null?'No target':`of ${fmt(t.calorieTarget)} kcal`);
  const trainingSuffix=t.trainingDistributionEnabled&&t.trainingTargetDelta\n    ?` · ${t.trainingDayType} day ${t.trainingTargetDelta>0?'+':''}${fmt(t.trainingTargetDelta)}`\n    :'';\n  text('todayCaloriesHint',t.caloriesRemaining==null?'No calorie target available':(t.caloriesRemaining>=0?`${fmt(t.caloriesRemaining)} kcal remaining`:`${fmt(Math.abs(t.caloriesRemaining))} kcal over target`)+trainingSuffix);
  const progress=document.getElementById('todayCaloriesProgress');
  if(progress)progress.style.width=`${t.calorieProgress}%`;

  text('todayProteinValue',t.proteinTarget==null?`${fmt(t.protein,1)} g`:`${fmt(t.protein,1)} / ${fmt(t.proteinTarget)} g`);
  text('todayProteinHint',t.proteinRemaining==null?'No protein target available':t.proteinRemaining>=0?`${fmt(t.proteinRemaining,1)} g remaining`:'Protein target reached');

  text('todayTrendWeightValue',t.trendWeight==null?'—':fmt(t.trendWeight,2));
  text('todayTrendWeightUnit',t.trendWeight==null?'Building trend':'kg trend');
  text('todayTrendWeightHint',t.latestWeight==null?'No weigh-ins yet':`Latest scale: ${fmt(t.latestWeight,2)} kg · ${prettyDate(t.latestWeightDate)}`);

  text('todayExpenditureValue',t.expenditure==null?'—':fmt(t.expenditure));
  text('todayExpenditureUnit',t.expenditure==null?'Building estimate':'kcal/day');
  text('todayExpenditureHint',t.expenditure==null?`${confidenceLabel(t.confidenceLevel)} confidence`:`${confidenceLabel(t.confidenceLevel)} confidence${t.expenditureRangeLow!=null&&t.expenditureRangeHigh!=null?` · ${fmt(t.expenditureRangeLow)}–${fmt(t.expenditureRangeHigh)}`:''}`);

  html('todayMeals',t.meals.length?t.meals.map(mealMarkup).join(''):emptyMarkup('No meals logged today','Your existing Diet history is connected; new entries will appear here after they are written by the canonical logger.'));
  text('todayStrategyGoal',t.goalLabel);
  text('todayStrategyTarget',t.currentTarget==null?'—':`${fmt(t.currentTarget)} kcal`);
  text('todayTrainingTarget',t.calorieTarget==null?'—':`${fmt(t.calorieTarget)} kcal`);
  text('todayTrainingType',t.trainingDistributionEnabled?confidenceLabel(t.trainingDayType):'Distribution off');
  text('todayActivityContext',t.activityContext?.level?confidenceLabel(t.activityContext.level):'Building baseline');
  text('todayStrategyConfidence',confidenceLabel(t.confidenceLevel));
}

function renderFood(model){
  const meals=model.food.todayMeals;
  html('foodTimeline',meals.length?meals.map(mealMarkup).join(''):emptyMarkup('No meals logged today','Use search, a saved food, a recent meal, or Quick add above.'));
  text('foodTodaySummary',meals.length?`${meals.length} meal${meals.length===1?'':'s'} today`:'No meals today');
}

function seriesBounds(series){
  const values=series.map(p=>Number(p.value)).filter(Number.isFinite);
  if(!values.length)return null;
  let min=Math.min(...values),max=Math.max(...values);
  if(min===max){min-=1;max+=1}
  const pad=(max-min)*.12;
  return {min:min-pad,max:max+pad};
}
function linePath(series,width,height,pad,bounds){
  if(series.length<2||!bounds)return '';
  return series.map((p,i)=>{
    const x=pad+i*((width-pad*2)/Math.max(1,series.length-1));
    const y=height-pad-((Number(p.value)-bounds.min)/(bounds.max-bounds.min))*(height-pad*2);
    return `${i?'L':'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
function renderLineChart(id,primary,secondary=[],unit=''){
  const el=document.getElementById(id);
  if(!el)return;
  if(primary.length<2){
    el.innerHTML=emptyMarkup('Not enough data','More history is needed before this chart becomes meaningful.');
    return;
  }
  const width=720,height=180,pad=22;
  const bounds=seriesBounds([...primary,...secondary]);
  const p1=linePath(primary,width,height,pad,bounds);
  const p2=secondary.length>=2?linePath(secondary,width,height,pad,bounds):'';
  const last=primary.at(-1);
  el.innerHTML=`<svg class="dc-live-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Data trend">
    <line class="dc-chart-gridline" x1="${pad}" x2="${width-pad}" y1="${pad}" y2="${pad}"></line>
    <line class="dc-chart-gridline" x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}"></line>
    ${p2?`<path class="dc-chart-line dc-chart-line--secondary" d="${p2}"></path>`:''}
    <path class="dc-chart-line" d="${p1}"></path>
  </svg><div class="dc-chart-foot"><span>${escapeHtml(primary[0].date)}</span><strong>${fmt(last.value,unit==='kg'?2:0)} ${escapeHtml(unit)}</strong><span>${escapeHtml(last.date)}</span></div>`;
}
function renderIntakeChart(id,series){
  const el=document.getElementById(id);
  if(!el)return;
  const rows=series.slice(-21);
  if(!rows.length){
    el.innerHTML=emptyMarkup('No intake history','Logged nutrition will appear here after the first synced day.');
    return;
  }
  const max=Math.max(1,...rows.flatMap(r=>[Number(r.calories)||0,Number(r.target)||0]));
  el.innerHTML=`<div class="dc-bar-chart" role="img" aria-label="Daily calorie intake compared with target">
    ${rows.map(r=>{
      const intake=Math.max(2,(Number(r.calories)||0)/max*100);
      const target=Math.max(2,(Number(r.target)||0)/max*100);
      return `<span class="dc-bar-day" title="${escapeHtml(r.date)} · ${fmt(r.calories)} kcal / ${fmt(r.target)} target"><i style="height:${target}%"></i><b style="height:${intake}%"></b></span>`;
    }).join('')}
  </div><div class="dc-chart-legend"><span><i class="dc-legend-intake"></i>Intake</span><span><i class="dc-legend-target"></i>Target</span></div>`;
}

function signedValue(value,digits=0,suffix=''){
  if(value==null||!Number.isFinite(Number(value)))return '—';
  const n=Number(value);
  return `${n>0?'+':''}${fmt(n,digits)}${suffix}`;
}
function insightMarkup(insight){
  return `<article class="dc-insight-card" data-tone="${escapeHtml(insight.tone??'neutral')}">
    <div class="dc-insight-card-main">
      <div class="dc-insight-card-head"><span class="dc-insight-category">${escapeHtml(insight.category??'pattern')}</span><strong>${escapeHtml(insight.title??'Pattern')}</strong></div>
      <p>${escapeHtml(insight.summary??'')}</p>
      <div class="dc-insight-evidence"><span>${fmt(insight.evidenceDays)} evidence day${Number(insight.evidenceDays)===1?'':'s'}</span><span>${escapeHtml(confidenceLabel(insight.confidence??'low'))} confidence</span></div>
    </div>
    <div class="dc-insight-value"><strong>${signedValue(insight.value,insight.unit==='r'?2:0)}</strong><span>${escapeHtml(insight.unit??'')}</span></div>
  </article>`;
}

function rangeStartDate(days,asOfDate){
  const d=new Date(`${asOfDate}T12:00:00`);
  d.setDate(d.getDate()-Math.max(0,Number(days)-1));
  return localDateKey(d);
}
function filterRange(series,days,asOfDate){
  const start=rangeStartDate(days,asOfDate);
  return series.filter(p=>String(p.date)>=start&&String(p.date)<=asOfDate);
}
function renderProgress(model){
  const days=state.progressDays;
  renderLineChart('progressWeightChart',filterRange(model.progress.trendWeights,days,model.asOfDate),filterRange(model.progress.rawWeights,days,model.asOfDate),'kg');
  renderLineChart('progressExpenditureChart',filterRange(model.progress.expenditure,days,model.asOfDate),[],'kcal');
  renderIntakeChart('progressIntakeChart',filterRange(model.progress.intake,days,model.asOfDate));
  const projection=model.progress.goalProjection;
  if(projection){
    html('progressGoalTrajectory',`<div class="dc-trajectory"><strong>Projected around ${escapeHtml(prettyDate(projection.projectedDate))}</strong><span>${fmt(projection.weeks,1)} weeks at the selected pace</span><small>Projection, not a guarantee.</small></div>`);
  }else{
    html('progressGoalTrajectory',emptyMarkup('No goal projection yet','A compatible goal and target rate are required.'));
  }

  const intel=model.progress.intelligence;
  if(intel){
    text('intelligenceVersion',intel.version??'P7');
    text('intelligenceReliableDays',intel.quality?.reliableIntakeDays==null?'—':fmt(intel.quality.reliableIntakeDays,1));
    text('intelligenceProteinAdherence',intel.metrics?.proteinTargetAdherence==null?'—':fmt(intel.metrics.proteinTargetAdherence*100)+'%');
    text('intelligenceCalorieAdherence',intel.metrics?.calorieTargetAdherence==null?'—':fmt(intel.metrics.calorieTargetAdherence*100)+'%');
    text('intelligenceWeightRate',intel.metrics?.weeklyTrendRate==null?'—':signedValue(intel.metrics.weeklyTrendRate,2));
    text('intelligenceWeekendDelta',intel.metrics?.weekendDeltaCalories==null?'—':signedValue(intel.metrics.weekendDeltaCalories,0,' kcal'));
    text('intelligenceActivityShift',intel.metrics?.activityShift==null?'—':signedValue(intel.metrics.activityShift*100,0,'%'));
    html('personalInsights',intel.insights?.length
      ?intel.insights.map(insightMarkup).join('')
      :emptyMarkup('Patterns withheld','P7 needs more reliable paired history before showing personal observations.'));
  }
}

function renderStrategy(model){
  const s=model.strategy;
  text('strategyGoalMode',s.goalLabel);
  text('strategyGoalWeight',s.goalWeight==null?'—':`${fmt(s.goalWeight,1)} kg`);
  text('strategyTargetRate',s.targetRateKgPerWeek==null?'—':`${s.targetRateKgPerWeek>0?'+':''}${fmt(s.targetRateKgPerWeek,2)} kg/week`);
  text('strategyTdee',s.estimatedExpenditure==null?'—':`${fmt(s.estimatedExpenditure)} kcal/day`);
  text('strategyCurrentTarget',s.currentTarget==null?'—':`${fmt(s.currentTarget)} kcal`);
  text('strategyConfidence',confidenceLabel(s.confidenceLevel));
  text('strategyDecisionTitle',decisionLabel(s.decision));
  text('strategyDecisionReason',s.reason);
  text('strategyRecommendedTarget',s.recommendedTarget==null?'—':`${fmt(s.recommendedTarget)} kcal`);
  const chip=document.getElementById('strategyDecisionChip');
  if(chip)chip.textContent=confidenceLabel(s.confidenceLevel);
}

function renderAccount(){
  const signedIn=Boolean(state.user);
  const authBusy=state.status==='authenticating'||state.status==='initializing';
  const button=document.querySelector('[data-account-button]');
  if(button)button.classList.toggle('is-signed-in',signedIn);
  text('accountStateTitle',signedIn?'Signed in':authBusy?'Checking account…':'Not signed in');
  text('accountStateEmail',signedIn?(state.user?.email??'THIEPN Account'):'Continue with Google to load your private Diet data.');
  text('accountStateSource',state.source==='cloud'?'Live owner-scoped data':state.source==='cache'?'Owner-scoped cache':'No private data loaded');
  text('accountStateSync',state.fetchedAt?new Date(state.fetchedAt).toLocaleString():'Never');
  const signIn=document.getElementById('v2AccountSignIn');
  const signOut=document.getElementById('v2AccountSignOut');
  const refreshButton=document.getElementById('v2AccountRefresh');
  if(signIn){signIn.hidden=signedIn;signIn.disabled=authBusy;}
  if(signOut){signOut.hidden=!signedIn;signOut.disabled=authBusy;}
  if(refreshButton){refreshButton.hidden=!signedIn;refreshButton.disabled=authBusy;}
}

function renderEmptyPrivateState(){
  text('todayCaloriesValue','—');
  text('todayCaloriesTarget','of — kcal');
  text('todayCaloriesHint',state.status==='signed_out'?'Sign in to view your nutrition record.':'No private nutrition data is available.');
  const progress=document.getElementById('todayCaloriesProgress');
  if(progress)progress.style.width='0%';
  text('todayProteinValue','—');
  text('todayProteinHint','—');
  text('todayTrendWeightValue','—');
  text('todayTrendWeightUnit','kg trend');
  text('todayTrendWeightHint','—');
  text('todayExpenditureValue','—');
  text('todayExpenditureUnit','kcal/day');
  text('todayExpenditureHint','—');
  html('todayMeals',emptyMarkup(state.status==='signed_out'?'Sign in to view meals':'No meal data available','Private meal history is hidden until an owner-matched account or cache is available.'));
  html('foodTimeline',emptyMarkup(state.status==='signed_out'?'Sign in to view food history':'No food data available','P2.5 never displays another owner\'s cached record.'));
  text('foodTodaySummary','No private data');
  text('todayStrategyGoal','—');
  text('todayStrategyTarget','—');
  text('todayTrainingTarget','—');
  text('todayTrainingType','—');
  text('todayActivityContext','—');
  text('todayStrategyConfidence','—');
  html('progressWeightChart',emptyMarkup('No weight data available','Sign in or reconnect to load your owner-scoped history.'));
  html('progressExpenditureChart',emptyMarkup('No expenditure data available','The adaptive estimate remains hidden without private source data.'));
  html('progressIntakeChart',emptyMarkup('No intake data available','Sign in or reconnect to load your owner-scoped history.'));
  html('progressGoalTrajectory',emptyMarkup('No goal projection available','Goal data remains private until the account record is loaded.'));
  text('strategyGoalMode','—');
  text('strategyGoalWeight','—');
  text('strategyTargetRate','—');
  text('strategyTdee','—');
  text('strategyCurrentTarget','—');
  text('strategyConfidence','—');
  text('strategyDecisionTitle','Need more data');
  text('strategyDecisionReason','Sign in or reconnect before evaluating the current strategy.');
  text('strategyRecommendedTarget','—');
  text('strategyDecisionChip','Building');
}

function render(){
  renderStatus();
  renderAccount();
  const model=state.model;
  if(!model){
    document.documentElement.classList.add('dc-no-data');
    renderEmptyPrivateState();
    return;
  }
  document.documentElement.classList.remove('dc-no-data');
  renderToday(model);
  renderFood(model);
  renderProgress(model);
  renderStrategy(model);
  window.dispatchEvent(new CustomEvent('diet-v2-data-updated'));
}

function openAccount(){
  renderAccount();
  const dialog=document.getElementById('v2AccountDialog');
  if(dialog&&!dialog.open)dialog.showModal();
}
function closeAccount(){
  const dialog=document.getElementById('v2AccountDialog');
  if(dialog?.open)dialog.close();
}

async function handleShellAction(action){
  if(action==='refresh'){
    refresh().catch(error=>{
      setState('error',error?.message||error);
      render();
    });
    return true;
  }
  if(action==='account'){
    openAccount();
    return true;
  }
  return false;
}

async function init(){
  renderStatus();
  renderAccount();
  try{
    ensureClient();
    await resolveOAuthCallback();
    await refresh({silent:true});
  }catch(error){
    const callback=oauthCallback();
    if(callback.code||callback.error)stripOAuthCallback(callback.url);
    setState('error',error?.message||error);
    render();
  }
  window.addEventListener('online',()=>refresh({silent:true}).catch(()=>{}));
  window.addEventListener('offline',()=>{
    if(state.model)setState('offline');
    else setState('offline_empty');
    render();
  });
}

document.querySelectorAll('[data-progress-range]').forEach(button=>{
  button.addEventListener('click',()=>{
    const days=Number(button.dataset.progressRange);
    if(!Number.isFinite(days)||days<=0)return;
    state.progressDays=days;
    document.querySelectorAll('[data-progress-range]').forEach(other=>{
      const selected=other===button;
      other.classList.toggle('is-selected',selected);
      other.setAttribute('aria-pressed',selected?'true':'false');
    });
    if(state.model)renderProgress(state.model);
  });
});

document.getElementById('closeV2AccountDialog')?.addEventListener('click',closeAccount);
document.getElementById('v2AccountRefresh')?.addEventListener('click',()=>refresh().catch(()=>{}));
document.getElementById('v2AccountSignIn')?.addEventListener('click',async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  button.textContent='Redirecting…';
  try{await signInWithGoogle();}
  catch(error){
    setState('error',error?.message||error);
    render();
    button.disabled=false;
    button.textContent='Continue with Google';
  }
});
document.getElementById('v2AccountSignOut')?.addEventListener('click',()=>signOutDietV2());
document.getElementById('v2AccountProduction')?.addEventListener('click',()=>{location.href='../';});

export function getDietV2Client(){return ensureClient();}
export function getDietV2Model(){return state.model;}
export function getDietV2RawData(){
  if(!state.raw)return null;
  try{return structuredClone(state.raw);}catch{
    try{return JSON.parse(JSON.stringify(state.raw));}catch{return null;}
  }
}
export function clearDietV2OfflineCache(){
  let ok=true;
  try{localStorage.removeItem(CACHE_KEY);}catch{ok=false;}
  for(const key of LEGACY_CACHE_KEYS)try{localStorage.removeItem(key)}catch{ok=false;}
  return ok;
}
export function getDietV2OfflineCacheInfo(){
  if(!state.user?.id)return {present:false,savedAt:null,ownerMatched:false,historyDays:OFFLINE_HISTORY_DAYS};
  const cached=readCache(state.user.id);
  return {
    present:Boolean(cached),
    savedAt:cached?.savedAt??null,
    ownerMatched:Boolean(cached),
    historyDays:Number(cached?.historyDays??OFFLINE_HISTORY_DAYS)
  };
}
export function getDietV2State(){return {status:state.status,source:state.source,signedIn:Boolean(state.user),fetchedAt:state.fetchedAt};}

window.DietV2Data=Object.freeze({
  version:'2.0.0-p11-rc',
  refresh,
  signInWithGoogle,
  signOut:signOutDietV2,
  handleShellAction,
  snapshot:()=>({
    status:state.status,
    source:state.source,
    signedIn:Boolean(state.user),
    fetchedAt:state.fetchedAt,
    engineVersion:state.model?.meta?.engineVersion??null,
    rows:state.model?.meta?.legacyRows??null,
    progressDays:state.progressDays,
    realtime:Boolean(state.channel)
  })
});

init();
