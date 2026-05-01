// Nutriflock Service Worker
// v3: Same strategy as v1 but with 2s network timeout for instant offline fallback.
// Without this timeout, iPad Safari in airplane mode hangs for minutes before
// the browser cancels the request — now the SW falls back to cache after 2s.

const CACHE_VERSION = "v3";
const CACHE_NAME = `nutriflock-${CACHE_VERSION}`;
const NETWORK_TIMEOUT_MS = 2000;

// App shell — cached aggressively
const STATIC_ASSETS = [
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
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache ${url}:`, err);
          })
        )
      );
    })
  );
  // Activate immediately on first install
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith("nutriflock-") && name !== CACHE_NAME)
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Navigation (HTML): network first with 2s timeout, cache fallback
// - Static assets (JS/CSS/images): cache first with background revalidation
// - API calls (Supabase, Anthropic): pass through (network only, no caching)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET (writes go through normally — offline writes handled by IndexedDB queue)
  if (request.method !== "GET") return;

  // Skip cross-origin (Supabase, Anthropic API, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip Next.js internal data routes that should always be fresh
  if (url.pathname.startsWith("/_next/data/")) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML pages): network first with 2s timeout
  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Static assets: cache first with background revalidation
  event.respondWith(cacheFirstStrategy(request));
});

// Navigation strategy: try network for 2s, fallback to cache instantly on timeout/error
async function navigationStrategy(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  try {
    const response = await fetch(request, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Cache successful navigations for offline use
    if (response.ok) {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseClone).catch(() => {});
      });
    }

    return response;
  } catch (err) {
    clearTimeout(timeoutId);

    // Network failed or timed out — try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log(`[SW] Network unavailable (${err.name}), serving from cache: ${request.url}`);
      return cached;
    }

    // Last resort: cached scoring/mobile as generic fallback
    const fallback = await caches.match("/scoring/mobile");
    if (fallback) return fallback;

    // Nothing cached at all
    return new Response(
      "<!DOCTYPE html><html><body style=\"font-family:sans-serif;padding:2rem;text-align:center\"><h2>Offline</h2><p>This page isn't cached for offline use. Connect to WiFi and try again.</p></body></html>",
      {
        status: 503,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}

// Cache-first strategy with background revalidation: instant response from cache,
// silently update cache in background for next time.
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);

  if (cached) {
    // Background revalidation — don't block the response
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response).catch(() => {});
          });
        }
      })
      .catch(() => {
        /* offline — that's fine, we already returned cache */
      });

    return cached;
  }

  // Not in cache: fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseClone).catch(() => {});
      });
    }
    return response;
  } catch (err) {
    return new Response("Asset unavailable offline", { status: 503 });
  }
}
