import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { computeAlerts, alertsCountByFarm } from "@/lib/alerts";
import { IconHome, IconArrowRight } from "@/components/ui/icons";

interface FarmRow {
  id: string;
  name: string;
  address: string | null;
  region: string | null;
  hasLocation: boolean;
  housesCount: number;
  activeFlocksCount: number;
  openAlertsCount: number;
  lastVisitAt: string | null;
}

export default async function FarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const regionFilter = params.region ?? "";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  // Step 1: just the farms (no joins)
  const { data: farmsData, error: farmsErr } = await supabase
    .from("farms")
    .select("id, name, address, region, latitude, longitude")
    .eq("client_id", clientId)
    .order("name", { ascending: true });

  if (farmsErr) {
    return (
      <div className="p-8">
        <pre style={{ background: "#fbe6e3", padding: 16, borderRadius: 6 }}>
          Error fetching farms: {JSON.stringify(farmsErr, null, 2)}
        </pre>
      </div>
    );
  }

  const farms = farmsData ?? [];
  const farmIds = farms.map(function (f) { return f.id; });
  const safeFarmIds = farmIds.length > 0 ? farmIds : ["00000000-0000-0000-0000-000000000000"];

  // Step 2: houses (separate query)
  const { data: housesData } = await supabase
    .from("houses")
    .select("id, farm_id, archived_at")
    .in("farm_id", safeFarmIds);

  const housesByFarm = new Map<string, number>();
  for (const h of housesData ?? []) {
    if (h.archived_at !== null) continue;
    housesByFarm.set(h.farm_id, (housesByFarm.get(h.farm_id) ?? 0) + 1);
  }

  // Step 3: active flocks count per farm (separate query)
  const { data: flocksData } = await supabase
    .from("flocks")
    .select("id, active, house_id, houses(farm_id)")
    .eq("active", true);

  const flocksByFarm = new Map<string, number>();
  for (const fl of (flocksData ?? []) as Array<{ houses: { farm_id: string } | { farm_id: string }[] | null }>) {
    const house = Array.isArray(fl.houses) ? fl.houses[0] : fl.houses;
    if (!house) continue;
    flocksByFarm.set(house.farm_id, (flocksByFarm.get(house.farm_id) ?? 0) + 1);
  }

  // Step 4: last completed visit per farm
  const { data: visitsData } = await supabase
    .from("visits")
    .select("farm_id, scheduled_at")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false });

  const lastVisitByFarm = new Map<string, string>();
  for (const v of visitsData ?? []) {
    if (!v.farm_id) continue;
    if (!lastVisitByFarm.has(v.farm_id)) {
      lastVisitByFarm.set(v.farm_id, v.scheduled_at);
    }
  }

  // Step 5: alerts (engine)
  const alerts = await computeAlerts(clientId);
  const alertCountByFarm = alertsCountByFarm(alerts);

  const rows: FarmRow[] = farms.map(function (f) {
    const farmAlerts = alertCountByFarm.get(f.id) ?? { high: 0, medium: 0, low: 0 };
    return {
      id: f.id,
      name: f.name,
      address: f.address,
      region: f.region,
      hasLocation: f.latitude !== null && f.longitude !== null,
      housesCount: housesByFarm.get(f.id) ?? 0,
      activeFlocksCount: flocksByFarm.get(f.id) ?? 0,
      openAlertsCount: farmAlerts.high + farmAlerts.medium,
      lastVisitAt: lastVisitByFarm.get(f.id) ?? null,
    };
  });

  const allRegions = Array.from(new Set(
    rows.map(function (r) { return r.region; })
        .filter(function (r): r is string { return r !== null && r.trim() !== ""; })
  )).sort();

  const filtered = rows.filter(function (r) {
    if (q && !r.name.toLowerCase().includes(q) && !(r.address?.toLowerCase().includes(q) ?? false)) return false;
    if (regionFilter && r.region !== regionFilter) return false;
    return true;
  });

  const totalActive = rows.reduce(function (sum, r) { return sum + r.activeFlocksCount; }, 0);

  function buildHref(patch: { q?: string; region?: string }): string {
    const sp = new URLSearchParams();
    const newQ = patch.q !== undefined ? patch.q : q;
    const newRegion = patch.region !== undefined ? patch.region : regionFilter;
    if (newQ) sp.set("q", newQ);
    if (newRegion) sp.set("region", newRegion);
    const qs = sp.toString();
    return qs ? `/farms?${qs}` : "/farms";
  }

  return (
    <>
      <Topbar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Farms" }]}
      />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Farms</h1>
            <div className="page-header__sub">
              {filtered.length} of {rows.length} farm{rows.length === 1 ? "" : "s"} - {totalActive} active flock{totalActive === 1 ? "" : "s"}
            </div>
          </div>
          <Link href="/farms/new" className="btn btn--primary">
            + Add farm
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form action="/farms" method="GET" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search farms..."
              className="input"
              style={{ width: 220, fontSize: 12 }}
            />
            {regionFilter ? (
              <input type="hidden" name="region" value={regionFilter} />
            ) : null}
            <button type="submit" className="btn" style={{ fontSize: 11 }}>Search</button>
          </form>

          {allRegions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-3)" }}>
                Region:
              </span>
              <Link
                href={buildHref({ region: "" })}
                className="rounded-full px-2.5 py-0.5 text-[11px]"
                style={{
                  background: regionFilter === "" ? "var(--green-100)" : "var(--surface-2)",
                  color: regionFilter === "" ? "var(--green-700)" : "var(--text-2)",
                  border: `1px solid ${regionFilter === "" ? "var(--green-700)" : "transparent"}`,
                }}
              >
                All
              </Link>
              {allRegions.map(function (r) {
                const isActive = regionFilter === r;
                return (
                  <Link
                    key={r}
                    href={buildHref({ region: r })}
                    className="rounded-full px-2.5 py-0.5 text-[11px]"
                    style={{
                      background: isActive ? "var(--green-100)" : "var(--surface-2)",
                      color: isActive ? "var(--green-700)" : "var(--text-2)",
                      border: `1px solid ${isActive ? "var(--green-700)" : "transparent"}`,
                    }}
                  >
                    {r}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="card">
          {filtered.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm" style={{ color: "var(--text-2)" }}>
              {rows.length === 0 ? (
                <>
                  No farms yet.{" "}
                  <Link href="/farms/new" style={{ color: "var(--green-700)" }}>
                    Add your first farm
                  </Link>
                </>
              ) : (
                <>No farms match your filters.</>
              )}
            </div>
          ) : (
            <div className="card__body card__body--flush">
              <div
                className="grid items-center gap-4 border-b px-5 py-3 text-[11px] font-medium uppercase tracking-wider"
                style={{
                  borderColor: "var(--divider)",
                  background: "var(--surface-2)",
                  color: "var(--text-3)",
                  gridTemplateColumns: "2fr 1.2fr 1fr 80px 80px 100px 32px",
                }}
              >
                <div>Farm</div>
                <div>Region</div>
                <div>Last visit</div>
                <div className="text-right">Houses</div>
                <div className="text-right">Active</div>
                <div className="text-right">Alerts</div>
                <div></div>
              </div>
              {filtered.map(function (row) {
                return <FarmRowCard key={row.id} row={row} />;
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FarmRowCard(props: { row: FarmRow }) {
  const row = props.row;
  const lastVisit = row.lastVisitAt ? relativeDays(row.lastVisitAt) : "Never";
  const lastVisitTone = row.lastVisitAt ? toneForLastVisit(row.lastVisitAt) : "var(--text-3)";

  return (
    <Link
      href={`/farms/${row.id}`}
      className="grid items-center gap-4 border-b px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
      style={{
        borderColor: "var(--divider)",
        gridTemplateColumns: "2fr 1.2fr 1fr 80px 80px 100px 32px",
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <IconHome size={14} />
          <span className="truncate text-[13px] font-medium">{row.name}</span>
        </div>
        {row.address ? (
          <div className="ml-[22px] mt-0.5 truncate text-[11px]"
               style={{ color: "var(--text-3)" }}>
            {row.address}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 text-[12px]" style={{ color: "var(--text-2)" }}>
        <div className="truncate">{row.region ?? "-"}</div>
        {!row.hasLocation ? (
          <div className="truncate text-[10px]" style={{ color: "var(--orange-500)" }}>
            No location set
          </div>
        ) : null}
      </div>
      <div className="font-mono text-[12px]" style={{ color: lastVisitTone }}>
        {lastVisit}
      </div>
      <div className="text-right font-mono text-[13px] tabular-nums">{row.housesCount}</div>
      <div className="text-right font-mono text-[13px] tabular-nums">
        {row.activeFlocksCount > 0 ? (
          <span style={{ color: "var(--ok)" }}>{row.activeFlocksCount}</span>
        ) : (
          <span style={{ color: "var(--text-3)" }}>0</span>
        )}
      </div>
      <div className="text-right">
        {row.openAlertsCount > 0 ? (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              background: "#fbe6e3",
              color: "#a02020",
            }}
          >
            {row.openAlertsCount} alert{row.openAlertsCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span style={{ color: "var(--text-3)" }}>-</span>
        )}
      </div>
      <div className="text-right" style={{ color: "var(--text-3)" }}>
        <IconArrowRight size={14} />
      </div>
    </Link>
  );
}

function relativeDays(input: string): string {
  const d = new Date(input);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function toneForLastVisit(input: string): string {
  const d = new Date(input);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 7) return "var(--ok)";
  if (days <= 14) return "var(--warn)";
  return "var(--bad)";
}
