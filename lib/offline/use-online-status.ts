// lib/offline/use-online-status.ts
//
// React hook to track online/offline state.
// Uses navigator.onLine and online/offline events.

"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  // Default true on server-side rendering (most users will be online)
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial state from browser
    setIsOnline(navigator.onLine);

    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to track pending mutations count.
 * Polls every 2s when online, every 5s when offline.
 * Updates immediately if a mutation is added/removed via custom event.
 */
import { getPendingMutationsCount } from "./repository";

const PENDING_CHANGE_EVENT = "nutriflock:pending_changed";

export function emitPendingChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PENDING_CHANGE_EVENT));
}

export function usePendingMutations(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const n = await getPendingMutationsCount();
        if (mounted) setCount(n);
      } catch {
        // IndexedDB might fail in private mode — don't crash UI
      }
    }

    // Initial load
    refresh();

    // Poll periodically as safety net
    const interval = setInterval(refresh, 5000);

    // Refresh on custom event
    function handleChange() { refresh(); }
    window.addEventListener(PENDING_CHANGE_EVENT, handleChange);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener(PENDING_CHANGE_EVENT, handleChange);
    };
  }, []);

  return count;
}
