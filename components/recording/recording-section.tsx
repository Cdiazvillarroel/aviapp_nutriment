"use client";

// components/recording/recording-section.tsx
//
// Container component that wires together:
//  - useFarmerConsent (server-side consent state)
//  - ConsentModal (UI to obtain consent the first time)
//  - RecordingControls (the actual record/pause/stop UI)
//
// This is the single component the host page (mobile-scoring-client) renders.
// All consent-vs-recording orchestration lives here.

import { useEffect, useState } from "react";
import { useFarmerConsent } from "@/lib/audio/use-farmer-consent";
import { RecordingControls } from "./recording-controls";
import { ConsentModal } from "./consent-modal";

interface Props {
  visitId: string;
  farmId: string;
  isOnline: boolean;
}

export function RecordingSection({ visitId, farmId, isOnline }: Props) {
  // Defensive: if no farmId is known (e.g. we're in the offline fallback mode
  // where the server query never ran), don't render anything. Recording isn't
  // possible without knowing which farm we're on.
  if (!farmId) return null;

  const consent = useFarmerConsent({ farmId, isOnline });
  const [modalOpen, setModalOpen] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  // Sticky flag: once we know consent is granted, never re-evaluate to avoid
  // unmounting RecordingControls mid-recording if the consent check re-runs.
  const [stickyHasConsent, setStickyHasConsent] = useState(false);
  useEffect(() => {
    if (consent.state === "has_consent") setStickyHasConsent(true);
  }, [consent.state]);

  // ============= LOADING (initial check) =============
  if (consent.state === "loading" && !stickyHasConsent) {
    return (
      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
        Checking consent…
      </span>
    );
  }

  // ============= OFFLINE: can't verify consent =============
  // If we already verified consent earlier in this session (sticky), still let
  // the user record. Otherwise show a disabled hint.
  if (consent.state === "offline" && !stickyHasConsent) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px]"
        style={{ color: "var(--text-3)" }}
        title="Recording requires internet to verify farmer consent"
      >
        <span aria-hidden>🎙️</span>
        <span>Online required</span>
      </span>
    );
  }

  // ============= ERROR =============
  if (consent.state === "error" && !stickyHasConsent) {
    return (
      <span
        className="text-[11px]"
        style={{ color: "var(--bad)" }}
        title={consent.errorMessage ?? ""}
      >
        Consent check failed
      </span>
    );
  }

  // ============= NO CONSENT YET =============
  if (consent.state === "no_consent" && !stickyHasConsent) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-1)",
            border: "1px solid var(--border)",
          }}
        >
          <span aria-hidden>🎙️</span>
          <span>Record session</span>
        </button>
        <ConsentModal
          open={modalOpen}
          loading={savingConsent}
          errorMessage={consent.errorMessage}
          onCancel={() => setModalOpen(false)}
          onConfirm={async () => {
            setSavingConsent(true);
            const ok = await consent.confirmConsent();
            setSavingConsent(false);
            if (ok) {
              setStickyHasConsent(true);
              setModalOpen(false);
              // Don't auto-start the recorder — vet decides when to begin
            }
          }}
        />
      </>
    );
  }

  // ============= HAS CONSENT (or stickyHasConsent from earlier) =============
  return <RecordingControls visitId={visitId} compact />;
}
