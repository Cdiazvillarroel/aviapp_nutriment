import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { IconCalendar, IconCheckSquare, IconHome } from "@/components/ui/icons";
import { timeOf, visitTypeLabel } from "@/lib/utils";
import { VisitStatusActions } from "@/components/visits/status-actions";

export default async function VisitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [visitRes, scoresRes] = await Promise.all([
    supabase
      .from("visits")
      .select(`
        id, scheduled_at, type, status, notes, completed_at, farm_id,
        farms(name, regions(name)),
        visit_flocks(
          flocks(id, reference, placement_date, breeds(name), houses(name))
        )
      `)
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle(),

    supabase
      .from("visit_scores")
      .select(`
        id, score, notes, scored_at,
        scoring_definitions(name, section, scale_max),
        flocks(reference)
      `)
      .eq("visit_id", id)
      .order("scored_at", { ascending: false }),
  ]);

  if (!visitRes.data) notFound();

  const visit = visitRes.data;
  const farm = Array.isArray(visit.farms) ? visit.farms[0] : visit.farms;
  const region = farm
    ? (Array.isArray(farm.regions) ? farm.regions[0] : farm.regions)
    : null;

  const scheduledDate = new Date(visit.scheduled_at);
  const dateLabel = scheduledDate.toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

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
      breed_name: breed?.name ?? "—",
      age_days: Math.round((Date.now() - new Date(fl.placement_date).getTime()) / 86_400_000),
    };
  }).filter((f): f is NonNullable<typeof f> => f !== null);

  const scores = scoresRes.data ?? [];

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Visits", href: "/visits" },
          { label: dateLabel },
        ]}
      />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
              <Link href="/visits" style={{ color: "var(--text-2)" }}>← All visits</Link>
              <span>·</span>
              <span className="font-mono">{visitTypeLabel(visit.type)} visit</span>
            </div>
            <h1>{farm?.name ?? "Unknown farm"}</h1>
            <div className="page-header__sub">
              {dateLabel} at {timeOf(visit.scheduled_at)}
              {region?.name && (
                <>
                  <span style={{ color: "var(--text-3)" }}> · </span>
                  {region.name}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`pill ${visit.status === "completed" ? "pill--ok" : visit.status === "in_progress" ? "pill--warn" : ""}`}>
              {visit.status.replace("_", " ")}
            </span>
            <Link href={`/visits/${visit.id}/edit`} className="btn btn--ghost btn--sm">
              Edit
            </Link>
            <VisitStatusActions visitId={visit.id} status={visit.status} />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="stat">
            <div className="stat__label">Flocks</div>
            <div className="stat__value">{flocks.length}</div>
            <div className="stat__sub">to inspect</div>
          </div>
          <div className="stat">
            <div className="stat__label">Scores recorded</div>
            <div className="stat__value">{scores.length}</div>
            <div className="stat__sub">across all items</div>
          </div>
          <div className="stat">
            <div className="stat__label">Type</div>
            <div className="stat__value" style={{ fontSize: 22 }}>{visitTypeLabel(visit.type)}</div>
            <div className="stat__sub">visit category</div>
          </div>
          <div className="stat">
            <div className="stat__label">Status</div>
            <div className="stat__value" style={{ fontSize: 22 }}>{visit.status.replace("_", " ")}</div>
            <div className="stat__sub">
              {visit.completed_at ? `Completed ${new Date(visit.completed_at).toLocaleDateString("en-AU")}` : "Awaiting action"}
            </div>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                <IconCheckSquare size={16} />
                Scoring
              </h2>
              <Link href={`/scoring?visit=${visit.id}`} className="card__action">
                Open scoring →
              </Link>
            </div>
            <div className="card__body card__body--flush">
              {scores.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-2)" }}>
                  No scores recorded yet. Open the scoring screen to start.
                </div>
              ) : (
                scores.map(s => {
                  const def = Array.isArray(s.scoring_definitions) ? s.scoring_definitions[0] : s.scoring_definitions;
                  const fl = Array.isArray(s.flocks) ? s.flocks[0] : s.flocks;
                  return (
                    <div key={s.id} className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
                         style={{ borderColor: "var(--divider)", gridTemplateColumns: "1fr 80px 60px" }}>
                      <div>
                        <div className="text-[13px] font-medium">{def?.name ?? "—"}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
                          {def?.section ?? ""}{fl?.reference && ` · ${fl.reference}`}
                        </div>
                      </div>
                      <div className="text-right text-[11px]" style={{ color: "var(--text-3)" }}>
                        of {def?.scale_max ?? "—"}
                      </div>
                      <div className="text-right font-mono text-[15px] font-medium tabular-nums">{s.score}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="card">
              <div className="card__header">
                <h2 className="card__title">
                  <IconHome size={16} />
                  Flocks ({flocks.length})
                </h2>
              </div>
              <div className="card__body card__body--flush">
                {flocks.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs" style={{ color: "var(--text-2)" }}>
                    No flocks attached.{" "}
                    <Link href={`/visits/${visit.id}/edit`} style={{ color: "var(--green-700)" }}>
                      Edit the visit to add some.
                    </Link>
                  </div>
                ) : (
                  flocks.map(fl => (
                    <div key={fl.id} className="border-b px-5 py-3 last:border-b-0" style={{ borderColor: "var(--divider)" }}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-[12px] font-medium">{fl.reference ?? "—"}</span>
                        <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{fl.age_days}d</span>
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-2)" }}>
                        {fl.house_name} · {fl.breed_name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {visit.notes && (
              <div className="card">
                <div className="card__header">
                  <h2 className="card__title">
                    <IconCalendar size={16} />
                    Notes
                  </h2>
                </div>
                <div className="card__body">
                  <p className="m-0 text-[13px] leading-relaxed">{visit.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
