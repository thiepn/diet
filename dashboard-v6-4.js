'use strict';

// V6.4 — Reliability, Reconciliation & Data Integrity.
// The dashboard remains read-only. This layer only makes the existing viewer
// converge back to canonical Supabase state quickly after resume/reconnect.

let v64RefreshPromise = null;
let v64ResumeTimer = null;
const V64_STALE_MS = 15000;

function v64SnapshotAgeMs(){
  const stamp = dashboard?.fetchedAt;
  const parsed = stamp ? Date.parse(stamp) : 0;
  return parsed > 0 ? Math.max(0, Date.now() - parsed) : Infinity;
}

async function v64RefreshCanonical({force=false}={}){
  if(!cloud?.client || !cloud?.user) return false;
  if(navigator.onLine === false) return false;
  if(!force && v64SnapshotAgeMs() < V64_STALE_MS) return false;
  if(v64RefreshPromise) return v64RefreshPromise;

  v64RefreshPromise = (async()=>{
    try{
      await refreshData({silent:true});
      return true;
    }catch(error){
      console.warn('V6.4 canonical refresh failed', error);
      return false;
    }finally{
      v64RefreshPromise = null;
    }
  })();
  return v64RefreshPromise;
}

function v64ScheduleCanonicalRefresh(force=false){
  clearTimeout(v64ResumeTimer);
  v64ResumeTimer = setTimeout(()=>v64RefreshCanonical({force}), 120);
}

window.addEventListener('online', ()=>v64ScheduleCanonicalRefresh(true));
window.addEventListener('focus', ()=>v64ScheduleCanonicalRefresh(false));
window.addEventListener('pageshow', event=>v64ScheduleCanonicalRefresh(Boolean(event.persisted)));
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') v64ScheduleCanonicalRefresh(false);
});

// If a Realtime subscription disappeared while the app was suspended, rebuild
// it on a forced reconnect. This is silent and does not alter data.
window.addEventListener('online', ()=>{
  setTimeout(()=>{
    if(cloud?.user && typeof subscribeRealtime === 'function'){
      Promise.resolve(subscribeRealtime()).catch(error=>console.warn('V6.4 realtime resubscribe failed', error));
    }
  }, 250);
});

// Keep the product boundary explicit even if old cached V6 scripts are mixed in.
const v64RenderTodayBase = renderToday;
renderToday = function renderTodayV64(){
  const result = v64RenderTodayBase();
  app.querySelector('.today-v2 .v6-capture-card')?.remove();
  return result;
};

// Reconcile once after the new layer arrives when the current snapshot is stale.
queueMicrotask(()=>v64ScheduleCanonicalRefresh(false));
