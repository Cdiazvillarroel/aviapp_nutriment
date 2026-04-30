import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileScoringClient } from "@/components/scoring/mobile/mobile-scoring-client";

export const dynamic = "force-dynamic";

export default async function MobileScoringPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const supabase = await createClient();

  // Get current user and their client
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/login");
  const clientId = membership.client_id;

  // Load visit
  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("id, client_id, farm_id, scheduled_at, bird_count, notes")
    .eq("id", visitId)
    .eq("client_id", clientId)
    .single();

  if (visitError || !visit) notFound();

  // Load farm
  const { data: farm } = await supabase
    .from("farms")
    .select("id, name")
    .eq("id", visit.farm_id)
    .single();

  if (!farm) notFound();

  // Load flocks for this visit
  const { data: visitFlocks } = await supabase
    .from("visit_flocks")
    .select("flock_id, flocks(id, reference, placement_date)")
    .eq("visit_id", visit.id);

  const flocks = (visitFlocks ?? [])
    .map((vf) => {
      const fl = Array.isArray((vf as any).flocks) ? (vf as any).flocks[0] : (vf as any).flocks;
      return fl;
    })
    .filter(Boolean);

  // Load scoring definitions
  const { data: definitions } = await supabase
    .from("scoring_definitions")
    .select("id, name, scale_max, module, module_order, order_in_module, field_type")
    .order("module_order")
    .order("order_in_module");

  // Load existing scores for this visit
  const { data: scores } = await supabase
    .from("visit_scores")
    .select("id, score, numeric_value, text_value, flock_id, bird_number, definition_id")
    .eq("visit_id", visitId);

  // Check which scores have photos
  const scoreIds = (scores ?? []).map((s) => s.id);
  let photoSet = new Set<string>();
  if (scoreIds.length > 0) {
    const { data: photos } = await supabase
      .from("photos")
      .select("visit_score_id")
      .in("visit_score_id", scoreIds);
    photoSet = new Set((photos ?? []).map((p) => p.visit_score_id));
  }

  const scoresWithPhoto = (scores ?? []).map((s) => ({
    ...s,
    has_photo: photoSet.has(s.id),
  }));

  return (
    <MobileScoringClient
      visit={visit as any}
      farm={farm}
      flocks={flocks as any}
      scoringDefinitions={(definitions ?? []) as any}
      existingScores={scoresWithPhoto as any}
    />
  );
}
