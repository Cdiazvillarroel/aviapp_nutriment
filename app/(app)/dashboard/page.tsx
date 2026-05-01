import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { AiInsight } from "@/components/dashboard/ai-insight";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { TodayVisits } from "@/components/dashboard/today-visits";
import { MortalityChart } from "@/components/dashboard/mortality-chart";
import { ScoringTrends } from "@/components/dashboard/scoring-trends";
import { MobileRedirect } from "@/components/ui/mobile-redirect";
import type { Alert, Visit } from "@/lib/types";

const VIC_BENCHMARK_PCT = 0.28; // Mortality benchmark for VIC broiler avg

export default async function DashboardPage() {
  const supabase = await createClient();

  // Auth + tenancy resolved by the layout, but we still need the client_id
  // here to scope our queries.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: memberships } = await supabase
    .from("client_members")
    .select("clients(id, name)")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const client = Array.isArray(memberships?.clients) ? memberships?.clients[0] : memberships?.clients;
  const clientId = client?.id;

  // ----- Parallel data fetches -----
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

  const [
    activeFlocksRes,
    visitsThisWeekRes,
    openAlertsCountRes,
    aiInsightRes,
    openAlertsRes,
    todayVisitsRes,
    dailyRecordsRes,
  ] = await Promise.all([
    // Active flocks count (across this client's farms)
    supabase
      .from("flocks")
      .select("id, houses!inner(farms!inner(client_id))", { count: "exact", head: true })
      .eq("active", true)
      .eq("houses.farms.client_id", clientId!),

    // Visits scheduled this week
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId!)
      .gte("scheduled_at", startOfWeek.toISOString()),

    // Open alerts count
    supabase
      .from("alerts")
      .select("id, severity", { count: "exact" })
      .eq("client_id", clientId!)
      .eq("status", "open"),

    // Most-recent critical AI predictive insight (for the hero banner)
    supabase
      .from("alerts")
      .select("*, farms(name)")
      .eq("client_id", clientId!)
      .eq("status", "open")
      .eq("source", "ai_predictive")
      .order("detected_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Open alerts list
    supabase
      .from("alerts")
      .select("*, farms(name, regions(name))")
      .eq("client_id", clientId!)
      .eq("status", "open")
      .order("detected_at", { ascending: false })
      .limit(6),

    // Today's visits
    supabase
      .from("visits")
      .select("*, farms(name)")
      .eq("client_id", clientId!)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString())
      .order("scheduled_at", { ascending: true }),

    // 14 days of daily mortality records, joined to flock initial counts
    supabase
      .from("daily_records")
      .select("date, mortality, flocks!inner(initial_count, houses!inner(farms!inner(client_id)))")
      .gte("date", fourteenDaysAgo.toISOString().slice(0, 10))
      .eq("flocks.houses.farms.client_id", clientId!)
      .order("date", { ascending: true }),
  ]);

  // ----- Shape data -----
  const activeFlocks = activeFlocksRes.count ?? 0;
  const visitsWeek = visitsThisWeekRes.count ?? 0;
  const openAlerts = openAlertsCountRes.count ?? 0;
  const criticalCount = (openAlertsRes.data ?? []).filter(a => a.severity === "critical").length;
  const warningCount  = (openAlertsRes.data ?? []).filter(a => a.severity === "warning").length;

  const visitsToday = todayVisitsRes.data ?? [];
  const visitsTodayCount = visitsToday.length;
  const upcomingCount = Math.max(visitsWeek - visitsTodayCount, 0);

  // Aggregate daily records into a 14-day series of total birds vs mortality.
  const seriesMap = new Map<string, { mortality: number; total_birds: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    seriesMap.set(key, { mortality: 0, total_birds: 0 });
  }
  for (const r of dailyRecordsRes.data ?? []) {
    // Supabase nested joins can be objects or arrays — normalise.
    const flock = Array.isArray((r as any).flocks) ? (r as any).flocks[0] : (r as any).flocks;
    const initial = flock?.initial_count ?? 0;
    const slot = seriesMap.get(r.date);
    if (slot) {
      slot.mortality += r.mortality ?? 0;
      slot.total_birds += initial;
    }
  }
  const series = Array.from(seriesMap.entries()).map(([date, v]) => ({ date, ...v }));

  // Compute current mortality percentage for the KPI
  const last7 = series.slice(-7);
  const last7Mortality = last7.reduce((a, b) => a + b.mortality, 0);
  const last7Birds = last7.reduce((a, b) => a + b.total_birds, 0);
  const mortalityPct = last7Birds > 0 ? (last7Mortality / last7Birds) * 100 : 0;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      <MobileRedirect />
      <Topbar crumbs={[{ label: "Dashboard" }]} hasNotifications={openAlerts > 0} />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">

        {/* Greeting */}
        <div className="mb-7">
          <h1
            className="font-display text-[28px] font-normal tracking-tight"
            style={{ fontVariationSettings: "'opsz' 60" }}
          >
            {greeting}, <span style={{ color: "var(--text-2)" }}>{firstName}</span>
          </h1>
          <div className="mt-1 font-mono text-[13px]" style={{ color: "var(--text-2)" }}>
            {today} · Bendigo, VIC
          </div>
        </div>

        {/* AI insight banner */}
        <AiInsight alert={(aiInsightRes.data as Alert | null) ?? null} />

        {/* KPI grid */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Active flocks"      value={String(activeFlocks)} sub={`across ${activeFlocks} houses`} />
          <Stat label="Avg mortality (7d)" value={`${mortalityPct.toFixed(2)}%`}
                sub={`benchmark VIC: ${VIC_BENCHMARK_PCT.toFixed(2)}%`}
                deltaTone={mortalityPct > VIC_BENCHMARK_PCT ? "down" : "up"} />
          <Stat label="Visits this week"   value={String(visitsWeek)}
                sub={`${visitsTodayCount} today, ${upcomingCount} upcoming`} />
          <Stat label="Open alerts"        value={String(openAlerts)}
                sub={`${criticalCount} critical, ${warningCount} warning`}
                deltaTone={criticalCount > 0 ? "down" : "up"} />
        </div>

        {/* Two-col: alerts | today's visits */}
        <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
          <AlertsPanel alerts={openAlertsRes.data ?? []} />
          <TodayVisits visits={visitsToday as Visit[]} />
        </div>

        {/* Mortality + scoring trends */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MortalityChart series={series} benchmarkPct={VIC_BENCHMARK_PCT} />
          <ScoringTrends />
        </div>

      </div>
    </>
  );
}

function Stat({
  label, value, sub, deltaTone,
}: {
  label: string; value: string; sub: string; deltaTone?: "up" | "down" | "neu";
}) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      <div className="stat__sub">{sub}</div>
    </div>
  );
}
