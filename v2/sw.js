const CACHE='diet-copilot-v2-alias-p37-1';
const CORE=[
  './','./index.html','./manifest.webmanifest','./shell.css','./shell.js','./pwa.js','./p35-delight.js','./p37-hardening.js',
  './data.js','./auth-storage.mjs','./telemetry.mjs','./read-model.mjs','./write-api.mjs','./p33-progress-analytics.mjs',
  './p28-food-capture.mjs','./p29-food-memory.mjs','./p30-onboarding.mjs','./onboarding.js','./p31-weekly-review.mjs','./p32-copilot-actions.mjs','./food.js','./meal-editor.js','./food-management.js','./open-food-facts.mjs',
  './strategy-actions.js','./training-actions.js','./copilot.js','./settings.js',
  './engine/adaptive-nutrition.mjs','./engine/legacy-data-adapter.mjs',
  './engine/training-nutrition.mjs','./engine/personal-intelligence.mjs',
  './engine/copilot-context.mjs','./engine/settings-data.mjs','./engine/release-guards.mjs',
  '../vendor/supabase-2.116.0.js','../icon.svg','../icon-192.png','../icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys
        .filter(key=>key.startsWith('diet-copilot-v2-')&&key!==CACHE)
        .map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request,fallback=null){
  try{
    const response=await fetch(new Request(request,{cache:'no-cache'}));
    if(response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
    return response;
  }catch{
    return await caches.match(request)
      || (fallback?await caches.match(fallback):null)
      || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(
    ['/native-auth-start.html','/native-auth-callback.html','/web-auth-callback.html']
      .some(path=>url.pathname.endsWith(path))
    || ['code','sb_flow_id','error','error_code','error_description']
      .some(key=>url.searchParams.has(key))
  ) return;

  const scopePath=new URL('./',self.registration.scope).pathname;
  if(request.mode==='navigate'){
    if(!url.pathname.startsWith(scopePath))return;
    event.respondWith(networkFirst(request,new URL('./index.html',self.registration.scope)));
    return;
  }

  const coreUrls=new Set(CORE.map(path=>new URL(path,self.registration.scope).href));
  if(!coreUrls.has(url.href.split('#')[0]))return;
  event.respondWith(networkFirst(request));
});
