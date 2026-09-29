const STORAGE_KEY='diet-copilot-v2-ops-telemetry-v1';
const MAX_EVENTS=120;
const RETENTION_MS=7*24*60*60*1000;
const SESSION_STARTED_AT=Date.now();
const ALLOWED_META=new Set([
  'action','status','source','operation','outcome','phase','code','file','line',
  'online','retried','silent','durationMs','ready','supported','realtime',
  'workerReady','writeBlocked','storage','event'
]);

let storageAvailable=true;
let events=load();

function nowMs(){
  try{return performance.now();}catch{return Date.now();}
}
function token(value,max=64){
  return String(value??'')
    .trim()
    .replace(/[^a-zA-Z0-9_.:\/-]+/g,'_')
    .slice(0,max);
}
export function telemetryErrorCode(error){
  if(!error)return 'unknown';
  const status=Number(error?.status);
  if(Number.isFinite(status)&&status>0)return 'http_'+Math.trunc(status);
  const code=token(error?.code??'',48);
  if(code)return code;
  const name=token(error?.name??'',48);
  return name||'error';
}
function cleanMeta(input={}){
  const out={};
  if(!input||typeof input!=='object')return out;
  for(const [key,value] of Object.entries(input)){
    if(!ALLOWED_META.has(key)||value===undefined||value===null)continue;
    if(typeof value==='boolean'){out[key]=value;continue;}
    if(typeof value==='number'&&Number.isFinite(value)){
      out[key]=key==='durationMs'?Math.max(0,Math.round(value)):Math.round(value*100)/100;
      continue;
    }
    if(typeof value==='string')out[key]=token(value);
  }
  return out;
}
function validEvent(value){
  return value&&typeof value==='object'&&Number.isFinite(Number(value.at))&&
    typeof value.type==='string'&&value.type.length<=48&&
    value.meta&&typeof value.meta==='object'&&!Array.isArray(value.meta);
}
function prune(list,now=Date.now()){
  const cutoff=now-RETENTION_MS;
  return list.filter(item=>validEvent(item)&&Number(item.at)>=cutoff).slice(-MAX_EVENTS);
}
function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return [];
    const parsed=JSON.parse(raw);
    return prune(Array.isArray(parsed)?parsed:[]);
  }catch{
    storageAvailable=false;
    return [];
  }
}
function persist(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(events));
    storageAvailable=true;
  }catch{
    storageAvailable=false;
  }
}
function notify(){
  try{window.dispatchEvent(new CustomEvent('diet-v2-telemetry-updated'));}catch{}
}
export function recordTelemetry(type,meta={}){
  const cleanType=token(type,48).toLowerCase();
  if(!cleanType)return null;
  const event={at:Date.now(),type:cleanType,meta:cleanMeta(meta)};
  events=prune([...events,event]);
  persist();
  notify();
  return event;
}
export function startTelemetrySpan(type,meta={}){
  const started=nowMs();
  let ended=false;
  return Object.freeze({
    end(extra={}){
      if(ended)return null;
      ended=true;
      return recordTelemetry(type,{...meta,...extra,durationMs:Math.max(0,nowMs()-started)});
    }
  });
}
export function clearTelemetry(){
  events=[];
  try{localStorage.removeItem(STORAGE_KEY);storageAvailable=true;}catch{storageAvailable=false;}
  notify();
  return storageAvailable;
}
function counts(list){
  const out={};
  for(const item of list)out[item.type]=(out[item.type]??0)+1;
  return out;
}
export function getTelemetrySnapshot(){
  events=prune(events);
  const dayCutoff=Date.now()-24*60*60*1000;
  const recent24=events.filter(item=>item.at>=dayCutoff);
  return {
    version:'2.0.1-p13',
    storage:storageAvailable?'local':'memory',
    sessionStartedAt:new Date(SESSION_STARTED_AT).toISOString(),
    sessionAgeMs:Math.max(0,Date.now()-SESSION_STARTED_AT),
    eventCount:events.length,
    events24h:recent24.length,
    lastEventAt:events.at(-1)?.at??null,
    counts:counts(recent24),
    recent:events.slice(-20).map(item=>({at:item.at,type:item.type,meta:{...item.meta}}))
  };
}
export function buildTelemetryDiagnostics(extra={}){
  const snapshot=getTelemetrySnapshot();
  return {
    product:'Diet Copilot',
    release:'2.0.1-p13',
    generatedAt:new Date().toISOString(),
    telemetryPolicy:'local operational metadata only; no nutrition records, auth tokens, email addresses, or free-form user content',
    network:{online:typeof navigator==='undefined'?null:navigator.onLine!==false},
    page:{visibility:typeof document==='undefined'?null:token(document.visibilityState,24)},
    operational:cleanMeta(extra),
    telemetry:snapshot
  };
}
function fileName(value){
  try{
    const path=new URL(String(value||''),globalThis.location?.href||'https://local.invalid/').pathname;
    return token(path.split('/').filter(Boolean).at(-1)||'unknown',48);
  }catch{return 'unknown';}
}
function installRuntimeGuards(){
  if(typeof window==='undefined'||!window.addEventListener)return;
  window.addEventListener('error',event=>{
    recordTelemetry('runtime_error',{
      phase:'window',
      code:telemetryErrorCode(event?.error),
      file:fileName(event?.filename),
      line:Number(event?.lineno)||0
    });
  });
  window.addEventListener('unhandledrejection',event=>{
    recordTelemetry('runtime_error',{phase:'promise',code:telemetryErrorCode(event?.reason)});
  });
  window.addEventListener('online',()=>recordTelemetry('network',{status:'online',online:true}));
  window.addEventListener('offline',()=>recordTelemetry('network',{status:'offline',online:false}));
}
installRuntimeGuards();
recordTelemetry('session_start',{online:typeof navigator==='undefined'?true:navigator.onLine!==false,storage:storageAvailable?'local':'memory'});

export const DietTelemetryP13=Object.freeze({
  version:'2.0.1-p13',
  policy:'local-only-sanitized-operations',
  maxEvents:MAX_EVENTS,
  retentionDays:7
});
