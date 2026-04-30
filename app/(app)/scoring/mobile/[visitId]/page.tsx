import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientId } from "@/lib/auth";
import { upsertScore, uploadPhoto } from "../../[visitId]/score/actions";
import { MobileScoringClient } from "@/components/scoring/mobile/mobile-scoring-client";

export const dynamic = "force-dynamic";

export default async function MobileScoringPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const supabase = await createClient();
  const clientId = await getCurrentClientId();

  if (!clientId) redirect("/login");

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
    .map(function (vf) { return (vf as any).flocks; })
    .filter(Boolean);

  // Load scoring definitions
  const { data: definitions } = await supabase
    .from("scoring_definitions")
    .select("*")
    .order("module_order")
    .order("order_in_module");

  // Load existing scores for this visit
  const { data: scores } = await supabase
    .from("visit_scores")
    .select("*")
    .eq("visit_id", visit.id);

  // Load photo flags
  const { data: photos } = await supabase
    .from("photos")
    .select("visit_score_id")
    .in("visit_score_id", (scores ?? []).map(function (s) { return s.id; }));

  const photoSet = new Set((photos ?? []).map(function (p) { return p.visit_score_id; }));

  const scoresWithPhoto = (scores ?? []).map(function (s) {
    return { ...s, has_photo: photoSet.has(s.id) };
  });

  return (
    <MobileScoringClient
      visit={visit as any}
      farm={farm}
      flocks={flocks as any}
      scoringDefinitions={(definitions ?? []) as any}
      existingScores={scoresWithPhoto as any}
      upsertScore={upsertScore}
      uploadPhoto={uploadPhoto}
    />
  );
}
