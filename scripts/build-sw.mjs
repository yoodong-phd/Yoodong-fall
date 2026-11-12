import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets")).map((f) => "/assets/" + f);
const files = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  ...assets,
];
const hash = createHash("sha256");
for (const file of files)
  hash.update(await readFile("dist" + (file === "/" ? "/index.html" : file)));
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `
const CACHE='stable-pwa-${version}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('stable-pwa-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;
 }
 if(!FILES.includes(url.pathname)&&!url.pathname.startsWith('/wasm/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),cached=await cache.match(request);if(cached)return cached;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());return response;
 })());
});
`,
);
console.log("Generated PWA service worker", version);
