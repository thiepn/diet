'use strict';

function v5EnsureDashboardShape() {
  dashboard.savedFoods ||= [];
  dashboard.savedMeals ||= [];
  dashboard.goalPhases ||= [];
  dashboard.recommendations ||= [];
  dashboard.weeklyReviews ||= [];
  dashboard.profile ||= {};
  if (dashboard.profile.fiberTarget == null) dashboard.profile.fiberTarget = 30;
  if (dashboard.profile.showOptionalMacros == null) dashboard.profile.showOptionalMacros = false;
  if (dashboard.profile.showMealPhotos == null) dashboard.profile.showMealPhotos = true;
}

v5EnsureDashboardShape();

function v5SafePhotoUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value, location.href);
    return ['http:','https:'].includes(u.protocol) ? u.href : null;
  } catch { return null; }
}

function v5MacroForDate(date, key) {
  const meals = mealsFor(date);
  let value = 0, known = 0, unknown = 0;
  for (const meal of meals) {
    if (meal[key] == null || Number.isNaN(Number(meal[key]))) unknown++;
    else { value += Number(meal[key]); known++; }
  }
  return { value, known, unknown, hasAny: known > 0, complete: meals.length > 0 && unknown === 0 };
}

function v5CurrentPhase() {
  return (dashboard.goalPhases || []).find(p => p.active) || null;
}

function v5LatestRecommendation() {
  return [...(dashboard.recommendations || [])].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0] || null;
}

function v5ReminderSummary() {
  const p = dashboard.profile || {};
  const enabled = [];
  if (p.weighInReminderEnabled) enabled.push(`Weigh-in${p.weighInReminderTime ? ` ${String(p.weighInReminderTime).slice(0,5)}` : ''}`);
  if (p.dayCloseReminderEnabled) enabled.push(`Close day${p.dayCloseReminderTime ? ` ${String(p.dayCloseReminderTime).slice(0,5)}` : ''}`);
  if (p.weeklyReviewReminderEnabled) enabled.push('Weekly review');
  return enabled.length ? enabled.join(' · ') : 'Off';
}

refreshData = async function refreshDataV5({silent=false}={}) {
  if(!cloud.client||!cloud.user){if(!silent)openConnection();return;}
  if(navigator.onLine===false){if(!silent)showToast('Offline — showing the last cached snapshot');return;}
  cloud.status='syncing'; updateStatus();
  try {
    const [p,d,m,mi,w,sf,sm,gp,tr,wr] = await Promise.all([
      cloud.client.from('profiles').select('calorie_target,protein_target,fiber_target,goal_weight,desired_weekly_weight_change,adaptive_target_enabled,adaptive_min_complete_days,show_optional_macros,show_meal_photos,weigh_in_reminder_enabled,weigh_in_reminder_time,day_close_reminder_enabled,day_close_reminder_time,weekly_review_reminder_enabled,weekly_review_day,weekly_review_time,reminder_timezone,updated_at').maybeSingle(),
      cloud.client.from('daily_logs').select('id,log_date,calorie_target,protein_target,status,notes,updated_at').order('log_date'),
      cloud.client.from('meals').select('id,daily_log_id,meal_type,title,calories,protein,carbs,fat,fiber,confidence,source,original_input,notes,calories_low,calories_high,photo_url,photo_alt,eaten_at,created_at,updated_at').order('eaten_at'),
      cloud.client.from('meal_items').select('id,meal_id,saved_food_id,name,quantity_text,calories,protein,carbs,fat,fiber,calories_low,calories_high,confidence,source,sort_order,updated_at').order('sort_order'),
      cloud.client.from('weight_entries').select('id,entry_date,weight,notes,created_at,updated_at').order('entry_date'),
      cloud.client.from('saved_foods').select('id,name,brand,barcode,quantity_text,calories,protein,carbs,fat,fiber,aliases,source,confidence,favorite,use_count,last_used_at,photo_url,verified_at,updated_at').order('use_count',{ascending:false}).limit(100),
      cloud.client.from('saved_meals').select('id,name,meal_type,calories,protein,carbs,fat,fiber,aliases,favorite,use_count,last_used_at,photo_url,updated_at').order('use_count',{ascending:false}).limit(50),
      cloud.client.from('goal_phases').select('id,phase_type,name,start_date,end_date,calorie_target,protein_target,fiber_target,goal_weight,desired_weekly_weight_change,active,notes,created_at,updated_at').order('start_date',{ascending:false}),
      cloud.client.from('target_recommendations').select('id,generated_on,lookback_days,complete_days,weigh_in_count,avg_calories,weekly_weight_change,estimated_maintenance,desired_weekly_weight_change,current_target,raw_recommended_target,recommended_target,rationale,status,created_at,resolved_at').order('created_at',{ascending:false}).limit(20),
      cloud.client.from('weekly_reviews').select('id,week_end,payload,created_at').order('week_end',{ascending:false}).limit(20)
    ]);
    for(const r of [p,d,m,mi,w,sf,sm,gp,tr,wr]) if(r.error) throw r.error;

    const dailyLogs={}, dateById={}, itemsByMeal={};
    (d.data||[]).forEach(x=>{
      dailyLogs[x.log_date]={id:x.id,status:x.status,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),notes:x.notes||'',updatedAt:x.updated_at};
      dateById[x.id]=x.log_date;
    });
    (mi.data||[]).forEach(x=>{
      (itemsByMeal[x.meal_id] ||= []).push({
        id:x.id,savedFoodId:x.saved_food_id,name:x.name,quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),
        carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),
        caloriesLow:x.calories_low,caloriesHigh:x.calories_high,confidence:x.confidence,source:x.source,updatedAt:x.updated_at
      });
    });

    dashboard={
      profile:{
        calorieTarget:Number(p.data?.calorie_target??2300),proteinTarget:Number(p.data?.protein_target??160),fiberTarget:Number(p.data?.fiber_target??30),
        goalWeight:p.data?.goal_weight==null?null:Number(p.data.goal_weight),desiredWeeklyWeightChange:p.data?.desired_weekly_weight_change==null?null:Number(p.data.desired_weekly_weight_change),
        adaptiveTargetEnabled:p.data?.adaptive_target_enabled!==false,adaptiveMinCompleteDays:Number(p.data?.adaptive_min_complete_days??14),
        showOptionalMacros:Boolean(p.data?.show_optional_macros),showMealPhotos:p.data?.show_meal_photos!==false,
        weighInReminderEnabled:Boolean(p.data?.weigh_in_reminder_enabled),weighInReminderTime:p.data?.weigh_in_reminder_time||null,
        dayCloseReminderEnabled:Boolean(p.data?.day_close_reminder_enabled),dayCloseReminderTime:p.data?.day_close_reminder_time||null,
        weeklyReviewReminderEnabled:Boolean(p.data?.weekly_review_reminder_enabled),weeklyReviewDay:p.data?.weekly_review_day,weeklyReviewTime:p.data?.weekly_review_time||null,
        reminderTimezone:p.data?.reminder_timezone||null
      },
      dailyLogs,
      meals:(m.data||[]).map(x=>({
        id:x.id,date:dateById[x.daily_log_id]||String(x.eaten_at||'').slice(0,10),type:x.meal_type||'Other',title:x.title||'Meal',calories:Number(x.calories||0),protein:Number(x.protein||0),
        carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),
        confidence:x.confidence||'medium',source:x.source||'text_estimate',originalInput:x.original_input||'',notes:x.notes||'',caloriesLow:x.calories_low,caloriesHigh:x.calories_high,
        photoUrl:x.photo_url||null,photoAlt:x.photo_alt||'',eatenAt:x.eaten_at,updatedAt:x.updated_at,items:itemsByMeal[x.id]||[]
      })),
      weights:(w.data||[]).map(x=>({id:x.id,date:x.entry_date,weight:Number(x.weight),notes:x.notes||'',updatedAt:x.updated_at||x.created_at})),
      savedFoods:(sf.data||[]).map(x=>({id:x.id,name:x.name,brand:x.brand||'',barcode:x.barcode||'',quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],source:x.source,confidence:x.confidence,favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,verifiedAt:x.verified_at,updatedAt:x.updated_at})),
      savedMeals:(sm.data||[]).map(x=>({id:x.id,name:x.name,mealType:x.meal_type,calories:x.calories==null?null:Number(x.calories),protein:x.protein==null?null:Number(x.protein),carbs:x.carbs==null?null:Number(x.carbs),fat:x.fat==null?null:Number(x.fat),fiber:x.fiber==null?null:Number(x.fiber),aliases:x.aliases||[],favorite:Boolean(x.favorite),useCount:Number(x.use_count||0),lastUsedAt:x.last_used_at,photoUrl:x.photo_url||null,updatedAt:x.updated_at})),
      goalPhases:(gp.data||[]).map(x=>({id:x.id,phaseType:x.phase_type,name:x.name,startDate:x.start_date,endDate:x.end_date,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),fiberTarget:Number(x.fiber_target),goalWeight:x.goal_weight==null?null:Number(x.goal_weight),desiredWeeklyWeightChange:x.desired_weekly_weight_change==null?null:Number(x.desired_weekly_weight_change),active:Boolean(x.active),notes:x.notes||'',createdAt:x.created_at,updatedAt:x.updated_at})),
      recommendations:(tr.data||[]).map(x=>({id:x.id,generatedOn:x.generated_on,lookbackDays:Number(x.lookback_days),completeDays:Number(x.complete_days),weighInCount:Number(x.weigh_in_count),avgCalories:x.avg_calories==null?null:Number(x.avg_calories),weeklyWeightChange:x.weekly_weight_change==null?null:Number(x.weekly_weight_change),estimatedMaintenance:x.estimated_maintenance==null?null:Number(x.estimated_maintenance),desiredWeeklyWeightChange:x.desired_weekly_weight_change==null?null:Number(x.desired_weekly_weight_change),currentTarget:Number(x.current_target),rawRecommendedTarget:x.raw_recommended_target==null?null:Number(x.raw_recommended_target),recommendedTarget:x.recommended_target==null?null:Number(x.recommended_target),rationale:x.rationale||'',status:x.status,createdAt:x.created_at,resolvedAt:x.resolved_at})),
      weeklyReviews:(wr.data||[]).map(x=>({id:x.id,weekEnd:x.week_end,payload:x.payload||{},createdAt:x.created_at})),
      fetchedAt:new Date().toISOString(),source:'cloud'
    };
    v5EnsureDashboardShape();
    saveDashboardCache(); cloud.status='online'; cloud.error=null;
    try{
      const {data:health,error:he}=await cloud.client.rpc('diet_copilot_healthcheck');
      if(!he&&health){cloud.bridgeReady=Boolean(health.capabilities?.log_meal_from_ai&&health.capabilities?.log_weight_from_ai);cloud.schemaVersion=health.schema_version;}
    }catch{}
    render(); if(!silent)showToast('Dashboard refreshed');
  } catch(e) {
    cloud.status='error'; cloud.error=e.message||String(e); updateStatus();
    if(!silent)showToast(`Refresh failed: ${p5FriendlyError? p5FriendlyError(cloud.error):cloud.error}`);
    if(connectionDialog.open)renderConnection();
  }
};

subscribeRealtime = async function subscribeRealtimeV5() {
  if(!cloud.client||!cloud.user)return;
  if(cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{}}
  let ch=cloud.client.channel(`diet-dashboard-v5-${cloud.user.id}`);
  ['profiles','daily_logs','meals','meal_items','weight_entries','saved_foods','saved_meals','goal_phases','target_recommendations','weekly_reviews'].forEach(table=>{
    ch=ch.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshData({silent:true}),350);});
  });
  cloud.channel=ch.subscribe();
};

mealCard = function mealCardV5(m) {
  const range = m.caloriesLow != null && m.caloriesHigh != null && Number(m.caloriesLow)!==Number(m.caloriesHigh) ? `${fmt(m.caloriesLow)}–${fmt(m.caloriesHigh)} kcal` : null;
  const sourceMeta=p2SourceMeta(m), cls=p2MealClass(m.type), time=m.eatenAt?new Date(m.eatenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  const photo=v5SafePhotoUrl(m.photoUrl), showPhoto=photo && dashboard.profile?.showMealPhotos!==false;
  const itemRows=(m.items||[]).map(i=>{
    const bits=[];
    if(i.quantity)bits.push(esc(i.quantity));
    if(Number(i.protein||0)>0)bits.push(`${fmt(i.protein,1)} g protein`);
    if(i.fiber!=null)bits.push(`${fmt(i.fiber,1)} g fiber`);
    if(dashboard.profile?.showOptionalMacros){if(i.carbs!=null)bits.push(`${fmt(i.carbs,1)} g carbs`);if(i.fat!=null)bits.push(`${fmt(i.fat,1)} g fat`);}
    return `<div class="meal-detail-row"><div class="meal-detail-main"><strong>${esc(i.name||'Food')}</strong>${bits.length?`<small>${bits.join(' · ')}</small>`:''}</div><div class="meal-detail-cal">${fmt(i.calories)} kcal</div></div>`;
  }).join('');
  const meta=[];
  if(range)meta.push(`<span class="meal-estimate-range">Likely ${range}</span>`);
  if(m.fiber!=null)meta.push(`<span class="v5-fiber-text">${fmt(m.fiber,1)} g fiber</span>`);
  if(dashboard.profile?.showOptionalMacros){if(m.carbs!=null)meta.push(`${fmt(m.carbs,1)} g carbs`);if(m.fat!=null)meta.push(`${fmt(m.fat,1)} g fat`);}
  if(m.notes)meta.push(esc(m.notes));
  return `<details class="meal-v2 ${cls} ${showPhoto?'has-photo':''}">
    <summary>
      ${showPhoto?`<img class="v5-meal-photo" src="${esc(photo)}" alt="${esc(m.photoAlt||m.title||'Meal photo')}" loading="lazy">`:''}
      <div class="meal-summary-main">
        <div class="meal-kicker"><span class="meal-dot" aria-hidden="true"></span><span class="meal-type-v2">${esc(m.type||'Meal')}</span>${time?`<span class="meal-time-v2">${esc(time)}</span>`:''}</div>
        <div class="meal-name-v2">${esc(m.title||'Meal')}</div>
        <div class="meal-meta-v2"><span class="meal-protein-v2">${fmt(m.protein,1)} g protein</span>${m.fiber!=null?`<span>·</span><span class="v5-fiber-text">${fmt(m.fiber,1)} g fiber</span>`:''}<span>·</span><span class="meal-source-v2 ${sourceMeta.cls}">${esc(sourceMeta.label)}</span></div>
      </div>
      <div class="meal-summary-side"><strong>${fmt(m.calories)}</strong><small>kcal</small><svg class="meal-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></div>
    </summary>
    <div class="meal-details-v2">${itemRows||`<div class="meal-detail-row"><div class="meal-detail-main"><strong>No item breakdown</strong><small>Only the meal total was recorded.</small></div></div>`}${meta.length?`<div class="meal-details-meta"><strong>${esc(sourceMeta.label)}</strong><br>${meta.join(' · ')}</div>`:''}</div>
  </details>`;
};

p4WeekSnapshotMarkup = function p4WeekSnapshotMarkupV5() {
  const complete=completeDates(7), avgCalories=complete.length?average(complete.map(d=>totalsFor(d).calories)):null, avgProtein=complete.length?average(complete.map(d=>totalsFor(d).protein)):null;
  const fiberDays=complete.map(d=>v5MacroForDate(d,'fiber')).filter(x=>x.complete), avgFiber=fiberDays.length?average(fiberDays.map(x=>x.value)):null;
  const weights=dashboard.weights.filter(w=>w.date>=rangeStart(7)).sort((a,b)=>a.date.localeCompare(b.date));
  const weightChange=weights.length>1?Number(weights.at(-1).weight)-Number(weights[0].weight):null, latest=latestWeight();
  return `<aside class="p4-week-card" aria-label="Seven day snapshot"><div class="p4-week-card-head"><div><strong>7-day snapshot</strong><span>Complete days only for intake averages</span></div></div><div class="p4-week-grid v5-week-grid">
    <div class="p4-week-stat calories"><span>Avg calories</span><strong>${avgCalories==null?'—':`${fmt(avgCalories)} kcal`}</strong></div>
    <div class="p4-week-stat protein"><span>Avg protein</span><strong>${avgProtein==null?'—':`${fmt(avgProtein,1)} g`}</strong></div>
    <div class="p4-week-stat v5-fiber"><span>Avg fiber</span><strong>${avgFiber==null?'—':`${fmt(avgFiber,1)} g`}</strong></div>
    <div class="p4-week-stat weight"><span>Weight change</span><strong>${weightChange==null?(latest?`${fmt(latest.weight,1)} kg`:'—'):`${weightChange>0?'+':''}${fmt(weightChange,1)} kg`}</strong></div>
    <div class="p4-week-stat complete"><span>Complete days</span><strong>${complete.length}/7</strong></div>
  </div><div class="p4-week-note">Incomplete days are excluded from intake averages. Fiber averages only use days where fiber data is complete.</div></aside>`;
};

const v5RenderTodayBase=renderToday;
renderToday=function renderTodayV5(){
  const result=v5RenderTodayBase(); v5EnsureDashboardShape();
  const root=app.querySelector('.today-v2'); if(!root)return result;
  const date=localDateKey(), fiber=v5MacroForDate(date,'fiber'), target=Number(dashboard.profile.fiberTarget||30), pct=target?Math.max(0,Math.min(100,fiber.value/target*100)):0;
  const metrics=root.querySelector('.today-metrics');
  if(metrics&&!metrics.querySelector('.today-metric.fiber')) metrics.insertAdjacentHTML('beforeend',`<section class="today-metric fiber" aria-label="Fiber summary"><div class="metric-v2-head"><span class="metric-v2-title">Fiber</span><span class="metric-v2-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21V10"/><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 16c4 0 6-2 6-6-4 0-6 2-6 6Z"/></svg></span></div><div class="metric-v2-value">${fiber.hasAny?`${fmt(fiber.value,1)} g`:'—'}</div><div class="metric-v2-sub">${fiber.hasAny?`${fiber.complete?'':'At least '}${fmt(fiber.value,1)} of ${fmt(target)} g${fiber.complete?'':' · partial data'}`:'No fiber data yet'}</div><div class="v5-fiber-track"><span style="width:${pct}%"></span></div></section>`);
  const head=root.querySelector('.today-meals-head');
  if(head&&!head.querySelector('.v5-day-status')){const status=String(dayLog(date).status||'open');head.insertAdjacentHTML('beforeend',`<span class="v5-day-status ${esc(status)}">${status==='complete'?'Complete day':status==='partial'?'Partial day':'Open day'}</span>`);}
  const phase=v5CurrentPhase(), goal=dashboard.profile.goalWeight, pace=dashboard.profile.desiredWeeklyWeightChange;
  if((phase||goal!=null||pace!=null)&&!root.querySelector('.v5-goal-strip')){
    const parts=[]; if(phase)parts.push(`<strong>${esc(phase.name)}</strong>`); if(goal!=null)parts.push(`Goal ${fmt(goal,1)} kg`); if(pace!=null)parts.push(`Desired ${pace>0?'+':''}${fmt(pace,2)} kg/week`);
    const anchor=root.querySelector('.today-metrics'); anchor?.insertAdjacentHTML('afterend',`<div class="v5-goal-strip"><span>Goal</span><div>${parts.join('<i>·</i>')}</div></div>`);
  }
  if(dashboard.profile.showOptionalMacros&&!root.querySelector('.v5-macro-strip')){
    const carbs=v5MacroForDate(date,'carbs'), fat=v5MacroForDate(date,'fat');
    root.querySelector('.today-meals-section')?.insertAdjacentHTML('beforebegin',`<div class="v5-macro-strip"><span>Optional macros</span><strong>Carbs ${carbs.hasAny?`${carbs.complete?'':'≥'}${fmt(carbs.value,1)} g`:'—'}</strong><strong>Fat ${fat.hasAny?`${fat.complete?'':'≥'}${fmt(fat.value,1)} g`:'—'}</strong></div>`);
  }
  return result;
};

p3TrendTabs=function p3TrendTabsV5(){
  const tabs=[['weight','Weight'],['calories','Calories'],['protein','Protein'],['fiber','Fiber']];
  return `<div class="p3-segmented v5-trend-tabs" role="tablist" aria-label="Trend metric">${tabs.map(([key,label])=>`<button type="button" role="tab" aria-selected="${p3TrendMetric===key?'true':'false'}" class="${p3TrendMetric===key?'active':''}" data-trend-metric="${key}">${label}</button>`).join('')}</div>`;
};

function v5FiberChart(dates){
  if(!dates.length)return `<div class="p3-chart-empty"><strong>No fiber data yet</strong><span>Fiber appears when nutrition labels or meal estimates include it.</span></div>`;
  const width=760,height=250,left=42,right=18,top=24,bottom=34,target=Number(dashboard.profile.fiberTarget||30);
  const points=dates.map(date=>{const f=v5MacroForDate(date,'fiber');return {date,value:f.hasAny?f.value:null,complete:f.complete&&dayLog(date).status==='complete',coverage:f.complete};});
  if(!points.some(p=>p.value!=null))return `<div class="p3-chart-empty"><strong>No fiber data yet</strong><span>New nutrition-label foods will automatically carry fiber when it is available.</span></div>`;
  const max=Math.max(target,...points.map(p=>Number(p.value)||0),1)*1.15,plot=width-left-right,step=plot/Math.max(1,points.length),barWidth=Math.max(1.5,Math.min(30,step*.58));
  const y=v=>top+(1-(Number(v)||0)/max)*(height-top-bottom), targetY=y(target);
  return `<div class="p3-chart-wrap"><svg class="p3-chart p3-bar-chart fiber" viewBox="0 0 ${width} ${height}" role="img" aria-label="Fiber trend chart"><line class="p3-grid" x1="${left}" x2="${width-right}" y1="${top}" y2="${top}"/><line class="p3-grid" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>${points.map((p,i)=>{if(p.value==null)return '';const x=left+step*i+(step-barWidth)/2,yy=y(p.value),h=Math.max(1,height-bottom-yy),label=`${prettyDate(p.date,{day:'numeric',month:'short'})}: ${p.coverage?'':'at least '}${fmt(p.value,1)} g fiber`;return `<rect class="p3-bar ${p.complete?'complete':'partial'} p6-chart-hit" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6,barWidth/2).toFixed(1)}" tabindex="0" role="img" aria-label="${esc(label)}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></rect>`;}).join('')}<line class="p3-target-line" x1="${left}" x2="${width-right}" y1="${targetY}" y2="${targetY}"/><text class="p3-axis-label" x="${left}" y="16">${fmt(max,0)} g</text><text class="p3-axis-date" x="${left}" y="${height-8}">${prettyDate(points[0].date,{day:'numeric',month:'short'})}</text><text class="p3-axis-date" x="${width-right}" y="${height-8}" text-anchor="end">${prettyDate(points.at(-1).date,{day:'numeric',month:'short'})}</text></svg><div class="p3-chart-legend"><span><i class="p3-legend-bar"></i>Recorded fiber</span><span><i class="p3-legend-line"></i>${fmt(target)} g target</span></div></div>`;
}

function v5TrendFiber(){
  const dates=p3TrendDates(), complete=dates.map(d=>({date:d,f:v5MacroForDate(d,'fiber')})).filter(x=>dayLog(x.date).status==='complete'&&x.f.complete), target=Number(dashboard.profile.fiberTarget||30), avg=complete.length?average(complete.map(x=>x.f.value)):null, hits=complete.filter(x=>x.f.value>=target).length, hitRate=complete.length?Math.round(hits/complete.length*100):null;
  return `<div class="p3-trend-summary fiber"><div class="p3-trend-primary"><span>Average fiber</span><strong>${avg==null?'—':`${fmt(avg,1)} g`}</strong><small>${complete.length?`${hits} of ${complete.length} complete-data days hit target`:'Complete fiber data is needed for averages'}</small></div><div class="p3-trend-secondary"><div><span>Fiber target</span><strong>${fmt(target)} g</strong></div><div><span>Target hit rate</span><strong>${hitRate==null?'—':`${hitRate}%`}</strong></div></div></div>${v5FiberChart(dates)}`;
}

renderTrends=function renderTrendsV5(){
  if(p3GateView())return;
  const metricContent=p3TrendMetric==='weight'?p3TrendWeight():p3TrendMetric==='calories'?p3TrendCalories():p3TrendMetric==='protein'?p3TrendProtein():v5TrendFiber();
  app.innerHTML=`<div class="p3-view p3-trends-view">${p3PageHeader('Trends','Follow weight, calories, protein and fiber without cluttering the screen with competing charts.')}${p3TrendTabs()}${p3RangeBar(trendRange,'trend',p3TrendRanges())}<section class="p3-trend-panel ${p3TrendMetric}">${metricContent}</section></div>`;
  app.querySelectorAll('[data-trend-metric]').forEach(button=>button.addEventListener('click',()=>{p3TrendMetric=button.dataset.trendMetric;renderTrends();}));
  app.querySelectorAll('[data-trend-range]').forEach(button=>button.addEventListener('click',()=>{trendRange=button.dataset.trendRange==='all'?Infinity:Number(button.dataset.trendRange);renderTrends();}));
};

function v5WeeklySummary(){
  const dates=Array.from({length:7},(_,i)=>offsetDateKey(i-6)), complete=dates.filter(d=>dayLog(d).status==='complete'), avgCalories=complete.length?average(complete.map(d=>totalsFor(d).calories)):null, avgProtein=complete.length?average(complete.map(d=>totalsFor(d).protein)):null;
  const weights=dashboard.weights.filter(w=>w.date>=dates[0]&&w.date<=dates.at(-1)).sort((a,b)=>a.date.localeCompare(b.date));
  const change=weights.length>1?weights.at(-1).weight-weights[0].weight:null;
  return {complete:complete.length,avgCalories,avgProtein,weightChange:change};
}

const v5RenderInsightsBase=renderInsights;
renderInsights=function renderInsightsV5(){
  const result=v5RenderInsightsBase(); const root=app.querySelector('.p3-insights-view'); if(!root)return result; v5EnsureDashboardShape();
  const week=v5WeeklySummary(), phase=v5CurrentPhase(), rec=v5LatestRecommendation(), foods=dashboard.savedFoods||[];
  const goalValue=phase?phase.name:(dashboard.profile.goalWeight!=null?`${fmt(dashboard.profile.goalWeight,1)} kg goal`:'Not configured');
  const goalCopy=phase?`${phase.phaseType} · ${fmt(phase.calorieTarget)} kcal · ${fmt(phase.proteinTarget)} g protein${phase.desiredWeeklyWeightChange!=null?` · ${phase.desiredWeeklyWeightChange>0?'+':''}${fmt(phase.desiredWeeklyWeightChange,2)} kg/week`:''}`:'Tell ChatGPT your goal weight and desired weekly change to enable adaptive calibration.';
  let recValue='Not ready', recCopy='Set a desired weekly weight-change rate and build enough complete-day / weigh-in data first.';
  if(rec){if(rec.status==='pending'&&rec.recommendedTarget!=null){recValue=`${fmt(rec.recommendedTarget)} kcal`;recCopy=`Suggested from ${rec.completeDays} complete days and ${rec.weighInCount} weigh-ins. Ask ChatGPT to apply or dismiss it.`;}else if(rec.status==='accepted'){recValue=`${fmt(rec.recommendedTarget)} kcal applied`;recCopy='The most recent adaptive recommendation was accepted.';}else if(rec.status==='insufficient'){recCopy=rec.rationale||recCopy;}}
  root.insertAdjacentHTML('beforeend',`<section class="v5-intelligence-section"><div class="v5-section-head"><div><h3>Diet intelligence</h3><p>Useful automation and planning without adding manual logging controls.</p></div></div><div class="v5-intelligence-grid">
    <article class="v5-intel-card goal"><span>Goal phase</span><strong>${esc(goalValue)}</strong><p>${esc(goalCopy)}</p></article>
    <article class="v5-intel-card week"><span>7-day review</span><strong>${week.complete}/7 complete</strong><p>${week.avgCalories==null?'Complete days will unlock reliable weekly averages.':`${fmt(week.avgCalories)} kcal · ${fmt(week.avgProtein,1)} g protein${week.weightChange==null?'':` · ${week.weightChange>0?'+':''}${fmt(week.weightChange,1)} kg`}`}</p></article>
    <article class="v5-intel-card calibration"><span>Calorie calibration</span><strong>${esc(recValue)}</strong><p>${esc(recCopy)}</p></article>
    <article class="v5-intel-card memory"><span>Food memory</span><strong>${foods.length} remembered</strong><p>${foods.length?`Exact packaged foods can now be reused without re-estimating. Most recent: ${esc(foods[0].name)}.`:'Exact nutrition-label foods will be remembered automatically.'}</p></article>
  </div></section>`);
  return result;
};

const v5RenderConnectionBase=renderConnection;
renderConnection=function renderConnectionV5(){
  v5RenderConnectionBase(); v5EnsureDashboardShape(); if(!cloud.user)return;
  const phase=v5CurrentPhase(), p=dashboard.profile;
  connectionContent.insertAdjacentHTML('beforeend',`<section class="v5-account-settings"><div class="v5-account-settings-head"><strong>Diet settings</strong><span>Managed through ChatGPT</span></div><div class="v5-settings-grid">
    <div><span>Goal phase</span><strong>${phase?esc(phase.name):'Not set'}</strong></div>
    <div><span>Goal weight</span><strong>${p.goalWeight==null?'—':`${fmt(p.goalWeight,1)} kg`}</strong></div>
    <div><span>Desired pace</span><strong>${p.desiredWeeklyWeightChange==null?'—':`${p.desiredWeeklyWeightChange>0?'+':''}${fmt(p.desiredWeeklyWeightChange,2)} kg/wk`}</strong></div>
    <div><span>Fiber target</span><strong>${fmt(p.fiberTarget||30)} g</strong></div>
    <div><span>Optional carbs/fat</span><strong>${p.showOptionalMacros?'Shown':'Hidden'}</strong></div>
    <div><span>Reminders</span><strong>${esc(v5ReminderSummary())}</strong></div>
  </div><p>Tell ChatGPT things like “set my goal to…”, “show carbs and fat”, or “remind me to close my day”.</p></section>`);
};
