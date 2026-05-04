// lib/audio/use-farmer-consent.ts
//
// Hook that manages the recording consent state for a farm.
//
// Consent is stored server-side (in public.farms.recording_consent_*) and
// must be obtained ONLINE — we never let the user "queue" a consent for later
// sync because that would create accountability gaps.
//
// Once consent is granted on a farm, all future visits to that farm can
// record (online or offline) until consent is explicitly revoked.

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getFarmRecordingConsent,
  recordFarmerRecordingConsent,
} from "@/app/(app)/scoring/recording-actions";

export type ConsentState =
  | "loading"        // initial check in progress
  | "has_consent"    // farm already has valid consent
  | "no_consent"     // online and confirmed there's no consent
  | "offline"        // can't verify (no internet); hide recording UI
  | "error";         // server error during check

export interface UseFarmerConsentReturn {
  state: ConsentState;
  errorMessage: string | null;
  /** Calls server to record consent. Returns true on success. */
  confirmConsent: () => Promise<boolean>;
  /** Force a re-check (e.g. after manually granting in another tab). */
  refresh: () => void;
}

export function useFarmerConsent(input: {
  farmId: string | null;
  isOnline: boolean;
}): UseFarmerConsentReturn {
  const { farmId, isOnline } = input;
  const [state, setState] = useState<ConsentState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!farmId) {
        setState("error");
        setErrorMessage("No farm ID provided");
        return;
      }
      if (!isOnline) {
        setState("offline");
        return;
      }

      setState("loading");
      setErrorMessage(null);

      const result = await getFarmRecordingConsent({ farmId });
      if (cancelled) return;

      if (!result.ok) {
        setState("error");
        setErrorMessage(result.error);
        return;
      }

      setState(result.hasConsent ? "has_consent" : "no_consent");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [farmId, isOnline, reloadKey]);

  const confirmConsent = useCallback(async (): Promise<boolean> => {
    if (!farmId) {
      setErrorMessage("No farm ID");
      return false;
    }
    if (!isOnline) {
      setErrorMessage("Internet required to record consent");
      return false;
    }

    setState("loading");
    const result = await recordFarmerRecordingConsent({ farmId });
    if (!result.ok) {
      setState("error");
      setErrorMessage(result.error);
      return false;
    }
    setState("has_consent");
    setErrorMessage(null);
    return true;
  }, [farmId, isOnline]);

  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { state, errorMessage, confirmConsent, refresh };
}
