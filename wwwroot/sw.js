const VERSION='__APP_VERSION__';
const CACHE='calculus-'+VERSION;
const FILES=['./','./?v='+VERSION,'./index.html','./styles.css?v='+VERSION,'./app.js?v='+VERSION,'./manifest.webmanifest?v='+VERSION,'./icon.svg?v='+VERSION,'./icon-192.png?v='+VERSION,'./icon-512.png?v='+VERSION];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('calculus-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).pathname.includes('/api/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy));return response;}).catch(()=>caches.match('./').then(hit=>hit||caches.match('./index.html'))));
  return;
 }
 event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match('./index.html'))));
});
