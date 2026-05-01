// Nutriflock Service Worker
// Sesión 3: cache shell + offline fallback
// Sesión 4 agregará: IndexedDB sync queue para writes offline

const CACHE_VERSION = "v1";
const CACHE_NAME = `nutriflock-${CACHE_VERSION}`;

// Assets that should always be cached (the app shell)
const STATIC_ASSETS = [
  "/",
  "/scoring/mobile",
  "/login",
  "/manifest.json",
  "/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Install: cache the shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache assets one by one — if one fails, others still cache
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => {
          console.warn(`[SW] Failed to cache ${url}:`, err);
        }))
      );
    })
  );
  // Activate immediately on first install
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("nutriflock-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For navigation requests (HTML pages): network first, cache fallback
// - For static assets (JS/CSS/images): cache first, network fallback
// - For API calls (Supabase, etc): network only (no caching)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (writes go through normally — sesión 4 handles offline writes)
  if (request.method !== "GET") return;

  // Skip cross-origin requests (Supabase, Anthropic API, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip Next.js internal routes that should always be fresh
  if (url.pathname.startsWith("/_next/data/")) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML): network first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Last resort: cached scoring/mobile as fallback
            return caches.match("/scoring/mobile") || new Response("Offline", { status: 503 });
          });
        })
    );
    return;
  }

  // Static assets: cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Background revalidation: update cache for next time (don't wait)
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
            }
          })
          .catch(() => {/* offline, that's ok */});
        return cached;
      }
      // Not in cache: fetch and cache
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return new Response("Offline", { status: 503 });
        });
    })
  );
});
