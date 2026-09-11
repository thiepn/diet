document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.getElementById('statusBtn').addEventListener('click',openConnection);
document.getElementById('refreshBtn').addEventListener('click',()=>cloud.user?refreshData():openConnection());
document.getElementById('closeConnectionBtn').addEventListener('click',()=>connectionDialog.close());
window.addEventListener('online',()=>{if(cloud.user)refreshData({silent:true});else updateStatus();});
window.addEventListener('offline',updateStatus);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cloud.user)updateDateRefresh();});

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    // The previous release accidentally cached authenticated Supabase GETs.
    // Once the fixed worker takes control, immediately fetch a fresh snapshot.
    setTimeout(()=>{ if(cloud.user) refreshData({silent:true}); },250);
  });
  navigator.serviceWorker.register('./sw.js').then(reg=>reg.update()).catch(e=>console.warn('Service worker registration failed',e));
}

render();
initCloud(false).then(()=>{
  // If there is no authenticated session, make that explicit instead of
  // silently showing an empty dashboard that looks like missing data.
  if(!cloud.user && configured()) setTimeout(()=>{ if(!connectionDialog.open) openConnection(); },200);
});
