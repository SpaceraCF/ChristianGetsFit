// Minimal service worker for offline capability of workout screen
const CACHE = "cgf-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/dashboard", "/dashboard/workout"])));
  self.skipWaiting();
});
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/dashboard")))
  );
});
