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

export async function dismissAlert(formData: FormData): Promise<void> {
  const { supabase, clientId, userId } = await resolveContext();

  const ruleKey = String(formData.get("rule_key") ?? "");
  const entityKey = String(formData.get("entity_key") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!ruleKey || !entityKey) {
    throw new Error("Missing rule_key or entity_key");
  }

  const { error } = await supabase
    .from("alert_dismissals")
    .upsert({
      client_id: clientId,
      rule_key: ruleKey,
      entity_key: entityKey,
      dismissed_by: userId,
      dismissed_at: new Date().toISOString(),
      notes,
    }, { onConflict: "client_id,rule_key,entity_key" });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/map");
}

export async function undismissAlert(formData: FormData): Promise<void> {
  const { supabase, clientId } = await resolveContext();

  const ruleKey = String(formData.get("rule_key") ?? "");
  const entityKey = String(formData.get("entity_key") ?? "");

  if (!ruleKey || !entityKey) {
    throw new Error("Missing rule_key or entity_key");
  }

  const { error } = await supabase
    .from("alert_dismissals")
    .delete()
    .eq("client_id", clientId)
    .eq("rule_key", ruleKey)
    .eq("entity_key", ruleKey === ruleKey ? entityKey : entityKey);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/map");
}
