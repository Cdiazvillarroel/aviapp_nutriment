import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { IconHome, IconAlert, IconCalendar } from "@/components/ui/icons";
import { timeOf, visitTypeLabel } from "@/lib/utils";

export default async function FarmDetailPage({
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

  const [farmRes, housesRes, recentVisitsRes, openAlertsRes] = await Promise.all([
    supabase
      .from("farms")
      .select(`
        id, name, reference_id, address,
        complexes(name, kind),
        regions(name)
      `)
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle(),

    supabase
      .from("houses")
      .select(`
        id, name, capacity,
        flocks(id, reference, placement_date, initial_count, active, breeds(name))
      `)
      .eq("farm_id", id)
      .is("archived_at", null)
      .order("name", { ascending: true }),

    supabase
      .from("visits")
      .select("id, scheduled_at, type, status, notes")
      .eq("farm_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(8),

    supabase
      .from("alerts")
      .select("id, severity, source, title, body, detected_at")
      .eq("farm_id", id)
      .eq("status", "open")
      .order("detected_at", { ascending: false }),
  ]);

  if (!farmRes.data) notFound();

  const farm = farmRes.data;
  const houses = housesRes.data ?? [];
  const visits = recentVisitsRes.data ?? [];
  const alerts = openAlertsRes.data ?? [];

  const complex = Array.isArray(farm.complexes) ? farm.complexes[0] : farm.complexes;
  const region = Array.isArray(farm.regions) ? farm.regions[0] : farm.regions;

  const totalActiveFlocks = houses.reduce((sum, h) => {
    const flocks = Array.isArray(h.flocks) ? h.flocks : [];
    return sum + flocks.filter(f => f.active).length;
  }, 0);

  const totalCapacity = houses.reduce((sum, h) => sum + (h.capacity ?? 0), 0);

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Farms", href: "/farms" },
          { label: farm.name },
        ]}
      />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
              <Link href="/farms" style={{ color: "var(--text-2)" }}>← All farms</Link>
              {farm.reference_id && (
                <>
                  <span>·</span>
                  <span className="font-mono">{farm.reference_id}</span>
                </>
              )}
            </div>
            <h1>{farm.name}</h1>
            <div className="page-header__sub">
              {[region?.name, complex?.name].filter(Boolean).join(" · ") || "Unassigned"}
              {farm.address && (
                <>
                  <span style={{ color: "var(--text-3)" }}> · </span>
                  {farm.address}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/farms/${farm.id}/edit`} className="btn btn--ghost">
              Edit
            </Link>
            <Link href={`/visits/new?farm=${farm.id}`} className="btn btn--primary">
              + Schedule visit
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="stat">
            <div className="stat__label">Houses</div>
            <div className="stat__value">{houses.length}</div>
            <div className="stat__sub">capacity {totalCapacity.toLocaleString()} birds</div>
          </div>
          <div className="stat">
            <div className="stat__label">Active flocks</div>
            <div className="stat__value">{totalActiveFlocks}</div>
            <div className="stat__sub">in production right now</div>
          </div>
          <div className="stat">
            <div className="stat__label">Open alerts</div>
            <div className="stat__value">{alerts.length}</div>
            <div className="stat__sub">{alerts.filter(a => a.severity === "critical").length} critical</div>
          </div>
          <div className="stat">
            <div className="stat__label">Recent visits</div>
            <div className="stat__value">{visits.length}</div>
            <div className="stat__sub">last 8 records</div>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                <IconHome size={16} />
                Houses & flocks
              </h2>
            </div>
            <div className="card__body card__body--flush">
              {houses.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-2)" }}>
                  No houses yet for this farm.{" "}
                  <Link href={`/farms/${farm.id}/edit`} style={{ color: "var(--green-700)" }}>
                    Add some →
                  </Link>
                </div>
              ) : (
                houses.map(h => {
                  const flocks = Array.isArray(h.flocks) ? h.flocks : [];
                  const activeFlocks = flocks.filter(f => f.active);
                  return (
                    <div
                      key={h.id}
                      className="border-b px-5 py-3.5 last:border-b-0"
                      style={{ borderColor: "var(--divider)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-medium">{h.name}</div>
                        <div className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                          cap. {h.capacity?.toLocaleString() ?? "—"}
                        </div>
                      </div>
                      {activeFlocks.length === 0 ? (
                        <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>Empty</div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activeFlocks.map(fl => {
                            const breed = Array.isArray(fl.breeds) ? fl.breeds[0] : fl.breeds;
                            const ageDays = Math.round(
                              (Date.now() - new Date(fl.placement_date).getTime()) / 86_400_000
                            );
                            return (
                              <div
                                key={fl.id}
                                className="rounded-md border px-2.5 py-1.5 text-[11px]"
                                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                              >
                                <span className="font-mono font-medium">{fl.reference ?? "—"}</span>
                                <span className="ml-1.5" style={{ color: "var(--text-2)" }}>
                                  {ageDays}d · {breed?.name ?? "—"} · {fl.initial_count?.toLocaleString() ?? "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                  <IconAlert size={16} />
                  Open alerts
                </h2>
              </div>
              <div className="card__body card__body--flush">
                {alerts.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs" style={{ color: "var(--text-2)" }}>
                    No open alerts.
                  </div>
                ) : (
                  alerts.map(a => (
                    <div key={a.id} className="border-b px-5 py-3 last:border-b-0" style={{ borderColor: "var(--divider)" }}>
                      <div className="flex items-center gap-2">
                        <span className={`pill ${a.severity === "critical" ? "pill--bad" : a.severity === "warning" ? "pill--warn" : "pill--info"}`}>
                          {a.severity}
                        </span>
                        <span className="text-[12px] font-medium">{a.title}</span>
                      </div>
                      {a.body && (
                        <div className="mt-1 text-[11px]" style={{ color: "var(--text-2)" }}>{a.body}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card__header">
                <h2 className="card__title">
                  <IconCalendar size={16} />
                  Recent visits
                </h2>
              </div>
              <div className="card__body card__body--flush">
                {visits.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs" style={{ color: "var(--text-2)" }}>
                    No visits recorded.
                  </div>
                ) : (
                  visits.map(v => {
                    const d = new Date(v.scheduled_at);
                    const isPast = d.getTime() < Date.now();
                    return (
                      <Link
                        key={v.id}
                        href={`/visits/${v.id}`}
                        className="grid items-center gap-3 border-b px-5 py-2.5 last:border-b-0 hover:bg-surface-2"
                        style={{ borderColor: "var(--divider)", gridTemplateColumns: "auto 1fr auto" }}
                      >
                        <div className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                          {d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                        </div>
                        <div className="text-[12px]">
                          {visitTypeLabel(v.type)}
                          <span className="ml-2 text-[11px]" style={{ color: "var(--text-3)" }}>
                            {timeOf(v.scheduled_at)}
                          </span>
                        </div>
                        <span
                          className={`pill ${
                            v.status === "completed" ? "pill--ok" :
                            v.status === "in_progress" ? "pill--warn" :
                            isPast ? "pill--bad" : ""
                          }`}
                        >
                          {v.status.replace("_", " ")}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
