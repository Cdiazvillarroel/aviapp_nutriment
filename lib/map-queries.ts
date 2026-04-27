import { createClient } from "@/lib/supabase/server";

export interface ActiveWithdrawal {
  drug: string;
  days_remaining: number;
  flock_ref: string | null;
}

export interface MapFarm {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  status: "ok" | "warn" | "alert";
  active_flocks_count: number;
  occupied_houses: number;
  total_houses: number;
  last_visit_at: string | null;
  last_visit_type: string | null;
  scheduled_today: boolean;
  active_withdrawals: ActiveWithdrawal[];
}

function unwrap<T>(x: T | T[] | null | undefined): T | null {
  if (x === null || x === undefined) return null;
  if (Array.isArray(x)) return x[0] ?? null;
  return x;
}

export async function fetchFarmsForMap(clientId: string): Promise<MapFarm[]> {
  const supabase = await createClient();

  const [farmsRes, visitsRes, prescsRes] = await Promise.all([
    supabase
      .from("farms")
      .select(`
        id, name, address, latitude, longitude,
        houses(id, archived_at, flocks(id, reference, active))
      `)
      .eq("client_id", clientId)
      .not("latitude", "is", null)
      .not("longitude", "is", null),

    supabase
      .from("visits")
      .select("id, farm_id, scheduled_at, type, status")
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false }),

    supabase
      .from("prescriptions")
      .select(`
        id, drug_name, end_date, withdrawal_days,
        flocks(id, reference, houses(farm_id))
      `)
      .eq("client_id", clientId),
  ]);

  const rawFarms = (farmsRes.data ?? []) as Array<{
    id: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    houses: Array<{
      id: string;
      archived_at: string | null;
      flocks: Array<{ id: string; reference: string | null; active: boolean }> | null;
    }> | null;
  }>;
  const visits = (visitsRes.data ?? []) as Array<{
    farm_id: string | null;
    scheduled_at: string;
    type: string;
    status: string;
  }>;
  const prescriptions = (prescsRes.data ?? []) as Array<{
    drug_name: string | null;
    end_date: string;
    withdrawal_days: number | null;
    flocks: { id: string; reference: string | null; houses: { farm_id: string } | { farm_id: string }[] | null }
          | { id: string; reference: string | null; houses: { farm_id: string } | { farm_id: string }[] | null }[]
          | null;
  }>;

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
  const now = Date.now();

  const latestCompletedByFarm = new Map<string, { date: string; type: string }>();
  const todayVisitsByFarm = new Set<string>();

  for (const v of visits) {
    if (!v.farm_id) continue;
    if (v.status === "completed" && !latestCompletedByFarm.has(v.farm_id)) {
      latestCompletedByFarm.set(v.farm_id, { date: v.scheduled_at, type: v.type });
    }
    const t = new Date(v.scheduled_at).getTime();
    if (t >= startOfDay.getTime() && t <= endOfDay.getTime() && v.status !== "completed") {
      todayVisitsByFarm.add(v.farm_id);
    }
  }

  const withdrawalsByFarm = new Map<string, ActiveWithdrawal[]>();
  for (const p of prescriptions) {
    const flock = unwrap(p.flocks);
    if (!flock) continue;
    const house = unwrap(flock.houses);
    if (!house) continue;

    const endTime = new Date(p.end_date).getTime();
    const withdrawalUntil = endTime + (p.withdrawal_days ?? 0) * 86_400_000;
    if (withdrawalUntil < now) continue;

    const daysRemaining = Math.max(1, Math.ceil((withdrawalUntil - now) / 86_400_000));
    const farmId = house.farm_id;
    if (!withdrawalsByFarm.has(farmId)) withdrawalsByFarm.set(farmId, []);
    withdrawalsByFarm.get(farmId)!.push({
      drug: p.drug_name ?? "—",
      days_remaining: daysRemaining,
      flock_ref: flock.reference,
    });
  }

  return rawFarms.map(f => {
    const houses = (f.houses ?? []).filter(h => !h.archived_at);
    const allFlocks = houses.flatMap(h => h.flocks ?? []);
    const activeFlocks = allFlocks.filter(fl => fl.active);
    const occupiedHouses = houses.filter(h => (h.flocks ?? []).some(fl => fl.active)).length;

    const lastVisit = latestCompletedByFarm.get(f.id);
    const isOverdue =
      activeFlocks.length > 0 &&
      (!lastVisit || new Date(lastVisit.date).getTime() < fourteenDaysAgo);
    const withdrawals = withdrawalsByFarm.get(f.id) ?? [];

    let status: "ok" | "warn" | "alert";
    if (isOverdue) status = "alert";
    else if (withdrawals.length > 0) status = "warn";
    else status = "ok";

    return {
      id: f.id,
      name: f.name,
      address: f.address,
      latitude: f.latitude,
      longitude: f.longitude,
      status,
      active_flocks_count: activeFlocks.length,
      occupied_houses: occupiedHouses,
      total_houses: houses.length,
      last_visit_at: lastVisit?.date ?? null,
      last_visit_type: lastVisit?.type ?? null,
      scheduled_today: todayVisitsByFarm.has(f.id),
      active_withdrawals: withdrawals,
    };
  });
}
