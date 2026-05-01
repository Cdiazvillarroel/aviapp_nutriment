"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker for offline support.
 * Mounted globally in the app (mobile) layout.
 *
 * Skip in dev mode to avoid stale caches during development.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Skip in development — Next.js HMR conflicts with SW caching
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        // Optional: log only in dev tools, not user-facing
        if (registration.installing) {
          console.log("[SW] Installing");
        } else if (registration.waiting) {
          console.log("[SW] Waiting");
        } else if (registration.active) {
          console.log("[SW] Active");
        }
      } catch (err) {
        console.warn("[SW] Registration failed:", err);
      }
    };

    register();
  }, []);

  return null;
}
