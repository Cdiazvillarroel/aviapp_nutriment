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

interface HouseInput {
  id: string | null;
  name: string;
  custom_id: string;
  length_m: number | null;
  width_m: number | null;
  drink_system: string | null;
  feed_system: string | null;
  housing_system: string | null;
  capacity: number | null;
  archived: boolean;
}

interface ContactInput {
  id: string | null;
  role: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  archived: boolean;
}

function parseLatLng(formData: FormData): { lat: number | null; lng: number | null } {
  const latRaw = (formData.get("latitude") as string | null) ?? "";
  const lngRaw = (formData.get("longitude") as string | null) ?? "";
  const lat = latRaw.trim() === "" ? null : parseFloat(latRaw);
  const lng = lngRaw.trim() === "" ? null : parseFloat(lngRaw);
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return { lat: null, lng: null };
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) return { lat: null, lng: null };
  return { lat, lng };
}

export async function createFarm(formData: FormData) {
  const { supabase, clientId } = await resolveContext();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  if (!name) {
    return { ok: false as const, error: "Farm name is required" };
  }

  const { lat, lng } = parseLatLng(formData);

  const { data: farm, error } = await supabase
    .from("farms")
    .insert({
      client_id: clientId,
      name,
      address,
      region,
      latitude: lat,
      longitude: lng,
    })
    .select("id")
    .single();

  if (error || !farm) {
    return { ok: false as const, error: error?.message ?? "Could not create farm" };
  }

  const housesRaw = String(formData.get("houses_json") ?? "[]");
  let houses: HouseInput[] = [];
  try {
    houses = JSON.parse(housesRaw);
  } catch {
    houses = [];
  }
  const housesToInsert = houses
    .filter(function (h) { return !h.archived && h.name.trim() !== ""; })
    .map(function (h) {
      return {
        farm_id: farm.id,
        name: h.name.trim(),
        custom_id: h.custom_id.trim() || null,
        length_m: h.length_m,
        width_m: h.width_m,
        drink_system: h.drink_system,
        feed_system: h.feed_system,
        housing_system: h.housing_system,
        capacity: h.capacity,
      };
    });
  if (housesToInsert.length > 0) {
    await supabase.from("houses").insert(housesToInsert);
  }

  await syncContacts(supabase, farm.id, formData);

  revalidatePath("/farms");
  redirect(`/farms/${farm.id}`);
}

export async function updateFarm(farmId: string, formData: FormData) {
  const { supabase, clientId } = await resolveContext();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  if (!name) {
    return { ok: false as const, error: "Farm name is required" };
  }

  const { lat, lng } = parseLatLng(formData);

  const { error: farmErr } = await supabase
    .from("farms")
    .update({ name, address, region, latitude: lat, longitude: lng })
    .eq("id", farmId)
    .eq("client_id", clientId);

  if (farmErr) {
    return { ok: false as const, error: farmErr.message };
  }

  const housesRaw = String(formData.get("houses_json") ?? "[]");
  let houses: HouseInput[] = [];
  try {
    houses = JSON.parse(housesRaw);
  } catch {
    houses = [];
  }
  for (const h of houses) {
    if (h.id) {
      if (h.archived) {
        await supabase
          .from("houses")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", h.id);
      } else {
        await supabase
          .from("houses")
          .update({
            name: h.name.trim(),
            custom_id: h.custom_id.trim() || null,
            length_m: h.length_m,
            width_m: h.width_m,
            drink_system: h.drink_system,
            feed_system: h.feed_system,
            housing_system: h.housing_system,
            capacity: h.capacity,
            archived_at: null,
          })
          .eq("id", h.id);
      }
    } else {
      if (!h.archived && h.name.trim() !== "") {
        await supabase.from("houses").insert({
          farm_id: farmId,
          name: h.name.trim(),
          custom_id: h.custom_id.trim() || null,
          length_m: h.length_m,
          width_m: h.width_m,
          drink_system: h.drink_system,
          feed_system: h.feed_system,
          housing_system: h.housing_system,
          capacity: h.capacity,
        });
      }
    }
  }

  await syncContacts(supabase, farmId, formData);

  revalidatePath(`/farms/${farmId}`);
  revalidatePath(`/farms`);
  redirect(`/farms/${farmId}`);
}

async function syncContacts(supabase: Awaited<ReturnType<typeof createClient>>, farmId: string, formData: FormData) {
  const raw = String(formData.get("contacts_json") ?? "[]");
  let contacts: ContactInput[] = [];
  try {
    contacts = JSON.parse(raw);
  } catch {
    contacts = [];
  }

  let order = 0;
  for (const c of contacts) {
    if (c.id) {
      if (c.archived) {
        await supabase.from("farm_contacts").delete().eq("id", c.id);
      } else if (c.name.trim() !== "" || c.role.trim() !== "") {
        await supabase
          .from("farm_contacts")
          .update({
            role: c.role.trim() || "Contact",
            name: c.name.trim(),
            phone: c.phone.trim() || null,
            email: c.email.trim() || null,
            notes: c.notes.trim() || null,
            display_order: order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id);
      }
    } else {
      if (!c.archived && (c.name.trim() !== "" || c.role.trim() !== "")) {
        await supabase.from("farm_contacts").insert({
          farm_id: farmId,
          role: c.role.trim() || "Contact",
          name: c.name.trim(),
          phone: c.phone.trim() || null,
          email: c.email.trim() || null,
          notes: c.notes.trim() || null,
          display_order: order,
        });
      }
    }
    order += 1;
  }
}

export async function deleteFarm(farmId: string) {
  const { supabase, clientId } = await resolveContext();
  await supabase.from("farms").delete().eq("id", farmId).eq("client_id", clientId);
  revalidatePath("/farms");
  redirect("/farms");
}
