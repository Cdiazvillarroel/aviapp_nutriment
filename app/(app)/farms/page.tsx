import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { FarmsFilters } from "@/components/farms/farms-filters";
import { IconHome, IconArrowRight } from "@/components/ui/icons";

interface FarmRow {
  id: string;
  name: string;
  reference_id: string | null;
  complex: { name: string | null; kind: string | null } | null;
  region: { name: string | null } | null;
  housesCount: number;
  activeFlocksCount: number;
  openAlertsCount: number;
  lastVisitAt: string | null;
}

export default async function FarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; complex?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const regionFilter = params.region ?? "";
  const complexFilter = params.complex ?? "";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [farmsRes, regionsRes, complexesRes] = await Promise.all([
    supabase
      .from("farms")
      .select(`
        id, name, reference_id, complex_id, region_id,
        complexes(name, kind),
        regions(name)
      `)
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("name", { ascending: true }),

    supabase
      .from("regions")
      .select("id, name")
      .eq("client_id", clientId)
      .order("name"),

    supabase
      .from("complexes")
      .select("id, name")
      .eq("client_id", clientId)
      .order("name"),
  ]);

  const farms = farmsRes.data ?? [];
  const farmIds = farms.map(f => f.id);
  const safeFarmIds = farmIds.length ? farmIds : ["00000000-0000-0000-0000-000000000000"];

  const [housesRes, flocksRes, alertsRes, visitsRes] = await Promise.all([
    supabase
      .from("houses")
      .select("farm_id")
      .in("farm_id", safeFarmIds)
      .is("archived_at", null),

    supabase
      .from("flocks")
      .select("id, houses!inner(farm_id)")
      .eq("active", true)
      .in("houses.farm_id", safeFarmIds),

    supabase
      .from("alerts")
      .select("farm_id, severity")
      .eq("client_id", clientId)
      .eq("status", "open"),

    supabase
      .from("visits")
      .select("farm_id, scheduled_at, status")
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false }),
  ]);

  const housesByFarm = new Map<string, number>();
  for (const h of housesRes.data ?? []) {
    housesByFarm.set(h.farm_id, (housesByFarm.get(h.farm_id) ?? 0) + 1);
  }

  const flocksByFarm = new Map<string, number>();
  for (const f of (flocksRes.data ?? []) as { houses: { farm_id: string } | { farm_id: string }[] }[]) {
    const house = Array.isArray(f.houses) ? f.houses[0] : f.houses;
    if (!house) continue;
    flocksByFarm.set(house.farm_id, (flocksByFarm.get(house.farm_id) ?? 0) + 1);
  }

  const alertsByFarm = new Map<string, number>();
  for (const a of alertsRes.data ?? []) {
    if (!a.farm_id) continue;
    alertsByFarm.set(a.farm_id, (alertsByFarm.get(a.farm_id) ?? 0) + 1);
  }

  const lastVisitByFarm = new Map<string, string>();
  for (const v of visitsRes.data ?? []) {
    if (!v.farm_id) continue;
    if (!lastVisitByFarm.has(v.farm_id)) {
      lastVisitByFarm.set(v.farm_id, v.scheduled_at);
    }
  }

  const rows: FarmRow[] = farms.map(f => {
    const complex = Array.isArray(f.complexes) ? f.complexes[0] : f.complexes;
    const region = Array.isArray(f.regions) ? f.regions[0] : f.regions;
    return {
      id: f.id,
      name: f.name,
      reference_id: f.reference_id,
      complex: complex ? { name: complex.name ?? null, kind: complex.kind ?? null } : null,
      region: region ? { name: region.name ?? null } : null,
      housesCount: housesByFarm.get(f.id) ?? 0,
      activeFlocksCount: flocksByFarm.get(f.id) ?? 0,
      openAlertsCount: alertsByFarm.get(f.id) ?? 0,
      lastVisitAt: lastVisitByFarm.get(f.id) ?? null,
    };
  });

  const filtered = rows.filter(r => {
    if (q && !r.name.toLowerCase().includes(q) && !r.reference_id?.toLowerCase().includes(q)) return false;
    if (regionFilter && r.region?.name !== regionFilter) return false;
    if (complexFilter && r.complex?.name !== complexFilter) return false;
    return true;
  });

  const totalActive = rows.reduce((sum, r) => sum + r.activeFlocksCount, 0);

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
              {filtered.length} of {rows.length} farms · {totalActive} active flocks across the operation
            </div>
          </div>
          <Link href="/farms/new" className="btn btn--primary">
            + Add farm
          </Link>
        </div>

        <FarmsFilters
          regions={(regionsRes.data ?? []).map(r => r.name)}
          complexes={(complexesRes.data ?? []).map(c => c.name)}
          currentQ={q}
          currentRegion={regionFilter}
          currentComplex={complexFilter}
        />

        <div className="card mt-5">
          {filtered.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm" style={{ color: "var(--text-2)" }}>
              {rows.length === 0 ? (
                <>
                  No farms yet.{" "}
                  <Link href="/farms/new" style={{ color: "var(--green-700)" }}>Add your first farm →</Link>
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
                  gridTemplateColumns: "2fr 1.2fr 1fr 80px 80px 110px 32px",
                }}
              >
                <div>Farm</div>
                <div>Region · Complex</div>
                <div>Last visit</div>
                <div className="text-right">Houses</div>
                <div className="text-right">Active flocks</div>
                <div className="text-right">Alerts</div>
                <div></div>
              </div>
              {filtered.map(row => (
                <FarmRowCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FarmRowCard({ row }: { row: FarmRow }) {
  const lastVisit = row.lastVisitAt ? relativeDays(row.lastVisitAt) : "—";
  const lastVisitTone = row.lastVisitAt ? toneForLastVisit(row.lastVisitAt) : "var(--text-3)";

  return (
    <Link
      href={`/farms/${row.id}`}
      className="grid items-center gap-4 border-b px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
      style={{
        borderColor: "var(--divider)",
        gridTemplateColumns: "2fr 1.2fr 1fr 80px 80px 110px 32px",
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <IconHome size={14} />
          <span className="truncate text-[13px] font-medium">{row.name}</span>
        </div>
        {row.reference_id && (
          <div className="ml-[22px] mt-0.5 font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
            {row.reference_id}
          </div>
        )}
      </div>
      <div className="min-w-0 text-[12px]" style={{ color: "var(--text-2)" }}>
        <div className="truncate">{row.region?.name ?? "—"}</div>
        <div className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
          {row.complex?.name ?? "—"}
        </div>
      </div>
      <div className="font-mono text-[12px]" style={{ color: lastVisitTone }}>
        {lastVisit}
      </div>
      <div className="text-right font-mono text-[13px] tabular-nums">{row.housesCount}</div>
      <div className="text-right font-mono text-[13px] tabular-nums">{row.activeFlocksCount}</div>
      <div className="text-right">
        {row.openAlertsCount > 0 ? (
          <span className="pill pill--bad">{row.openAlertsCount} open</span>
        ) : (
          <span style={{ color: "var(--text-3)" }}>—</span>
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
