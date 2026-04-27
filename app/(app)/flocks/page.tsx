import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { FlockActions } from "@/components/flocks/flock-actions";
import { FlocksFarmFilter } from "@/components/flocks/flocks-farm-filter";
import { IconHome } from "@/components/ui/icons";

export default async function FlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; farm?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? "active";
  const farmFilter = params.farm ?? "";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [flocksRes, farmsRes] = await Promise.all([
    supabase
      .from("flocks")
      .select(`
        id, reference, placement_date, expected_clearout, initial_count, active,
        breeds(name),
        houses!inner(
          id, name,
          farms!inner(id, name, client_id)
        )
      `)
      .eq("houses.farms.client_id", clientId)
      .order("placement_date", { ascending: false }),

    supabase
      .from("farms")
      .select("id, name")
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("name"),
  ]);

  const allFlocks = flocksRes.data ?? [];

  const filtered = allFlocks.filter(fl => {
    const house = Array.isArray(fl.houses) ? fl.houses[0] : fl.houses;
    if (!house) return false;
    const farm = Array.isArray(house.farms) ? house.farms[0] : house.farms;
    if (!farm) return false;

    if (tab === "active" && !fl.active) return false;
    if (tab === "past" && fl.active) return false;
    if (farmFilter && farm.id !== farmFilter) return false;
    return true;
  });

  const counts = {
    active: allFlocks.filter(f => f.active).length,
    past: allFlocks.filter(f => !f.active).length,
    all: allFlocks.length,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Flocks" },
        ]}
      />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Flocks</h1>
            <div className="page-header__sub">
              {counts.active} active · {counts.past} past
            </div>
          </div>
          <Link href="/flocks/new" className="btn btn--primary">
            + Place flock
          </Link>
        </div>

        <div className="mb-4 flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          {[
            { key: "active", label: "Active", count: counts.active },
            { key: "past",   label: "Past",   count: counts.past },
            { key: "all",    label: "All",    count: counts.all },
          ].map(t => {
            const isActive = tab === t.key;
            const params = new URLSearchParams();
            params.set("tab", t.key);
            if (farmFilter) params.set("farm", farmFilter);
            return (
              <Link
                key={t.key}
                href={`/flocks?${params.toString()}`}
                className="relative -mb-px flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors"
                style={{
                  color: isActive ? "var(--text)" : "var(--text-2)",
                  borderBottom: `2px solid ${isActive ? "var(--green-700)" : "transparent"}`,
                }}
              >
                {t.label}
                <span
                  className="rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
                  style={{
                    background: isActive ? "var(--green-100)" : "var(--surface-2)",
                    color: isActive ? "var(--green-700)" : "var(--text-3)",
                  }}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FlocksFarmFilter farms={farmsRes.data ?? []} current={farmFilter} currentTab={tab} />
        </div>

        <div className="card">
          {filtered.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm" style={{ color: "var(--text-2)" }}>
              {allFlocks.length === 0 ? (
                <>
                  No flocks yet.{" "}
                  <Link href="/flocks/new" style={{ color: "var(--green-700)" }}>Place your first flock →</Link>
                </>
              ) : (
                <>No flocks match the filters.</>
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
                  gridTemplateColumns: "120px 2fr 1fr 100px 100px 110px 80px",
                }}
              >
                <div>Reference</div>
                <div>House · Farm</div>
                <div>Breed</div>
                <div className="text-right">Placement</div>
                <div className="text-right">Age</div>
                <div className="text-right">Birds</div>
                <div className="text-right">Status</div>
              </div>
              {filtered.map(fl => {
                const house = Array.isArray(fl.houses) ? fl.houses[0] : fl.houses;
                const farm = house ? (Array.isArray(house.farms) ? house.farms[0] : house.farms) : null;
                const breed = Array.isArray(fl.breeds) ? fl.breeds[0] : fl.breeds;
                const placement = new Date(fl.placement_date);
                const ageDays = Math.round((Date.now() - placement.getTime()) / 86_400_000);

                return (
                  <div
                    key={fl.id}
                    className="grid items-center gap-4 border-b px-5 py-3.5 last:border-b-0"
                    style={{
                      borderColor: "var(--divider)",
                      gridTemplateColumns: "120px 2fr 1fr 100px 100px 110px 80px",
                    }}
                  >
                    <div className="font-mono text-[13px] font-medium">{fl.reference ?? "—"}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <IconHome size={13} />
                        <Link
                          href={`/farms/${farm?.id}`}
                          className="truncate text-[13px] hover:underline"
                          style={{ color: "var(--text)" }}
                        >
                          {farm?.name ?? "—"}
                        </Link>
                      </div>
                      <div className="ml-[21px] mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                        {house?.name ?? "—"}
                      </div>
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--text-2)" }}>
                      {breed?.name ?? "—"}
                    </div>
                    <div className="text-right font-mono text-[12px]">
                      {placement.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                    </div>
                    <div className="text-right font-mono text-[13px] tabular-nums">
                      {fl.active ? `${ageDays}d` : <span style={{ color: "var(--text-3)" }}>—</span>}
                    </div>
                    <div className="text-right font-mono text-[12px] tabular-nums">
                      {fl.initial_count?.toLocaleString() ?? "—"}
                    </div>
                    <div className="text-right">
                      <FlockActions flockId={fl.id} farmId={farm?.id ?? null} active={fl.active} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
