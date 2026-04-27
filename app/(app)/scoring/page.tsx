import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { ScoringClient, type InitialScore } from "@/components/scoring/scoring-client";
import { IconCheckSquare } from "@/components/ui/icons";

export default async function ScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ visit?: string }>;
}) {
  const { visit: visitId } = await searchParams;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  if (!visitId) {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

    const { data: candidates } = await supabase
      .from("visits")
      .select(`id, scheduled_at, status, farms(name)`)
      .eq("client_id", clientId)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString())
      .order("scheduled_at", { ascending: true });

    return (
      <>
        <Topbar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Scoring" }]} />
        <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
          <div className="page-header">
            <div>
              <h1>Scoring</h1>
              <div className="page-header__sub">
                Open the scoring sheet from a visit to start recording.
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                <IconCheckSquare size={16} />
                Today&apos;s visits
              </h2>
            </div>
            <div className="card__body card__body--flush">
              {(candidates ?? []).length === 0 ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-2)" }}>
                  No visits scheduled for today.{" "}
                  <Link href="/visits" style={{ color: "var(--green-700)" }}>Browse all visits →</Link>
                </div>
              ) : (
                (candidates ?? []).map(v => {
                  const farm = Array.isArray(v.farms) ? v.farms[0] : v.farms;
                  const time = new Date(v.scheduled_at).toLocaleTimeString("en-AU", {
                    hour: "2-digit", minute: "2-digit", hour12: false,
                  });
                  return (
                    <Link
                      key={v.id}
                      href={`/scoring?visit=${v.id}`}
                      className="grid items-center gap-3 border-b px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
                      style={{ borderColor: "var(--divider)", gridTemplateColumns: "60px 1fr auto" }}
                    >
                      <div className="font-mono text-[13px] font-medium">{time}</div>
                      <div className="text-[13px]">{farm?.name ?? "Unknown"}</div>
                      <span className={`pill ${
                        v.status === "completed" ? "pill--ok" :
                        v.status === "in_progress" ? "pill--warn" : ""
                      }`}>
                        {v.status.replace("_", " ")}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const [visitRes, definitionsRes, scoresRes] = await Promise.all([
    supabase
      .from("visits")
      .select(`
        id, status, scheduled_at, coccidiostat, other_treatment, bird_count,
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
      <>
        <Topbar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Scoring" }]} />
        <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
          <div className="card">
            <div className="card__body text-center" style={{ padding: 60 }}>
              <p className="m-0 mb-4 text-[13px]" style={{ color: "var(--text-2)" }}>
                Visit not found.
              </p>
              <Link href="/visits" className="btn btn--primary">All visits</Link>
            </div>
          </div>
        </div>
      </>
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

  const visitDate = new Date(visit.scheduled_at).toLocaleDateString("en-AU", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Visits", href: "/visits" },
          { label: farm?.name ?? "Visit", href: `/visits/${visitId}` },
          { label: "Scoring" },
        ]}
      />
      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <ScoringClient
          visitId={visitId}
          visitFarmName={farm?.name ?? "Unknown farm"}
          visitDate={visitDate}
          initialBirdCount={visit.bird_count ?? 5}
          initialTreatment={{
            coccidiostat: visit.coccidiostat ?? null,
            other_treatment: visit.other_treatment ?? null,
          }}
          flocks={flocks}
          definitions={definitions}
          initialScores={initialScores}
        />
      </div>
    </>
  );
}
