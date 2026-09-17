const CACHE='diet-copilot-web-v1.0.3-account1';
const CORE=['./','./index.html','./diet.css?v=1.0.3-account1','./diet-app.js?v=1.0.3-account1','./vendor/supabase-2.116.0.js','./.well-known/thiepn-app.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('diet-copilot')).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function networkFirst(request, fallback=request) {
  try {
    const response=await fetch(new Request(request,{cache:'no-cache'}));
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(fallback,response.clone());}
    return response;
  } catch {
    return await caches.match(fallback) || Response.error();
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  // Never cache an OAuth result, an auth relay, or private API responses.
  if(['/native-auth-start.html','/native-auth-callback.html','/web-auth-callback.html'].some(path=>url.pathname.endsWith(path)) || ['code','sb_flow_id','error','error_description'].some(key=>url.searchParams.has(key)))return;
  if(request.mode==='navigate'){event.respondWith(networkFirst(request,'./index.html'));return;}
  if(['/diet-app.js','/diet.css','/manifest.webmanifest','/.well-known/thiepn-app.json'].some(path=>url.pathname.endsWith(path))){event.respondWith(networkFirst(request));return;}
  // Only public app-shell assets enter this cache. Other same-origin endpoints bypass it.
  if(!CORE.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
  event.respondWith(caches.match(request).then(cached=>cached||networkFirst(request)));
});
