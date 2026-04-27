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

  if (!membership) redirect("/flocks?error=no-client");
  return { supabase, clientId: membership.client_id, userId: user.id };
}

export async function placeFlock(formData: FormData) {
  const { supabase } = await resolveContext();

  const houseId = String(formData.get("house_id") ?? "");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const breedId = String(formData.get("breed_id") ?? "") || null;
  const placementDate = String(formData.get("placement_date") ?? "");
  const expectedClearout = String(formData.get("expected_clearout") ?? "") || null;
  const initialCount = String(formData.get("initial_count") ?? "");
  const farmId = String(formData.get("farm_id") ?? "");

  if (!houseId) {
    redirect(`/flocks/new?error=house-required`);
  }
  if (!placementDate) {
    redirect(`/flocks/new?error=date-required&house=${houseId}`);
  }

  const { data: activeInHouse } = await supabase
    .from("flocks")
    .select("id, reference")
    .eq("house_id", houseId)
    .eq("active", true)
    .maybeSingle();

  if (activeInHouse) {
    redirect(
      `/flocks/new?error=${encodeURIComponent(
        `House already has active flock ${activeInHouse.reference ?? ""}. Clear it first.`
      )}&house=${houseId}`
    );
  }

  const { error } = await supabase
    .from("flocks")
    .insert({
      house_id: houseId,
      reference,
      breed_id: breedId,
      placement_date: placementDate,
      expected_clearout: expectedClearout || null,
      initial_count: initialCount ? parseInt(initialCount, 10) || null : null,
      active: true,
    });

  if (error) {
    redirect(`/flocks/new?error=${encodeURIComponent(error.message)}&house=${houseId}`);
  }

  revalidatePath("/flocks");
  revalidatePath("/dashboard");
  if (farmId) revalidatePath(`/farms/${farmId}`);

  if (farmId) {
    redirect(`/farms/${farmId}`);
  } else {
    redirect(`/flocks`);
  }
}

export async function clearFlock(flockId: string, farmId?: string) {
  const { supabase } = await resolveContext();

  const { error } = await supabase
    .from("flocks")
    .update({ active: false })
    .eq("id", flockId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/flocks");
  revalidatePath("/dashboard");
  if (farmId) revalidatePath(`/farms/${farmId}`);

  return { ok: true as const };
}

export async function reactivateFlock(flockId: string, farmId?: string) {
  const { supabase } = await resolveContext();

  const { data: thisFlock } = await supabase
    .from("flocks")
    .select("house_id")
    .eq("id", flockId)
    .maybeSingle();

  if (!thisFlock) {
    return { ok: false as const, error: "Flock not found" };
  }

  const { data: activeOther } = await supabase
    .from("flocks")
    .select("id")
    .eq("house_id", thisFlock.house_id)
    .eq("active", true)
    .maybeSingle();

  if (activeOther) {
    return { ok: false as const, error: "Another flock is already active in this house. Clear it first." };
  }

  const { error } = await supabase
    .from("flocks")
    .update({ active: true })
    .eq("id", flockId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/flocks");
  if (farmId) revalidatePath(`/farms/${farmId}`);
  return { ok: true as const };
}
