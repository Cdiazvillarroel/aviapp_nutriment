import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { VisitsFilters } from "@/components/visits/visits-filters";
import { IconCalendar, IconArrowRight } from "@/components/ui/icons";
import { timeOf, visitTypeLabel } from "@/lib/utils";

type VisitTab = "today" | "upcoming" | "past" | "all";
type VisitStatus = "planned" | "in_progress" | "completed" | "cancelled";

interface VisitItem {
  id: string;
  scheduled_at: string;
  type: string;
  status: VisitStatus;
  farm_name: string;
  farm_id: string;
  scoresCount: number;
  flocksCount: number;
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; farm?: string; type?: string }>;
}) {
  const params = await searchParams;
  const tab = (params.tab ?? "today") as VisitTab;
  const farmFilter = params.farm ?? "";
  const typeFilter = params.type ?? "";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [visitsRes, farmsRes] = await Promise.all([
    supabase
      .from("visits")
      .select(`
        id, scheduled_at, type, status, farm_id,
        farms(name)
      `)
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false }),

    supabase
      .from("farms")
      .select("id, name")
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("name"),
  ]);

  const visits = visitsRes.data ?? [];
  const visitIds = visits.map(v => v.id);
  const safeIds = visitIds.length ? visitIds : ["00000000-0000-0000-0000-000000000000"];

  const [scoresRes, vfRes] = await Promise.all([
    supabase
      .from("visit_scores")
      .select("visit_id, score")
      .in("visit_id", safeIds)
      .not("score", "is", null),

    supabase
      .from("visit_flocks")
      .select("visit_id")
      .in("visit_id", safeIds),
  ]);

  const scoresByVisit = new Map<string, number>();
  for (const s of scoresRes.data ?? []) {
    scoresByVisit.set(s.visit_id, (scoresByVisit.get(s.visit_id) ?? 0) + 1);
  }

  const flocksByVisit = new Map<string, number>();
  for (const vf of vfRes.data ?? []) {
    flocksByVisit.set(vf.visit_id, (flocksByVisit.get(vf.visit_id) ?? 0) + 1);
  }

  const all: VisitItem[] = visits.map(v => {
    const farm = Array.isArray(v.farms) ? v.farms[0] : v.farms;
    return {
      id: v.id,
      scheduled_at: v.scheduled_at,
      type: v.type,
      status: v.status as VisitStatus,
      farm_name: farm?.name ?? "Unknown",
      farm_id: v.farm_id,
      scoresCount: scoresByVisit.get(v.id) ?? 0,
      flocksCount: flocksByVisit.get(v.id) ?? 0,
    };
  });

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  const isToday = (v: VisitItem) => {
    const d = new Date(v.scheduled_at);
    return d >= startOfDay && d <= endOfDay;
  };
  const isUpcoming = (v: VisitItem) => new Date(v.scheduled_at) > endOfDay;
  const isPast = (v: VisitItem) => new Date(v.scheduled_at) < startOfDay;

  const counts = {
    today: all.filter(isToday).length,
    upcoming: all.filter(isUpcoming).length,
    past: all.filter(isPast).length,
    all: all.length,
  };

  let bucket: VisitItem[] = all;
  if (tab === "today") bucket = all.filter(isToday);
  if (tab === "upcoming") bucket = all.filter(isUpcoming);
  if (tab === "past") bucket = all.filter(isPast);

  const filtered = bucket.filter(v => {
    if (farmFilter && v.farm_id !== farmFilter) return false;
    if (typeFilter && v.type !== typeFilter) return false;
    return true;
  });

  if (tab === "upcoming" || tab === "today") {
    filtered.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  } else {
    filtered.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }

  return (
    <>
      <Topbar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Visits" }]} />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Visits</h1>
            <div className="page-header__sub">
              {counts.today} scheduled today · {counts.upcoming} upcoming · {counts.past} past
            </div>
          </div>
          <Link href="/visits/new" className="btn btn--primary">+ Schedule visit</Link>
        </div>

        <VisitsFilters
          farms={farmsRes.data ?? []}
          currentTab={tab}
          currentFarm={farmFilter}
          currentType={typeFilter}
          counts={counts}
        />

        <div className="card mt-5">
          {filtered.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm" style={{ color: "var(--text-2)" }}>
              {all.length === 0 ? (
                <>
                  No visits yet.{" "}
                  <Link href="/visits/new" style={{ color: "var(--green-700)" }}>Schedule your first visit →</Link>
                </>
              ) : (
                <>No visits in this view.</>
              )}
            </div>
          ) : (
            <div className="card__body card__body--flush">
              <div className="grid items-center gap-4 border-b px-5 py-3 text-[11px] font-medium uppercase tracking-wider"
                   style={{
                     borderColor: "var(--divider)",
                     background: "var(--surface-2)",
                     color: "var(--text-3)",
                     gridTemplateColumns: "120px 2fr 1fr 100px 110px 32px",
                   }}>
                <div>When</div>
                <div>Farm</div>
                <div>Type</div>
                <div className="text-right">Flocks</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {filtered.map(v => (
                <VisitRow key={v.id} visit={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VisitRow({ visit }: { visit: VisitItem }) {
  const d = new Date(visit.scheduled_at);
  const isToday = isSameDay(d, new Date());
  const dateLabel = isToday
    ? "Today"
    : d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });

  const statusPill = STATUS_PILL[visit.status];

  return (
    <Link
      href={`/visits/${visit.id}`}
      className="grid items-center gap-4 border-b px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
      style={{ borderColor: "var(--divider)", gridTemplateColumns: "120px 2fr 1fr 100px 110px 32px" }}
    >
      <div>
        <div className="text-[13px] font-medium">{dateLabel}</div>
        <div className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>{timeOf(visit.scheduled_at)}</div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <IconCalendar size={13} />
          <span className="truncate text-[13px] font-medium">{visit.farm_name}</span>
        </div>
        {visit.scoresCount > 0 && (
          <div className="ml-[21px] mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
            {visit.scoresCount} score{visit.scoresCount === 1 ? "" : "s"} recorded
          </div>
        )}
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-2)" }}>{visitTypeLabel(visit.type)}</div>
      <div className="text-right font-mono text-[13px] tabular-nums">
        {visit.flocksCount > 0 ? visit.flocksCount : <span style={{ color: "var(--text-3)" }}>—</span>}
      </div>
      <div className="text-right">
        <span className={`pill ${statusPill.cls}`}>{statusPill.label}</span>
      </div>
      <div className="text-right" style={{ color: "var(--text-3)" }}>
        <IconArrowRight size={14} />
      </div>
    </Link>
  );
}

const STATUS_PILL: Record<VisitStatus, { cls: string; label: string }> = {
  planned:     { cls: "",           label: "Planned" },
  in_progress: { cls: "pill--warn", label: "In progress" },
  completed:   { cls: "pill--ok",   label: "Completed" },
  cancelled:   { cls: "",           label: "Cancelled" },
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}
