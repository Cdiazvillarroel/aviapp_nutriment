"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface HouseInput {
  id?: string;
  name: string;
  custom_id?: string;
  dimensions?: string;
  drink_system?: string;
  feed_system?: string;
  housing_system?: string;
  capacity?: string;
  _markedForDelete?: boolean;
}

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

  if (!membership) redirect("/farms?error=no-client");
  return { supabase, clientId: membership.client_id };
}

function parseHouses(json: string): HouseInput[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function houseToInsertRow(h: HouseInput, farmId: string) {
  return {
    farm_id: farmId,
    name: h.name.trim(),
    custom_id: h.custom_id?.trim() || null,
    dimensions: h.dimensions?.trim() || null,
    drink_system: h.drink_system?.trim() || null,
    feed_system: h.feed_system?.trim() || null,
    housing_system: h.housing_system?.trim() || null,
    capacity: h.capacity ? parseInt(h.capacity, 10) || null : null,
  };
}

function houseToUpdateRow(h: HouseInput) {
  return {
    name: h.name.trim(),
    custom_id: h.custom_id?.trim() || null,
    dimensions: h.dimensions?.trim() || null,
    drink_system: h.drink_system?.trim() || null,
    feed_system: h.feed_system?.trim() || null,
    housing_system: h.housing_system?.trim() || null,
    capacity: h.capacity ? parseInt(h.capacity, 10) || null : null,
  };
}

export async function createFarm(formData: FormData) {
  const { supabase, clientId } = await resolveContext();

  const name = String(formData.get("name") ?? "").trim();
  const reference_id = String(formData.get("reference_id") ?? "").trim() || null;
  const complex_id = String(formData.get("complex_id") ?? "") || null;
  const region_id = String(formData.get("region_id") ?? "") || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const housesJson = String(formData.get("houses_json") ?? "[]");

  if (!name) {
    redirect("/farms/new?error=name-required");
  }

  const { data: farm, error } = await supabase
    .from("farms")
    .insert({
      client_id: clientId,
      name,
      reference_id,
      complex_id,
      region_id,
      address,
    })
    .select("id")
    .single();

  if (error || !farm) {
    redirect(`/farms/new?error=${encodeURIComponent(error?.message ?? "unknown")}`);
  }

  const houses = parseHouses(housesJson)
    .filter(h => !h._markedForDelete && h.name.trim() !== "");

  if (houses.length > 0) {
    const rows = houses.map(h => houseToInsertRow(h, farm.id));
    await supabase.from("houses").insert(rows);
  }

  revalidatePath("/farms");
  redirect(`/farms/${farm.id}`);
}

export async function updateFarm(formData: FormData) {
  const { supabase, clientId } = await resolveContext();

  const farmId = String(formData.get("farm_id") ?? "");
  if (!farmId) redirect("/farms");

  const name = String(formData.get("name") ?? "").trim();
  const reference_id = String(formData.get("reference_id") ?? "").trim() || null;
  const complex_id = String(formData.get("complex_id") ?? "") || null;
  const region_id = String(formData.get("region_id") ?? "") || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const housesJson = String(formData.get("houses_json") ?? "[]");

  if (!name) {
    redirect(`/farms/${farmId}/edit?error=name-required`);
  }

  const { error: updateErr } = await supabase
    .from("farms")
    .update({ name, reference_id, complex_id, region_id, address })
    .eq("id", farmId)
    .eq("client_id", clientId);

  if (updateErr) {
    redirect(`/farms/${farmId}/edit?error=${encodeURIComponent(updateErr.message)}`);
  }

  const houses = parseHouses(housesJson);

  // Archive marked-for-delete houses (soft delete).
  const toArchive = houses.filter(h => h.id && h._markedForDelete);
  for (const h of toArchive) {
    await supabase
      .from("houses")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", h.id!)
      .eq("farm_id", farmId);
  }

  // Update existing houses.
  const toUpdate = houses.filter(h => h.id && !h._markedForDelete && h.name.trim() !== "");
  for (const h of toUpdate) {
    await supabase
      .from("houses")
      .update(houseToUpdateRow(h))
      .eq("id", h.id!)
      .eq("farm_id", farmId);
  }

  // Insert new houses.
  const toInsert = houses.filter(h => !h.id && !h._markedForDelete && h.name.trim() !== "");
  if (toInsert.length > 0) {
    const rows = toInsert.map(h => houseToInsertRow(h, farmId));
    await supabase.from("houses").insert(rows);
  }

  revalidatePath("/farms");
  revalidatePath(`/farms/${farmId}`);
  redirect(`/farms/${farmId}`);
}
