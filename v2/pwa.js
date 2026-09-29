import { recordTelemetry, telemetryErrorCode } from './telemetry.mjs';
const state={registration:null,error:null,ready:false};

function canRegister(){
  return 'serviceWorker' in navigator && ['https:','http:'].includes(location.protocol);
}
async function register(){
  if(!canRegister()){
    recordTelemetry('pwa',{status:'unsupported',supported:false});
    return null;
  }
  recordTelemetry('pwa',{status:'registering',supported:true});
  try{
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    state.registration=registration;
    await navigator.serviceWorker.ready;
    state.ready=true;
    recordTelemetry('pwa',{status:'ready',ready:true,supported:true});
    registration.update().catch(error=>recordTelemetry('pwa',{status:'update_error',code:telemetryErrorCode(error),ready:true}));
    return registration;
  }catch(error){
    state.error=String(error?.message??error??'Service worker registration failed.');
    recordTelemetry('pwa',{status:'error',code:telemetryErrorCode(error),ready:false,supported:true});
    return null;
  }
}
window.addEventListener('online',()=>state.registration?.update?.().catch(error=>recordTelemetry('pwa',{status:'update_error',code:telemetryErrorCode(error)})));
window.DietV2Pwa=Object.freeze({
  version:'2.0.2-p16',
  snapshot:()=>({supported:canRegister(),ready:state.ready,error:state.error})
});
register();
