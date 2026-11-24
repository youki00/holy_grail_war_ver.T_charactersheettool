/* 聖杯戦争TRPG キャラシメーカー：オフライン起動用 Service Worker
   ・ページ本体は「ネット優先」：つながるときは常に最新版を開き、つながらないときは前回の版を開く
   ・アイコン等は「保存分優先」、フォントは「保存分を使いつつ裏で更新」
   ・入力したシートの保存（ブラウザ内の保存領域）には関与しない */
const VERSION = "c5df3349cf25";
const CACHE = "seihai-multi-" + VERSION;
const FONT_CACHE = "seihai-multi-fonts";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("seihai-multi-") && k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function pageFirstNetwork(req){
  const cache = await caches.open(CACHE);
  try{
    const res = await Promise.race([fetch(req), timeout(5000)]);
    if(res && res.ok){ cache.put("./index.html", res.clone()); return res; }
    throw new Error("bad response");
  }catch(e){
    return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
  }
}

async function cacheFirst(req){
  const hit = await caches.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res && res.ok){ const c = await caches.open(CACHE); c.put(req, res.clone()); }
  return res;
}

async function staleWhileRevalidate(req){
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if(res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === "navigate") e.respondWith(pageFirstNetwork(req));
    else e.respondWith(cacheFirst(req));
    return;
  }
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(staleWhileRevalidate(req));
});
