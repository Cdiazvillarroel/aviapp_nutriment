"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createFarm(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    redirect("/farms?error=no-client");
  }

  const name = String(formData.get("name") ?? "").trim();
  const reference_id = String(formData.get("reference_id") ?? "").trim() || null;
  const complex_id = String(formData.get("complex_id") ?? "") || null;
  const region_id = String(formData.get("region_id") ?? "") || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name) {
    redirect("/farms/new?error=name-required");
  }

  const { error } = await supabase.from("farms").insert({
    client_id: membership.client_id,
    name,
    reference_id,
    complex_id,
    region_id,
    address,
  });

  if (error) {
    redirect(`/farms/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/farms");
  redirect("/farms");
}
