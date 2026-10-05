const CACHE='diet-copilot-prod-v2-p17-1';
const CORE=[
  './','./index.html','./manifest.webmanifest',
  './v2/shell.css','./v2/shell.js','./v2/pwa.js','./v2/data.js','./v2/auth-storage.mjs','./v2/telemetry.mjs',
  './v2/read-model.mjs','./v2/write-api.mjs','./v2/p28-food-capture.mjs','./v2/p29-food-memory.mjs','./v2/p30-onboarding.mjs','./v2/onboarding.js','./v2/p31-weekly-review.mjs','./v2/food.js','./v2/meal-editor.js',
  './v2/food-management.js','./v2/open-food-facts.mjs','./v2/strategy-actions.js',
  './v2/training-actions.js','./v2/copilot.js','./v2/settings.js',
  './v2/engine/adaptive-nutrition.mjs','./v2/engine/legacy-data-adapter.mjs',
  './v2/engine/training-nutrition.mjs','./v2/engine/personal-intelligence.mjs',
  './v2/engine/copilot-context.mjs','./v2/engine/settings-data.mjs','./v2/engine/release-guards.mjs',
  './vendor/supabase-2.116.0.js','./icon.svg','./icon-192.png','./icon-512.png',
  './legacy-v1.html','./legacy-v1-app.js?v=1.0.3-p12-rollback','./diet.css?v=1.0.3-account1'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('diet-copilot-web-')||key.startsWith('diet-copilot-prod-v2-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function networkFirst(request,fallback=null){
  try{
    const response=await fetch(new Request(request,{cache:'no-cache'}));
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
    return response;
  }catch{
    return await caches.match(request)||(fallback?await caches.match(fallback):null)||Response.error();
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(['/native-auth-start.html','/native-auth-callback.html','/web-auth-callback.html'].some(path=>url.pathname.endsWith(path))||['code','sb_flow_id','error','error_code','error_description'].some(key=>url.searchParams.has(key)))return;
  const scopePath=new URL('./',self.registration.scope).pathname;
  if(url.pathname.startsWith(scopePath+'v2/'))return;
  if(request.mode==='navigate'){
    if(url.pathname.endsWith('/legacy-v1.html')){event.respondWith(networkFirst(request,new URL('./legacy-v1.html',self.registration.scope)));return;}
    if(!url.pathname.startsWith(scopePath))return;
    event.respondWith(networkFirst(request,new URL('./index.html',self.registration.scope)));return;
  }
  const coreUrls=new Set(CORE.map(path=>new URL(path,self.registration.scope).href));
  if(!coreUrls.has(url.href.split('#')[0]))return;
  event.respondWith(networkFirst(request));
});
