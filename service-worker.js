
const CACHE = "bahnpreis-tracker-v5-calendar";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.json","./icon.svg"];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
