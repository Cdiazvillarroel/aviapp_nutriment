import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MobileScoringClient, type InitialScore } from "@/components/scoring/mobile/mobile-scoring-client";

export const dynamic = "force-dynamic";

export default async function MobileScoringPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [visitRes, definitionsRes, scoresRes] = await Promise.all([
    supabase
      .from("visits")
      .select(`
        id, status, scheduled_at, bird_count,
        farms(name),
        visit_flocks(
          flocks(id, reference, placement_date, breeds(name), houses(name))
        )
      `)
      .eq("id", visitId)
      .eq("client_id", clientId)
      .maybeSingle(),

    supabase
      .from("scoring_definitions")
      .select("id, name, scale_max, module, module_order, order_in_module, field_type")
      .order("module_order")
      .order("order_in_module"),

    supabase
      .from("visit_scores")
      .select(`
        id, score, numeric_value, text_value, flock_id, bird_number, definition_id,
        photos(id, storage_path)
      `)
      .eq("visit_id", visitId),
  ]);

  if (!visitRes.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6"
           style={{ background: "var(--bg)" }}>
        <div className="card w-full max-w-md text-center">
          <div className="card__body" style={{ padding: 40 }}>
            <p className="m-0 mb-4 text-[13px]" style={{ color: "var(--text-2)" }}>
              Visit not found.
            </p>
            <Link href="/visits" className="btn btn--primary">All visits</Link>
          </div>
        </div>
      </div>
    );
  }

  const visit = visitRes.data;
  const farm = Array.isArray(visit.farms) ? visit.farms[0] : visit.farms;
  const definitions = (definitionsRes.data ?? []).map(d => ({
    id: d.id,
    name: d.name,
    scale_max: d.scale_max,
    module: d.module ?? "Other",
    module_order: d.module_order ?? 0,
    order_in_module: d.order_in_module ?? 0,
    field_type: (d.field_type ?? "score") as "score" | "numeric" | "sex",
  }));

  const visitFlocks = Array.isArray(visit.visit_flocks) ? visit.visit_flocks : [];
  const flocks = visitFlocks.map(vf => {
    const fl = Array.isArray(vf.flocks) ? vf.flocks[0] : vf.flocks;
    if (!fl) return null;
    const breed = Array.isArray(fl.breeds) ? fl.breeds[0] : fl.breeds;
    const house = Array.isArray(fl.houses) ? fl.houses[0] : fl.houses;
    return {
      id: fl.id,
      reference: fl.reference,
      house_name: house?.name ?? "—",
      breed_name: breed?.name ?? null,
      age_days: Math.round((Date.now() - new Date(fl.placement_date).getTime()) / 86_400_000),
    };
  }).filter((f): f is NonNullable<typeof f> => f !== null);

  const rawScores = scoresRes.data ?? [];
  const initialScores: InitialScore[] = await Promise.all(
    rawScores.map(async (s) => {
      const photoRows = Array.isArray(s.photos) ? s.photos : [];
      const photos = await Promise.all(
        photoRows.map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("visit-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { id: p.id, url: signed?.signedUrl ?? "" };
        })
      );
      return {
        flockId: s.flock_id ?? "",
        birdNumber: s.bird_number ?? 1,
        definitionId: s.definition_id,
        scoreId: s.id,
        score: s.score,
        numericValue: s.numeric_value,
        textValue: s.text_value,
        photos,
      };
    })
  );

  return (
    <MobileScoringClient
      visitId={visitId}
      visitFarmName={farm?.name ?? "Unknown farm"}
      birdCount={visit.bird_count ?? 5}
      flocks={flocks}
      definitions={definitions}
      initialScores={initialScores}
    />
  );
}
