const CACHE_NAME = "archiwiki-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/src/main.jsx",
  "/src/App.jsx",
  "/src/index.css"
];

// Cache core assets on activation
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Cache-first runtime asset loading
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
