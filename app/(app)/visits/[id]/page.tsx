import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { VisitScoresList, type ScoreItem } from "@/components/visits/visit-scores-list";
import { IconHome, IconCheckSquare, IconClock } from "@/components/ui/icons";

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
        id, scheduled_at, type, status, notes, bird_count,
        coccidiostat, other_treatment,
        farms(id, name, region),
        visit_flocks(
          flocks(id, reference, placement_date, breeds(name), houses(name))
        )
      `)
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("scoring_definitions")
      .select("id, name, scale_max, module, module_order, order_in_module, field_type")
      .order("module_order")
      .order("order_in_module"),
    supabase
      .from("visit_scores")
      .select("id, score, numeric_value, text_value, flock_id, bird_number, definition_id")
      .eq("visit_id", id),
  ]);

  if (!visitRes.data) notFound();

  const visit = visitRes.data;
  const farm = Array.isArray(visit.farms) ? visit.farms[0] : visit.farms;
  const definitions = (definitionsRes.data ?? []).map(function (d) {
    return {
      id: d.id,
      name: d.name,
      scale_max: d.scale_max,
      module: d.module ?? "Other",
      module_order: d.module_order ?? 0,
      order_in_module: d.order_in_module ?? 0,
      field_type: (d.field_type ?? "score") as "score" | "numeric" | "sex",
    };
  });

  const visitFlocks = Array.isArray(visit.visit_flocks) ? visit.visit_flocks : [];
  const flocks = visitFlocks.map(function (vf) {
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
  }).filter(function (f): f is NonNullable<typeof f> { return f !== null; });

  const totalBirds = visit.bird_count ?? 5;
  const rawScores = scoresRes.data ?? [];
  const totalScores = rawScores.length;

  const scoreMatrix = new Map<string, Array<{
    bird_number: number;
    score: number | null;
    numeric_value: number | null;
    text_value: string | null;
  }>>();

  for (const s of rawScores) {
    const key = s.definition_id + "|" + (s.flock_id ?? "");
    if (!scoreMatrix.has(key)) scoreMatrix.set(key, []);
    scoreMatrix.get(key)!.push({
      bird_number: s.bird_number ?? 1,
      score: s.score,
      numeric_value: s.numeric_value,
      text_value: s.text_value,
    });
  }

  const scoreItems: ScoreItem[] = [];
  if (flocks.length > 0) {
    for (const def of definitions) {
      for (const fl of flocks) {
        const key = def.id + "|" + fl.id;
        const birdScores = scoreMatrix.get(key) ?? [];
        scoreItems.push({
          defId: def.id,
          defName: def.name,
          module: def.module,
          moduleOrder: def.module_order,
          orderInModule: def.order_in_module,
          fieldType: def.field_type,
          scaleMax: def.scale_max,
          flockReference: flocks.length > 1 ? fl.reference : null,
          birdScores: birdScores,
          totalBirds: totalBirds,
        });
      }
    }
  }

  let criticalCount = 0;
  for (const s of rawScores) {
    if (s.score !== null && s.score >= 3) {
      const def = definitions.find(function (d) { return d.id === s.definition_id; });
      if (def && def.scale_max >= 3) criticalCount += 1;
    }
  }

  const visitDate = new Date(visit.scheduled_at);
  const dateStr = visitDate.toLocaleDateString("en-AU", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const timeStr = visitDate.toLocaleTimeString("en-AU", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const statusPill = visit.status === "completed" ? "pill--ok" :
                     visit.status === "in_progress" ? "pill--warn" : "";

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Visits", href: "/visits" },
          { label: dateStr },
        ]}
      />
      <div className="w-full max-w-[1100px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs"
                 style={{ color: "var(--text-3)" }}>
              <Link href="/visits" style={{ color: "var(--text-2)" }}>← All visits</Link>
              <span>·</span>
              <span className="capitalize">{visit.type.replace("_", " ")} visit</span>
            </div>
            <h1>{farm?.name ?? "Visit"}</h1>
            <div className="page-header__sub">
              {dateStr} at {timeStr}
              {farm?.region ? " · " + farm.region : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={"pill " + statusPill}>
              {visit.status.replace("_", " ")}
            </span>
            <Link href={`/visits/${visit.id}/edit`} className="btn">
              Edit
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="stat">
            <div className="stat__label">Flocks</div>
            <div className="stat__value">{flocks.length}</div>
            <div className="stat__sub">
              {flocks.length > 0 ? "in this visit" : "none attached"}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Birds inspected</div>
            <div className="stat__value">{totalBirds}</div>
            <div className="stat__sub">per flock</div>
          </div>
          <div className="stat">
            <div className="stat__label">Scores recorded</div>
            <div className="stat__value">{totalScores}</div>
            <div className="stat__sub">across all items</div>
          </div>
          <div className="stat">
            <div className="stat__label">Critical scores</div>
            <div
              className="stat__value"
              style={{ color: criticalCount > 0 ? "var(--bad)" : "var(--text)" }}
            >
              {criticalCount}
            </div>
            <div className="stat__sub">
              {criticalCount > 0 ? "review recommended" : "none flagged"}
            </div>
          </div>
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="font-display text-[16px] font-medium m-0"
                style={{ fontVariationSettings: "'opsz' 32" }}
              >
                <IconCheckSquare size={15} /> Scoring summary
              </h2>
              <Link
                href={`/scoring?visit=${visit.id}`}
                className="text-[12px]"
                style={{ color: "var(--green-700)" }}
              >
                Open scoring
              </Link>
            </div>

            {flocks.length === 0 ? (
              <div className="card">
                <div className="card__body text-center" style={{ padding: 40 }}>
                  <p className="m-0 mb-3 text-[13px]" style={{ color: "var(--text-2)" }}>
                    No flocks attached to this visit.
                  </p>
                  <Link href={`/visits/${visit.id}/edit`} className="btn btn--primary">
                    Attach flocks
                  </Link>
                </div>
              </div>
            ) : totalScores === 0 ? (
              <div className="card">
                <div className="card__body text-center" style={{ padding: 40 }}>
                  <p className="m-0 mb-3 text-[13px]" style={{ color: "var(--text-2)" }}>
                    No scores recorded yet.
                  </p>
                  <Link href={`/scoring?visit=${visit.id}`} className="btn btn--primary">
                    Start scoring
                  </Link>
                </div>
              </div>
            ) : (
              <VisitScoresList items={scoreItems} />
            )}
          </div>

          <aside className="space-y-4">
            <div className="card">
              <div className="card__header">
                <h3 className="card__title text-[13px] font-medium">
                  <IconHome size={14} />
                  Flocks ({flocks.length})
                </h3>
              </div>
              <div className="card__body card__body--flush">
                {flocks.length === 0 ? (
                  <div className="px-4 py-3 text-[12px]"
                       style={{ color: "var(--text-3)" }}>
                    No flocks attached
                  </div>
                ) : (
                  flocks.map(function (fl) {
                    return (
                      <div
                        key={fl.id}
                        className="border-b px-4 py-3 last:border-b-0"
                        style={{ borderColor: "var(--divider)" }}
                      >
                        <div className="flex items-baseline justify-between">
                          <div className="font-mono text-[12px] font-medium">
                            {fl.reference ?? "-"}
                          </div>
                          <div className="text-[11px]"
                               style={{ color: "var(--text-3)" }}>
                            {fl.age_days}d
                          </div>
                        </div>
                        <div className="text-[10px]"
                             style={{ color: "var(--text-3)" }}>
                          {fl.house_name}
                          {fl.breed_name ? " · " + fl.breed_name : ""}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {(visit.coccidiostat || visit.other_treatment) ? (
              <div className="card">
                <div className="card__header">
                  <h3 className="card__title text-[13px] font-medium">
                    Treatment context
                  </h3>
                </div>
                <div className="card__body" style={{ padding: 16 }}>
                  {visit.coccidiostat ? (
                    <div className="mb-2">
                      <div className="text-[10px] font-medium uppercase tracking-widest"
                           style={{ color: "var(--text-3)" }}>
                        Coccidiostat
                      </div>
                      <div className="text-[12px]">{visit.coccidiostat}</div>
                    </div>
                  ) : null}
                  {visit.other_treatment ? (
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-widest"
                           style={{ color: "var(--text-3)" }}>
                        Other treatment
                      </div>
                      <div className="text-[12px]">{visit.other_treatment}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {visit.notes ? (
              <div className="card">
                <div className="card__header">
                  <h3 className="card__title text-[13px] font-medium">
                    <IconClock size={14} />
                    Notes
                  </h3>
                </div>
                <div className="card__body" style={{ padding: 16 }}>
                  <div className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {visit.notes}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
