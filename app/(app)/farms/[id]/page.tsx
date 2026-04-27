import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { FarmMiniMapWrapper } from "@/components/farms/farm-mini-map-wrapper";
import { IconHome, IconClock, IconReport } from "@/components/ui/icons";

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

  const [farmRes, housesRes, recentVisitsRes, contactsRes] = await Promise.all([
    supabase
      .from("farms")
      .select("id, name, address, region, latitude, longitude")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("houses")
      .select(`
        id, name, custom_id, capacity, archived_at,
        flocks(id, reference, active, placement_date, breeds(name))
      `)
      .eq("farm_id", id)
      .order("created_at"),
    supabase
      .from("visits")
      .select("id, scheduled_at, type, status")
      .eq("farm_id", id)
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false })
      .limit(5),
    supabase
      .from("farm_contacts")
      .select("id, role, name, phone, email, notes")
      .eq("farm_id", id)
      .order("display_order"),
  ]);

  if (!farmRes.data) notFound();

  const farm = farmRes.data;
  const houses = (housesRes.data ?? []).filter(function (h) { return h.archived_at === null; });
  const recentVisits = recentVisitsRes.data ?? [];
  const contacts = contactsRes.data ?? [];

  const totalCapacity = houses.reduce(function (sum, h) {
    return sum + (h.capacity ?? 0);
  }, 0);

  const activeFlockCount = houses.reduce(function (sum, h) {
    const flocks = (h.flocks ?? []).filter(function (f) { return f.active; });
    return sum + flocks.length;
  }, 0);

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Farms", href: "/farms" },
          { label: farm.name },
        ]}
      />
      <div className="w-full max-w-[1100px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>{farm.name}</h1>
            <div className="page-header__sub">
              {farm.region ?? "No region"}
              {farm.address ? " - " + farm.address : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/visits/new?farm=${farm.id}`} className="btn btn--primary">
              <IconClock size={14} />
              Schedule visit
            </Link>
            <Link href={`/farms/${farm.id}/edit`} className="btn">
              Edit farm
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="grid grid-cols-3 gap-3">
            <div className="stat">
              <div className="stat__label">Houses</div>
              <div className="stat__value">{houses.length}</div>
              <div className="stat__sub">active sheds</div>
            </div>
            <div className="stat">
              <div className="stat__label">Active flocks</div>
              <div className="stat__value">{activeFlockCount}</div>
              <div className="stat__sub">in production</div>
            </div>
            <div className="stat">
              <div className="stat__label">Capacity</div>
              <div className="stat__value">{totalCapacity.toLocaleString()}</div>
              <div className="stat__sub">total birds</div>
            </div>
          </div>

          {farm.latitude !== null && farm.longitude !== null ? (
            <FarmMiniMapWrapper
              latitude={farm.latitude}
              longitude={farm.longitude}
              status="ok"
              height={140}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-md border"
              style={{
                borderColor: "var(--divider)",
                background: "var(--surface-2)",
                height: 140,
              }}
            >
              <div className="text-center">
                <div className="text-[12px]" style={{ color: "var(--text-2)" }}>
                  No location set
                </div>
                <Link
                  href={`/farms/${farm.id}/edit`}
                  className="mt-1 inline-block text-[11px]"
                  style={{ color: "var(--green-700)" }}
                >
                  Set location
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="card mb-6">
          <div className="card__header">
            <h2 className="card__title text-[13px] font-medium">
              <IconHome size={16} />
              Houses
            </h2>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {houses.length} active
            </span>
          </div>
          <div className="card__body card__body--flush">
            {houses.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px]"
                   style={{ color: "var(--text-2)" }}>
                No houses yet.{" "}
                <Link href={`/farms/${farm.id}/edit`} style={{ color: "var(--green-700)" }}>
                  Add some
                </Link>
              </div>
            ) : (
              houses.map(function (h) {
                const allFlocks = h.flocks ?? [];
                const activeFlocks = allFlocks.filter(function (f) { return f.active; });
                return (
                  <div
                    key={h.id}
                    className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
                    style={{
                      borderColor: "var(--divider)",
                      gridTemplateColumns: "180px 100px 1fr auto",
                    }}
                  >
                    <div>
                      <div className="text-[13px] font-medium">{h.name}</div>
                      {h.custom_id ? (
                        <div className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
                          {h.custom_id}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-2)" }}>
                      {h.capacity ? h.capacity.toLocaleString() + " birds" : "-"}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--text-2)" }}>
                      {activeFlocks.length === 0 ? (
                        <span style={{ color: "var(--text-3)" }}>Empty</span>
                      ) : (
                        activeFlocks.map(function (f) {
                          const breed = Array.isArray(f.breeds) ? f.breeds[0] : f.breeds;
                          const ageDays = Math.round(
                            (Date.now() - new Date(f.placement_date).getTime()) / 86400000
                          );
                          return (
                            <span key={f.id} className="mr-2 font-mono">
                              {f.reference || "Active flock"} - {breed?.name ?? "-"} - {ageDays}d
                            </span>
                          );
                        })
                      )}
                    </div>
                    <span className="pill pill--ok" style={{ fontSize: 9 }}>Active</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card mb-6">
          <div className="card__header">
            <h2 className="card__title text-[13px] font-medium">Contacts</h2>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {contacts.length}
            </span>
          </div>
          <div className="card__body card__body--flush">
            {contacts.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px]"
                   style={{ color: "var(--text-2)" }}>
                No contacts yet.{" "}
                <Link href={`/farms/${farm.id}/edit`} style={{ color: "var(--green-700)" }}>
                  Add some
                </Link>
              </div>
            ) : (
              contacts.map(function (c) {
                return (
                  <div
                    key={c.id}
                    className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
                    style={{
                      borderColor: "var(--divider)",
                      gridTemplateColumns: "140px 1fr 180px 200px",
                    }}
                  >
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wider"
                           style={{ color: "var(--text-3)" }}>
                        {c.role}
                      </div>
                    </div>
                    <div className="text-[13px] font-medium">{c.name}</div>
                    <div className="text-[12px]">
                      {c.phone ? (
                        <a href={"tel:" + c.phone} className="font-mono"
                           style={{ color: "var(--text-2)" }}>
                          {c.phone}
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-3)" }}>-</span>
                      )}
                    </div>
                    <div className="text-[12px]">
                      {c.email ? (
                        <a href={"mailto:" + c.email}
                           style={{ color: "var(--green-700)" }}>
                          {c.email}
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-3)" }}>-</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card__title text-[13px] font-medium">
              <IconReport size={16} />
              Recent visits
            </h2>
            <Link href={`/visits?farm=${farm.id}`}
                  className="text-[11px]"
                  style={{ color: "var(--green-700)" }}>
              View all
            </Link>
          </div>
          <div className="card__body card__body--flush">
            {recentVisits.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px]"
                   style={{ color: "var(--text-2)" }}>
                No visits recorded yet.
              </div>
            ) : (
              recentVisits.map(function (v) {
                const dateStr = new Date(v.scheduled_at).toLocaleDateString("en-AU", {
                  day: "2-digit", month: "short", year: "numeric",
                });
                return (
                  <Link
                    key={v.id}
                    href={`/visits/${v.id}`}
                    className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0 hover:bg-surface-2"
                    style={{
                      borderColor: "var(--divider)",
                      gridTemplateColumns: "120px 1fr auto",
                    }}
                  >
                    <div className="font-mono text-[12px]">{dateStr}</div>
                    <div className="text-[13px] capitalize">{v.type.replace("_", " ")}</div>
                    <span
                      className={"pill " + (
                        v.status === "completed" ? "pill--ok" :
                        v.status === "in_progress" ? "pill--warn" : ""
                      )}
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
    </>
  );
}
