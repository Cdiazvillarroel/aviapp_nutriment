"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function resolveContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No client membership");
  return { supabase, clientId: membership.client_id, userId: user.id };
}

// Internal helper: applies a suggestion's value to visit_scores (insert or update)
// and updates the suggestion row with the resulting state.
async function applySuggestion(
  supabase: any,
  userId: string,
  suggestionId: string,
  finalValue: { score?: number | null; numeric?: number | null; text?: string | null },
  newStatus: "accepted" | "modified",
) {
  // 1. Load the suggestion with its definition's field_type
  const { data: sug, error: readErr } = await supabase
    .from("ai_score_suggestions")
    .select(`
      id, recording_id, visit_id, flock_id, bird_number, definition_id, status,
      suggested_score, suggested_numeric, suggested_text,
      scoring_definitions(field_type)
    `)
    .eq("id", suggestionId)
    .maybeSingle();

  if (readErr || !sug) {
    return { ok: false as const, error: readErr?.message ?? "Suggestion not found" };
  }

  // Already reviewed — idempotent no-op
  if (sug.status !== "pending") {
    return { ok: true as const, scoreId: null, alreadyReviewed: true };
  }

  // Need bird_number and flock_id to insert into visit_scores
  if (!sug.flock_id || sug.bird_number == null) {
    return {
      ok: false as const,
      error: "Missing flock_id or bird_number — cannot apply suggestion. " +
             "Edit the suggestion or reject it.",
    };
  }

  const def = Array.isArray(sug.scoring_definitions)
    ? sug.scoring_definitions[0]
    : sug.scoring_definitions;
  if (!def?.field_type) {
    return { ok: false as const, error: "Definition field_type unknown" };
  }

  // 2. Upsert visit_scores row with source='voice_ai'
  const scoreRow: Record<string, unknown> = {
    visit_id: sug.visit_id,
    flock_id: sug.flock_id,
    bird_number: sug.bird_number,
    definition_id: sug.definition_id,
    scored_by: userId,
    scored_at: new Date().toISOString(),
    score: null,
    numeric_value: null,
    text_value: null,
    source: "voice_ai",
    source_recording_id: sug.recording_id,
    source_suggestion_id: sug.id,
  };

  if (def.field_type === "score") {
    scoreRow.score = finalValue.score ?? null;
  } else if (def.field_type === "numeric") {
    scoreRow.numeric_value = finalValue.numeric ?? null;
  } else if (def.field_type === "sex") {
    scoreRow.text_value = finalValue.text ?? null;
  }

  const { data: inserted, error: scoreErr } = await supabase
    .from("visit_scores")
    .upsert(scoreRow, { onConflict: "visit_id,flock_id,bird_number,definition_id" })
    .select("id")
    .single();

  if (scoreErr || !inserted) {
    return { ok: false as const, error: scoreErr?.message ?? "Score upsert failed" };
  }

  // 3. Update the suggestion row with review state + final values + resulting score
  const { error: updErr } = await supabase
    .from("ai_score_suggestions")
    .update({
      status: newStatus,
      resulting_score_id: inserted.id,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      final_score: finalValue.score ?? null,
      final_numeric: finalValue.numeric ?? null,
      final_text: finalValue.text ?? null,
    })
    .eq("id", suggestionId);

  if (updErr) {
    // visit_scores was already updated; this is a partial failure.
    // We log but return success because the score is in place.
    console.error("Failed to update suggestion status:", updErr);
  }

  revalidatePath(`/visits/${sug.visit_id}`);
  revalidatePath(`/scoring`);
  return { ok: true as const, scoreId: inserted.id };
}

// Accept a suggestion exactly as the AI proposed it
export async function acceptSuggestion(suggestionId: string) {
  const { supabase, userId } = await resolveContext();

  const { data: sug } = await supabase
    .from("ai_score_suggestions")
    .select("suggested_score, suggested_numeric, suggested_text")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!sug) {
    return { ok: false as const, error: "Suggestion not found" };
  }

  return applySuggestion(
    supabase,
    userId,
    suggestionId,
    {
      score: sug.suggested_score,
      numeric: sug.suggested_numeric,
      text: sug.suggested_text,
    },
    "accepted",
  );
}

// Accept a suggestion with a modified value (vet edited it)
export async function modifySuggestion(
  suggestionId: string,
  newValue: { score?: number | null; numeric?: number | null; text?: string | null },
) {
  const { supabase, userId } = await resolveContext();
  return applySuggestion(supabase, userId, suggestionId, newValue, "modified");
}

// Reject a suggestion (no visit_scores change)
export async function rejectSuggestion(suggestionId: string) {
  const { supabase, userId } = await resolveContext();

  const { data: sug } = await supabase
    .from("ai_score_suggestions")
    .select("id, visit_id, status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!sug) {
    return { ok: false as const, error: "Suggestion not found" };
  }
  if (sug.status !== "pending") {
    return { ok: true as const, alreadyReviewed: true };
  }

  const { error } = await supabase
    .from("ai_score_suggestions")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/visits/${sug.visit_id}`);
  return { ok: true as const };
}

// Bulk accept all "clean" suggestions for a recording (no conflicts)
// Returns counts for the toast/feedback.
export async function acceptAllClean(recordingId: string) {
  const { supabase, userId } = await resolveContext();

  // Load all pending suggestions WITHOUT conflicts for this recording
  const { data: suggestions, error: readErr } = await supabase
    .from("ai_score_suggestions")
    .select("id, visit_id")
    .eq("recording_id", recordingId)
    .eq("status", "pending")
    .is("conflicts_with_score_id", null);

  if (readErr) {
    return { ok: false as const, error: readErr.message };
  }
  if (!suggestions || suggestions.length === 0) {
    return { ok: true as const, accepted: 0, failed: 0 };
  }

  let accepted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const s of suggestions) {
    const result = await acceptSuggestion(s.id);
    if (result.ok) {
      accepted++;
    } else {
      failed++;
      errors.push(result.error);
    }
  }

  return { ok: true as const, accepted, failed, errors };
}

// Bulk confirm matches: when AI value === manual value, mark as accepted
// (no change to visit_scores, just records that the vet acknowledged the match)
export async function confirmMatch(suggestionId: string) {
  const { supabase, userId } = await resolveContext();

  const { data: sug } = await supabase
    .from("ai_score_suggestions")
    .select("id, visit_id, status, conflicts_with_score_id")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!sug) {
    return { ok: false as const, error: "Suggestion not found" };
  }
  if (sug.status !== "pending") {
    return { ok: true as const, alreadyReviewed: true };
  }

  const { error } = await supabase
    .from("ai_score_suggestions")
    .update({
      status: "accepted",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      resulting_score_id: sug.conflicts_with_score_id,
    })
    .eq("id", suggestionId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/visits/${sug.visit_id}`);
  return { ok: true as const };
}
