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

export async function upsertScore(input: {
  visitId: string;
  flockId: string;
  birdNumber: number;
  definitionId: string;
  fieldType: "score" | "numeric" | "sex";
  scoreValue?: number | null;
  numericValue?: number | null;
  textValue?: string | null;
}) {
  const { supabase, userId } = await resolveContext();

  const row: Record<string, unknown> = {
    visit_id: input.visitId,
    flock_id: input.flockId,
    bird_number: input.birdNumber,
    definition_id: input.definitionId,
    scored_by: userId,
    scored_at: new Date().toISOString(),
    score: null,
    numeric_value: null,
    text_value: null,
  };

  if (input.fieldType === "score") {
    row.score = input.scoreValue ?? null;
  } else if (input.fieldType === "numeric") {
    row.numeric_value = input.numericValue ?? null;
  } else if (input.fieldType === "sex") {
    row.text_value = input.textValue ?? null;
  }

  const { data, error } = await supabase
    .from("visit_scores")
    .upsert(row, { onConflict: "visit_id,flock_id,bird_number,definition_id" })
    .select("id")
    .single();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/scoring`);
  revalidatePath(`/visits/${input.visitId}`);
  return { ok: true as const, scoreId: data.id };
}

export async function setBirdCount(visitId: string, count: number) {
  const { supabase, clientId } = await resolveContext();

  const { error } = await supabase
    .from("visits")
    .update({ bird_count: count })
    .eq("id", visitId)
    .eq("client_id", clientId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/scoring`);
  return { ok: true as const };
}

export async function updateVisitTreatment(visitId: string, patch: {
  coccidiostat?: string | null;
  other_treatment?: string | null;
}) {
  const { supabase, clientId } = await resolveContext();

  const { error } = await supabase
    .from("visits")
    .update(patch)
    .eq("id", visitId)
    .eq("client_id", clientId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/scoring`);
  revalidatePath(`/visits/${visitId}`);
  return { ok: true as const };
}

export async function deleteBird(visitId: string, birdNumber: number) {
  const { supabase, clientId } = await resolveContext();

  const { data: visit } = await supabase
    .from("visits")
    .select("id")
    .eq("id", visitId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!visit) {
    return { ok: false as const, error: "Visit not found" };
  }

  const { error } = await supabase
    .from("visit_scores")
    .delete()
    .eq("visit_id", visitId)
    .eq("bird_number", birdNumber);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/scoring`);
  return { ok: true as const };
}

// --- Photo handling ----------------------------

export async function uploadPhoto(formData: FormData) {
  const { supabase, userId } = await resolveContext();

  const visitScoreId = String(formData.get("visit_score_id") ?? "");
  const visitId = String(formData.get("visit_id") ?? "");
  const file = formData.get("file") as File | null;

  if (!visitScoreId || !visitId || !file) {
    return { ok: false as const, error: "Missing fields" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false as const, error: "File must be an image" };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false as const, error: "Image too large (max 8MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${visitId}/${visitScoreId}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from("visit-photos")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return { ok: false as const, error: uploadErr.message };
  }

  const { data: photo, error: insertErr } = await supabase
    .from("photos")
    .insert({ visit_score_id: visitScoreId, storage_path: path, uploaded_by: userId })
    .select("id, storage_path")
    .single();

  if (insertErr || !photo) {
    await supabase.storage.from("visit-photos").remove([path]);
    return { ok: false as const, error: insertErr?.message ?? "Insert failed" };
  }

  const { data: signed } = await supabase.storage
    .from("visit-photos")
    .createSignedUrl(path, 3600);

  revalidatePath(`/scoring`);
  return { ok: true as const, photo: { id: photo.id, url: signed?.signedUrl ?? "" } };
}

export async function deletePhoto(input: { photoId: string }) {
  const { supabase } = await resolveContext();

  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", input.photoId)
    .maybeSingle();

  if (!photo) {
    return { ok: false as const, error: "Photo not found" };
  }

  await supabase.storage.from("visit-photos").remove([photo.storage_path]);

  const { error } = await supabase
    .from("photos")
    .delete()
    .eq("id", input.photoId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/scoring`);
  return { ok: true as const };
}
