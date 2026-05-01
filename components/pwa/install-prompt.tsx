"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "nutriflock-a2hs-dismissed";
const DISMISS_DAYS = 14; // re-prompt after 2 weeks

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already in standalone (installed) mode
    const isStandalone =
      ("standalone" in window.navigator && (window.navigator as any).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return; // Already installed, don't show

    // Check if user dismissed recently
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const dismissedDate = new Date(dismissed);
        const daysAgo = (Date.now() - dismissedDate.getTime()) / 86_400_000;
        if (daysAgo < DISMISS_DAYS) return;
      }
    } catch {/* localStorage may fail in private mode */}

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIOS && isSafari) {
      // Slight delay so it's not in user's face immediately
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {/* private mode */}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-40 rounded-lg border p-4 shadow-lg"
      style={{
        background: "var(--surface)",
        borderColor: "var(--green-700)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: "var(--green-50)" }}
        >
          <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-medium leading-tight"
            style={{ color: "var(--text-1)" }}
          >
            Install Nutriflock on your home screen
          </div>
          <div
            className="mt-1 text-[12px] leading-snug"
            style={{ color: "var(--text-2)" }}
          >
            Tap the share button{" "}
            <span style={{ fontSize: "14px" }}>⎙</span>
            {" "}then{" "}
            <strong>Add to Home Screen</strong>
            . You'll get faster access and offline support in the field.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex-shrink-0 text-[18px] leading-none"
          style={{ color: "var(--text-3)" }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
