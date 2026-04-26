"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function resolveClientId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/visits?error=no-client");
  return { supabase, clientId: membership.client_id, userId: user.id };
}

export async function createVisit(formData: FormData) {
  const { supabase, clientId, userId } = await resolveClientId();

  const farm_id = String(formData.get("farm_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "09:00");
  const type = String(formData.get("type") ?? "routine");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const flockIds = formData.getAll("flock_ids").map(String).filter(Boolean);

  if (!farm_id) {
    redirect("/visits/new?error=farm-required");
  }
  if (!date) {
    redirect(`/visits/new?farm=${farm_id}&error=date-required`);
  }

  const scheduled_at = new Date(`${date}T${time}:00`).toISOString();

  const { data: visit, error: visitErr } = await supabase
    .from("visits")
    .insert({
      client_id: clientId,
      farm_id,
      scheduled_at,
      type,
      status: "planned",
      technician_id: userId,
      notes,
    })
    .select("id")
    .single();

  if (visitErr || !visit) {
    redirect(`/visits/new?farm=${farm_id}&error=${encodeURIComponent(visitErr?.message ?? "unknown")}`);
  }

  if (flockIds.length > 0) {
    const rows = flockIds.map(fid => ({ visit_id: visit.id, flock_id: fid }));
    await supabase.from("visit_flocks").insert(rows);
  }

  revalidatePath("/visits");
  revalidatePath("/dashboard");
  revalidatePath(`/farms/${farm_id}`);
  redirect(`/visits/${visit.id}`);
}

export async function updateVisitStatus(visitId: string, status: string) {
  const { supabase, clientId } = await resolveClientId();

  const patch: Record<string, unknown> = { status };
  if (status === "completed") {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("visits")
    .update(patch)
    .eq("id", visitId)
    .eq("client_id", clientId);

  if (error) {
    redirect(`/visits/${visitId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/visits");
  revalidatePath("/dashboard");

  export async function updateVisit(formData: FormData) {
  const { supabase, clientId } = await resolveClientId();

  const visitId = String(formData.get("visit_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "09:00");
  const type = String(formData.get("type") ?? "routine");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const flockIds = formData.getAll("flock_ids").map(String).filter(Boolean);

  if (!visitId) redirect("/visits");

  const scheduled_at = new Date(`${date}T${time}:00`).toISOString();

  const { error: updateErr } = await supabase
    .from("visits")
    .update({
      scheduled_at,
      type,
      notes,
    })
    .eq("id", visitId)
    .eq("client_id", clientId);

  if (updateErr) {
    redirect(`/visits/${visitId}/edit?error=${encodeURIComponent(updateErr.message)}`);
  }

  // Sync visit_flocks: delete all and re-insert (simple, idempotent).
  await supabase.from("visit_flocks").delete().eq("visit_id", visitId);

  if (flockIds.length > 0) {
    const rows = flockIds.map(fid => ({ visit_id: visitId, flock_id: fid }));
    await supabase.from("visit_flocks").insert(rows);
  }

  revalidatePath("/visits");
  revalidatePath("/dashboard");
  revalidatePath(`/visits/${visitId}`);
  redirect(`/visits/${visitId}`);
}

