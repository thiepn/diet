document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.getElementById('statusBtn').addEventListener('click',openConnection);
document.getElementById('refreshBtn').addEventListener('click',()=>cloud.user?refreshData():openConnection());
document.getElementById('closeConnectionBtn').addEventListener('click',()=>connectionDialog.close());
window.addEventListener('online',()=>{if(cloud.user)refreshData({silent:true});else updateStatus();});
window.addEventListener('offline',updateStatus);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cloud.user)updateDateRefresh();});

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

render();
initCloud(false).then(()=>{
  // If there is no authenticated session, make that explicit instead of
  // silently showing an empty dashboard that looks like missing data.
  if(!cloud.user && configured()) setTimeout(()=>{ if(!connectionDialog.open) openConnection(); },200);
});
