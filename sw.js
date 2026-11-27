const CACHE_NAME = "sig-salvacao-v1.3.4";
const ASSETS_CORE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/state.js",
  "./js/geometry.js",
  "./js/health-mock.js",
  "./js/numbering.js",
  "./js/spacing.js",
  "./js/storage.js",
  "./js/map-view.js",
  "./js/editor.js",
  "./js/main.js",
  "./manifest.json",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_CORE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first para garantir dados e código atualizados quando online,
// com fallback em cache quando a internet da UBS oscilar.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
