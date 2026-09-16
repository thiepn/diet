function updateStatus(){ let label='Cached', cls=''; if(cloud.status==='syncing'){label='Refreshing';cls='syncing'} else if(cloud.status==='error'){label='Error';cls='error'} else if(cloud.user){label='Live';cls='online'} else if(configured()){label='Sign in'} else if(dashboard.source==='empty'){label='Setup'} statusText.textContent=label; statusDot.className=`status-dot ${cls}`; }

async function disposeCloud(){ if(cloud.client && cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{}} try{cloud.authSubscription?.unsubscribe?.()}catch{} try{await cloud.client?.auth?.dispose?.()}catch{} cloud.channel=null;cloud.authSubscription=null;cloud.client=null;cloud.user=null; }
async function initCloud(showDialog=false){ cloud.error=null; if(!configured()){await disposeCloud();cloud.status='cache';updateStatus();if(showDialog)openConnection();return;} if(!window.supabase?.createClient){cloud.status='error';cloud.error='Supabase SDK failed to load';updateStatus();return;} try{await disposeCloud();cloud.client=window.supabase.createClient(cloudConfig.url,cloudConfig.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); const {data,error}=await cloud.client.auth.getSession(); if(error)throw error; cloud.user=data.session?.user||null; cloud.status=cloud.user?'online':'configured'; const {data:listener}=cloud.client.auth.onAuthStateChange((_event,session)=>{const before=cloud.user?.id;cloud.user=session?.user||null;cloud.status=cloud.user?'online':'configured';updateStatus();if(cloud.user&&cloud.user.id!==before){refreshData({silent:true});subscribeRealtime();}if(!cloud.user&&cloud.channel){cloud.client.removeChannel(cloud.channel).catch(()=>{});cloud.channel=null;}if(connectionDialog.open)renderConnection();}); cloud.authSubscription=listener?.subscription||null; if(cloud.user){await refreshData({silent:true});await subscribeRealtime();} updateStatus(); if(showDialog)openConnection(); }catch(e){cloud.status='error';cloud.error=e.message||String(e);updateStatus();if(showDialog)openConnection();} }

async function subscribeRealtime(){ if(!cloud.client||!cloud.user)return; if(cloud.channel){try{await cloud.client.removeChannel(cloud.channel)}catch{}} let ch=cloud.client.channel(`diet-dashboard-${cloud.user.id}`); ['profiles','daily_logs','meals','meal_items','weight_entries'].forEach(table=>{ch=ch.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshData({silent:true}),450);});}); cloud.channel=ch.subscribe(); }

async function refreshData({silent=false}={}){
  if(!cloud.client||!cloud.user){if(!silent)openConnection();return;}
  if(navigator.onLine===false){if(!silent)showToast('Offline — showing the last cached snapshot');return;}
  cloud.status='syncing';updateStatus();
  try{
    const [p,d,m,mi,w] = await Promise.all([
      cloud.client.from('profiles').select('calorie_target,protein_target,goal_weight,updated_at').maybeSingle(),
      cloud.client.from('daily_logs').select('id,log_date,calorie_target,protein_target,status,notes,updated_at').order('log_date'),
      cloud.client.from('meals').select('id,daily_log_id,meal_type,title,calories,protein,confidence,source,original_input,notes,calories_low,calories_high,eaten_at,created_at,updated_at').order('eaten_at'),
      cloud.client.from('meal_items').select('id,meal_id,name,quantity_text,calories,protein,calories_low,calories_high,confidence,source,sort_order,updated_at').order('sort_order'),
      cloud.client.from('weight_entries').select('id,entry_date,weight,notes,created_at,updated_at').order('entry_date')
    ]);
    for(const r of [p,d,m,mi,w]) if(r.error) throw r.error;
    const dailyLogs={}, dateById={}, itemsByMeal={};
    (d.data||[]).forEach(x=>{dailyLogs[x.log_date]={id:x.id,status:x.status,calorieTarget:Number(x.calorie_target),proteinTarget:Number(x.protein_target),notes:x.notes||'',updatedAt:x.updated_at};dateById[x.id]=x.log_date;});
    (mi.data||[]).forEach(x=>{(itemsByMeal[x.meal_id] ||= []).push({id:x.id,name:x.name,quantity:x.quantity_text||'',calories:Number(x.calories||0),protein:Number(x.protein||0),caloriesLow:x.calories_low,caloriesHigh:x.calories_high,confidence:x.confidence,source:x.source,updatedAt:x.updated_at});});
    dashboard={profile:{calorieTarget:Number(p.data?.calorie_target??2300),proteinTarget:Number(p.data?.protein_target??160),goalWeight:p.data?.goal_weight==null?null:Number(p.data.goal_weight)},dailyLogs,meals:(m.data||[]).map(x=>({id:x.id,date:dateById[x.daily_log_id]||String(x.eaten_at||'').slice(0,10),type:x.meal_type||'Other',title:x.title||'Meal',calories:Number(x.calories||0),protein:Number(x.protein||0),confidence:x.confidence||'medium',source:x.source||'text_estimate',originalInput:x.original_input||'',notes:x.notes||'',caloriesLow:x.calories_low,caloriesHigh:x.calories_high,eatenAt:x.eaten_at,updatedAt:x.updated_at,items:itemsByMeal[x.id]||[] })),weights:(w.data||[]).map(x=>({id:x.id,date:x.entry_date,weight:Number(x.weight),notes:x.notes||'',updatedAt:x.updated_at||x.created_at})),fetchedAt:new Date().toISOString(),source:'cloud'};
    saveDashboardCache(); cloud.status='online'; cloud.error=null;
    try{const {data:health,error:he}=await cloud.client.rpc('diet_copilot_healthcheck');if(!he&&health){cloud.bridgeReady=Boolean(health.capabilities?.log_meal_from_ai&&health.capabilities?.log_weight_from_ai);cloud.schemaVersion=health.schema_version;}}catch{}
    render(); if(!silent)showToast('Dashboard refreshed');
  }catch(e){cloud.status='error';cloud.error=e.message||String(e);updateStatus();if(!silent)showToast(`Refresh failed: ${cloud.error}`);if(connectionDialog.open)renderConnection();}
}

function openConnection(){renderConnection();connectionDialog.showModal();}
function renderConnection(){
  const email=cloud.user?.email||'';
  if(cloud.user){
    connectionContent.innerHTML=`<div class="connection-state"><strong>THIEPN Account</strong><span>Signed in as ${esc(email)}. Diet Copilot data stays private to this account.</span></div><div class="btn-row"><button class="btn primary" id="refreshNowBtn" type="button">Refresh now</button><button class="btn ghost" id="signOutBtn" type="button">Sign out</button></div>`;
    connectionContent.querySelector('#refreshNowBtn')?.addEventListener('click',()=>refreshData());
    connectionContent.querySelector('#signOutBtn')?.addEventListener('click',async()=>{await cloud.client.auth.signOut({scope:'local'});cloud.user=null;cloud.status='configured';dashboard=emptyDashboard();try{localStorage.removeItem(CACHE_KEY)}catch{}renderConnection();render();});
    return;
  }
  connectionContent.innerHTML=`<div class="connection-state"><strong>Sign in with THIEPN Account</strong><span>Continue with your Google account to sync Diet Copilot.</span>${cloud.error?`<br><span style="color:var(--danger)">${esc(cloud.error)}</span>`:''}</div><div class="btn-row"><button class="btn primary" id="googleSignInBtn" type="button">Continue with Google</button></div>`;
  connectionContent.querySelector('#googleSignInBtn')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent='Redirecting…';cloud.error=null;
    try{
      if(typeof dietSignInWithGoogle==='function')await dietSignInWithGoogle();
      else {const {error}=await cloud.client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${location.origin}${location.pathname}`,queryParams:{prompt:'select_account'}}});if(error)throw error;}
    }catch(error){cloud.error=error?.message||String(error);renderConnection();}
  });
}

function updateDateRefresh(){ if(cloud.user) refreshData({silent:true}); }
