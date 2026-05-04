// app/(app)/scoring/recording-actions.ts
//
// Server actions for recording-related concerns that must hit Supabase server-side:
//  - Read recording consent state for a farm
//  - Record farmer consent (writes to public.farms)
//
// Both functions are RLS-protected: only members of the client that owns the
// farm can read/write these fields, by virtue of the existing RLS on `farms`.

"use server";

import { createClient } from "@/lib/supabase/server";

export type ConsentReadResult =
  | { ok: true; hasConsent: boolean; givenAt: string | null }
  | { ok: false; error: string };

export type ConsentWriteResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Returns whether a farm has valid (not revoked) recording consent.
 */
export async function getFarmRecordingConsent(input: {
  farmId: string;
}): Promise<ConsentReadResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("farms")
    .select("recording_consent_given_at, recording_consent_revoked_at")
    .eq("id", input.farmId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Farm not found or access denied" };
  }

  const hasConsent =
    !!data.recording_consent_given_at &&
    !data.recording_consent_revoked_at;

  return {
    ok: true,
    hasConsent,
    givenAt: data.recording_consent_given_at,
  };
}

/**
 * Record that the farmer has consented to audio recording for this farm.
 * Called by the vet from the iPad when they've verbally obtained consent.
 *
 * If consent was previously revoked, this re-grants it (clears revoked_at).
 */
export async function recordFarmerRecordingConsent(input: {
  farmId: string;
}): Promise<ConsentWriteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("farms")
    .update({
      recording_consent_given_at: new Date().toISOString(),
      recording_consent_given_by: user.id,
      recording_consent_revoked_at: null,
    })
    .eq("id", input.farmId);

  if (error) {
    console.error("[consent] Failed to record consent:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
