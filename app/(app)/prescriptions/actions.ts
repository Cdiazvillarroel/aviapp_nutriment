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
    .select("client_id, role, display_name")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/reports?error=no-client");
  return { supabase, clientId: membership.client_id, userId: user.id, role: membership.role, displayName: membership.display_name };
}

function readForm(formData: FormData) {
  const flock_id = String(formData.get("flock_id") ?? "");
  const drug_name = String(formData.get("drug_name") ?? "").trim();
  const active_ingredient = String(formData.get("active_ingredient") ?? "").trim() || null;
  const dose = String(formData.get("dose") ?? "").trim() || null;
  const administration = String(formData.get("administration") ?? "") || null;
  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "");
  const withdrawal_days = parseInt(String(formData.get("withdrawal_days") ?? "0"), 10) || 0;
  const indication = String(formData.get("indication") ?? "").trim() || null;
  const vet_name_override = String(formData.get("vet_name_override") ?? "").trim() || null;
  const vet_license = String(formData.get("vet_license") ?? "").trim() || null;

  return {
    flock_id, drug_name, active_ingredient, dose, administration,
    start_date, end_date, withdrawal_days, indication,
    vet_name_override, vet_license,
  };
}

export async function createPrescription(formData: FormData) {
  const { supabase, clientId, userId, role } = await resolveContext();
  const fields = readForm(formData);

  if (!fields.flock_id) {
    redirect("/prescriptions/new?error=flock-required");
  }
  if (!fields.drug_name) {
    redirect(`/prescriptions/new?error=drug-required&flock=${fields.flock_id}`);
  }
  if (!fields.start_date) {
    redirect(`/prescriptions/new?error=start-date-required&flock=${fields.flock_id}`);
  }
  if (!fields.end_date) {
    redirect(`/prescriptions/new?error=end-date-required&flock=${fields.flock_id}`);
  }
  if (!fields.indication) {
    redirect(`/prescriptions/new?error=indication-required&flock=${fields.flock_id}`);
  }

  const vet_id = role === "vet" ? userId : null;

  const { data: prescription, error } = await supabase
    .from("prescriptions")
    .insert({
      client_id: clientId,
      flock_id: fields.flock_id,
      vet_id,
      drug_name: fields.drug_name,
      active_ingredient: fields.active_ingredient,
      dose: fields.dose,
      administration: fields.administration,
      start_date: fields.start_date,
      end_date: fields.end_date,
      withdrawal_days: fields.withdrawal_days,
      indication: fields.indication,
      reason: fields.indication,
      vet_name_override: fields.vet_name_override,
      vet_license: fields.vet_license,
    })
    .select("id")
    .single();

  if (error || !prescription) {
    redirect(`/prescriptions/new?error=${encodeURIComponent(error?.message ?? "unknown")}&flock=${fields.flock_id}`);
  }

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/reports");
}

export async function updatePrescription(formData: FormData) {
  const { supabase, clientId, userId, role } = await resolveContext();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/reports");

  const fields = readForm(formData);

  if (!fields.drug_name || !fields.start_date || !fields.end_date || !fields.indication) {
    redirect(`/prescriptions/${id}/edit?error=missing-required`);
  }

  const vet_id = role === "vet" ? userId : null;

  const { error } = await supabase
    .from("prescriptions")
    .update({
      flock_id: fields.flock_id,
      vet_id,
      drug_name: fields.drug_name,
      active_ingredient: fields.active_ingredient,
      dose: fields.dose,
      administration: fields.administration,
      start_date: fields.start_date,
      end_date: fields.end_date,
      withdrawal_days: fields.withdrawal_days,
      indication: fields.indication,
      reason: fields.indication,
      vet_name_override: fields.vet_name_override,
      vet_license: fields.vet_license,
    })
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) {
    redirect(`/prescriptions/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/reports");
  redirect("/reports");
}

export async function deletePrescription(id: string) {
  const { supabase, clientId } = await resolveContext();

  const { error } = await supabase
    .from("prescriptions")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/reports");
  return { ok: true as const };
}
