'use strict';

// This is the only startup entry point and must be last in the production bundle.
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.getElementById('statusBtn').addEventListener('click',openConnection);
document.getElementById('refreshBtn').addEventListener('click',()=>cloud.user?refreshData():openConnection());
document.getElementById('closeConnectionBtn').addEventListener('click',()=>connectionDialog.close());
window.addEventListener('online', dietResumeAccount);
window.addEventListener('offline',updateStatus);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')dietResumeAccount();});
window.addEventListener('pageshow', event=>{if(event.persisted){dietSignInPromise=null;dietResumeAccount();}});

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    // A new worker may contain backend/auth routing changes. Once it takes
    // control, immediately replace any stale in-memory snapshot from the old
    // deployment with a fresh canonical-backend read.
    setTimeout(()=>{ if(cloud.user) refreshData({silent:true}); },250);
  });
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then(reg=>reg.update())
    .catch(e=>console.warn('Service worker registration failed',e));
}


document.querySelector('.desktop-account[data-open-account]')?.addEventListener('click',openConnection);
render();
initCloud(false).then(()=>{if(cloud.error && dietHadOAuthCallback)openConnection();});
