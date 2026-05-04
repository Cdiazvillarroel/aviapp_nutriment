// app/(app)/scoring/recording-actions.ts
//
// Server actions for recording-related concerns that must hit Supabase server-side:
//  - Read recording consent state for a farm
//  - Record farmer consent (writes to public.farms)
//  - List recordings for a visit (with signed URLs for playback)
//
// All functions are RLS-protected: only members of the client that owns the
// resource can read/write, by virtue of existing RLS on the underlying tables.

"use server";

import { createClient } from "@/lib/supabase/server";

// =====================================================================
// CONSENT
// =====================================================================

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

// =====================================================================
// LIST RECORDINGS (for desktop visit detail view)
// =====================================================================

export interface ListedRecording {
  id: string;
  storagePath: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  mimeType: string;
  recordedAt: string;
  recordedBy: string | null;
  audioDeletedAt: string | null;
  expiresAt: string;
  /** Signed URL for the audio file. null if audio has been deleted (>30 days). */
  signedUrl: string | null;
  /** Transcript text, populated in Phase 2. */
  transcript: string | null;
  transcriptProcessedAt: string | null;
  hasAiSummary: boolean;
}

export type ListRecordingsResult =
  | { ok: true; recordings: ListedRecording[] }
  | { ok: false; error: string };

/**
 * List all recordings for a given visit, with signed URLs for playback.
 * Sorted by recorded_at descending (newest first).
 *
 * Audio files have a 1-hour signed URL — re-fetch this list if the page is
 * left open longer than that.
 */
export async function listVisitRecordings(input: {
  visitId: string;
}): Promise<ListRecordingsResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_recordings")
    .select(
      `id, storage_path, duration_seconds, file_size_bytes, mime_type,
       recorded_at, recorded_by, audio_deleted_at, expires_at,
       transcript, transcript_processed_at, ai_summary`
    )
    .eq("visit_id", input.visitId)
    .order("recorded_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  // For each recording with audio still available, generate a signed URL.
  // Recordings where audio_deleted_at is set will have signedUrl = null.
  const recordings: ListedRecording[] = await Promise.all(
    (data ?? []).map(async (r) => {
      let signedUrl: string | null = null;
      if (!r.audio_deleted_at && r.storage_path) {
        const { data: signed, error: signError } = await supabase.storage
          .from("visit-recordings")
          .createSignedUrl(r.storage_path, 3600);
        if (signError) {
          console.warn(
            `[recordings] Could not sign URL for ${r.storage_path}:`,
            signError
          );
        }
        signedUrl = signed?.signedUrl ?? null;
      }

      return {
        id: r.id,
        storagePath: r.storage_path,
        durationSeconds: r.duration_seconds,
        fileSizeBytes: r.file_size_bytes,
        mimeType: r.mime_type,
        recordedAt: r.recorded_at,
        recordedBy: r.recorded_by,
        audioDeletedAt: r.audio_deleted_at,
        expiresAt: r.expires_at,
        signedUrl,
        transcript: r.transcript,
        transcriptProcessedAt: r.transcript_processed_at,
        hasAiSummary: !!r.ai_summary,
      };
    })
  );

  return { ok: true, recordings };
}
