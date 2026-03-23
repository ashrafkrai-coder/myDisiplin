const APP_VERSION = "v27";
const STATIC_CACHE = `mydisiplin-static-${APP_VERSION}`;
const RUNTIME_CACHE = `mydisiplin-runtime-${APP_VERSION}`;
const STATIC_ASSETS = [
  "/",
  "/login.html",
  "/index.html",
  "/rekod-kes-baru.html",
  "/senarai-kes.html",
  "/dashbord.html",
  "/kehadiran.html",
  "/jurnal.html",
  "/kongsi.html",
  "/manifest.webmanifest",
  "/browserconfig.xml",
  "/offline.html",
  "/assets/theme.css",
  "/assets/auth.js",
  "/icons/icon180.png",
  "/icons/icon32.png",
  "/icons/icon192.png",
  "/icons/icon512.png",
  "/screenshots/home-portrait.png",
  "/screenshots/home-landscape.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}
