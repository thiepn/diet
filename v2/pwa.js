const state={registration:null,error:null,ready:false};

function canRegister(){
  return 'serviceWorker' in navigator && ['https:','http:'].includes(location.protocol);
}
async function register(){
  if(!canRegister())return null;
  try{
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    state.registration=registration;
    await navigator.serviceWorker.ready;
    state.ready=true;
    registration.update().catch(()=>{});
    return registration;
  }catch(error){
    state.error=String(error?.message??error??'Service worker registration failed.');
    return null;
  }
}
window.addEventListener('online',()=>state.registration?.update?.().catch(()=>{}));
window.DietV2Pwa=Object.freeze({
  version:'1.0.0-p10',
  snapshot:()=>({supported:canRegister(),ready:state.ready,error:state.error})
});
register();
