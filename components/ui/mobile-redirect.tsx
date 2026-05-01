"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client-side mobile detection.
 * Why: iPadOS 13+ reports user agent as Macintosh, so server-side detection
 * cannot distinguish iPad from Mac. We use touch capability + viewport width
 * to detect actual mobile devices.
 *
 * Skip redirect if:
 *  - URL has ?desktop=1 (escape hatch)
 *  - Already on a mobile route
 *  - Viewport is wide AND touch is unavailable (regular desktop)
 */
export function MobileRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Escape hatch: explicit desktop request
    if (searchParams.get("desktop") === "1") return;

    // Detect mobile/tablet
    const isTouch = navigator.maxTouchPoints > 1;
    const isNarrow = window.innerWidth < 1024;

    // iPad has touch but can be wide in landscape (1180px). Use both signals:
    // - If touch AND (narrow OR specific iPad/iPhone in user agent), redirect
    const ua = navigator.userAgent;
    const isAppleTouch = /iPad|iPhone|iPod/i.test(ua);
    // iPad on iOS 13+ reports as Mac. Detect via Mac + touch.
    const isMacWithTouch = /Macintosh/i.test(ua) && isTouch;

    if (isAppleTouch || isMacWithTouch || (isTouch && isNarrow)) {
      router.replace("/scoring/mobile");
    }
  }, [router, searchParams]);

  return null;
}
