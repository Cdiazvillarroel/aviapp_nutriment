"use server";

import { createClient } from "@/lib/supabase/server";
import { requestAIScore, type AIScoreSuggestion } from "@/lib/ai-vision";

export interface AIAssistResult {
  ok: true;
  suggestion: AIScoreSuggestion;
}

export interface AIAssistError {
  ok: false;
  error: string;
}

interface RequestPayload {
  visitId: string;
  definitionId: string;
  flockId: string;
  birdNumber: number;
  feedback?: string;
  previousScore?: number;
}

export async function requestAIAssist(payload: RequestPayload): Promise<AIAssistResult | AIAssistError> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: membership } = await supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!membership) return { ok: false, error: "No client membership" };

    // Look up the score row + definition
    const { data: scoreRow, error: scoreErr } = await supabase
      .from("visit_scores")
      .select(`
        id, score,
        scoring_definitions(name, module, scale_max, field_type)
      `)
      .eq("visit_id", payload.visitId)
      .eq("definition_id", payload.definitionId)
      .eq("flock_id", payload.flockId)
      .eq("bird_number", payload.birdNumber)
      .maybeSingle();

    if (scoreErr) return { ok: false, error: scoreErr.message };
    if (!scoreRow) return { ok: false, error: "Score row not found. Please save the row first by entering a score." };

    // Get the most recent photo for this score from the photos table
    const { data: photoRows, error: photoErr } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("visit_score_id", scoreRow.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (photoErr) return { ok: false, error: "Could not load photos: " + photoErr.message };
    if (!photoRows || photoRows.length === 0) {
      return { ok: false, error: "No photo uploaded for this item. Please upload a photo first." };
    }

    const photoPath = photoRows[0].storage_path;

    // Get a signed URL for the photo
    const { data: signed, error: signErr } = await supabase
      .storage
      .from("visit-photos")
      .createSignedUrl(photoPath, 60 * 5);

    if (signErr || !signed?.signedUrl) {
      return { ok: false, error: "Could not generate photo URL: " + (signErr?.message ?? "unknown") };
    }

    const def = Array.isArray(scoreRow.scoring_definitions)
      ? scoreRow.scoring_definitions[0]
      : scoreRow.scoring_definitions;
    if (!def) return { ok: false, error: "Scoring definition not found" };

    const fieldType = (def.field_type ?? "score") as "score" | "numeric" | "sex";
    const scaleMax = def.scale_max ?? 5;
    // Bursa Meter starts at 1, everything else at 0
    const scaleMin = def.name === "Bursa Meter" ? 1 : 0;

    const suggestion = await requestAIScore({
      imageUrl: signed.signedUrl,
      itemName: def.name,
      module: def.module ?? "Other",
      scaleMin: scaleMin,
      scaleMax: scaleMax,
      fieldType: fieldType,
      feedback: payload.feedback,
      previousScore: payload.previousScore,
    });

    // Log the AI call for cost tracking and audit
    await supabase.from("ai_assist_calls").insert({
      client_id: membership.client_id,
      user_id: user.id,
      visit_id: payload.visitId,
      score_id: scoreRow.id,
      definition_id: payload.definitionId,
      bird_number: payload.birdNumber,
      suggested_score: suggestion.score,
      confidence: suggestion.confidence,
      feedback_provided: payload.feedback ?? null,
    });

    return { ok: true, suggestion };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function acceptAISuggestion(payload: {
  visitId: string;
  definitionId: string;
  flockId: string;
  birdNumber: number;
  score: number;
  scoreText?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: def } = await supabase
      .from("scoring_definitions")
      .select("field_type")
      .eq("id", payload.definitionId)
      .maybeSingle();

    const fieldType = def?.field_type ?? "score";

    const update: Record<string, unknown> = {
      ai_assisted: true,
      updated_at: new Date().toISOString(),
    };
    if (fieldType === "score") {
      update.score = payload.score;
    } else if (fieldType === "numeric") {
      update.numeric_value = payload.score;
    } else if (fieldType === "sex") {
      update.text_value = payload.scoreText ?? (payload.score === 1 ? "M" : "F");
    }

    const { error } = await supabase
      .from("visit_scores")
      .update(update)
      .eq("visit_id", payload.visitId)
      .eq("definition_id", payload.definitionId)
      .eq("flock_id", payload.flockId)
      .eq("bird_number", payload.birdNumber);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
