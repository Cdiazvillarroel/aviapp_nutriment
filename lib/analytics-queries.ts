import { createClient } from "@/lib/supabase/server";

export type DateRange = { start: Date; end: Date };

export function rangeFromPreset(preset: string): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();

  switch (preset) {
    case "last_3_months":
      start.setMonth(start.getMonth() - 3);
      break;
    case "last_6_months":
      start.setMonth(start.getMonth() - 6);
      break;
    case "last_12_months":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "ytd":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setFullYear(start.getFullYear() - 1);
  }

  return { start, end };
}

export interface CoccidiosisByAgeRow {
  age_days: number;
  acervulina: number;
  maxima: number;
  tenella: number;
  bird_samples: number;
}

export interface MonthlyAggregateRow {
  month_key: string;
  month_label: string;
  metrics: Record<string, number>;
}

export interface MortalityTrendRow {
  date: string;
  rate_per_1000: number;
}

interface ScoreRow {
  score: number | null;
  bird_number: number;
  scoring_definitions:
    | { name: string; module: string; scale_max: number }
    | { name: string; module: string; scale_max: number }[]
    | null;
  visits:
    | { scheduled_at: string }
    | { scheduled_at: string }[]
    | null;
  flocks:
    | { placement_date: string }
    | { placement_date: string }[]
    | null;
}

function unwrap<T>(x: T | T[] | null | undefined): T | null {
  if (x === null || x === undefined) return null;
  if (Array.isArray(x)) return x[0] ?? null;
  return x;
}

export async function fetchScoresInRange(clientId: string, range: DateRange) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_scores")
    .select(`
      score, bird_number,
      scoring_definitions(name, module, scale_max),
      visits!inner(scheduled_at, client_id),
      flocks(placement_date)
    `)
    .eq("visits.client_id", clientId)
    .gte("visits.scheduled_at", range.start.toISOString())
    .lte("visits.scheduled_at", range.end.toISOString())
    .not("score", "is", null);

  if (error) {
    console.error("fetchScoresInRange error:", error);
    return [];
  }

  return (data ?? []) as ScoreRow[];
}

export function aggregateCoccidiosisByAge(rows: ScoreRow[]): CoccidiosisByAgeRow[] {
  const buckets = new Map<number, {
    acervulina: number[];
    maxima: number[];
    tenella: number[];
    samples: Set<string>;
  }>();

  for (const r of rows) {
    const def = unwrap(r.scoring_definitions);
    const visit = unwrap(r.visits);
    const flock = unwrap(r.flocks);
    if (!def || !visit || !flock) continue;
    if (def.module !== "Coccidiosis") continue;

    const age = Math.round(
      (new Date(visit.scheduled_at).getTime() - new Date(flock.placement_date).getTime())
      / 86_400_000
    );
    if (age < 0 || age > 60) continue;

    if (!buckets.has(age)) {
      buckets.set(age, { acervulina: [], maxima: [], tenella: [], samples: new Set() });
    }
    const b = buckets.get(age)!;
    if (r.score === null) continue;

    if (def.name === "Eimeria acervulina") b.acervulina.push(r.score);
    if (def.name === "Eimeria maxima")     b.maxima.push(r.score);
    if (def.name === "Eimeria tenella")    b.tenella.push(r.score);

    b.samples.add(`${visit.scheduled_at}|${r.bird_number}`);
  }

  const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  return Array.from(buckets.entries())
    .map(([age, b]) => ({
      age_days: age,
      acervulina: Number(avg(b.acervulina).toFixed(2)),
      maxima: Number(avg(b.maxima).toFixed(2)),
      tenella: Number(avg(b.tenella).toFixed(2)),
      bird_samples: b.samples.size,
    }))
    .sort((a, b) => a.age_days - b.age_days);
}

export function aggregateByMonth(
  rows: ScoreRow[],
  defNames: string[],
): MonthlyAggregateRow[] {
  const buckets = new Map<string, Map<string, number[]>>();

  for (const r of rows) {
    const def = unwrap(r.scoring_definitions);
    const visit = unwrap(r.visits);
    if (!def || !visit) continue;
    if (!defNames.includes(def.name)) continue;
    if (r.score === null) continue;

    const d = new Date(visit.scheduled_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!buckets.has(monthKey)) buckets.set(monthKey, new Map());
    const monthBucket = buckets.get(monthKey)!;
    if (!monthBucket.has(def.name)) monthBucket.set(def.name, []);
    monthBucket.get(def.name)!.push(r.score);
  }

  const result: MonthlyAggregateRow[] = [];
  for (const [monthKey, defMap] of buckets) {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthLabel = date.toLocaleDateString("en-AU", { month: "short", year: "numeric" });

    const metrics: Record<string, number> = {};
    for (const [defName, scores] of defMap) {
      metrics[defName] = Number(
        (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      );
    }

    result.push({ month_key: monthKey, month_label: monthLabel, metrics });
  }

  return result.sort((a, b) => a.month_key.localeCompare(b.month_key));
}

export async function fetchMortalityTrend(
  clientId: string, range: DateRange
): Promise<MortalityTrendRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("daily_records")
    .select(`
      date, mortality_count,
      flocks!inner(initial_count, houses(farms!inner(client_id)))
    `)
    .eq("flocks.houses.farms.client_id", clientId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10))
    .order("date");

  if (error || !data) {
    console.error("fetchMortalityTrend error:", error);
    return [];
  }

  const weekly = new Map<string, { mortality: number; birds: number }>();
  for (const row of data as Array<{
    date: string;
    mortality_count: number | null;
    flocks: { initial_count: number | null } | { initial_count: number | null }[] | null;
  }>) {
    const flock = unwrap(row.flocks);
    if (!flock) continue;
    const initial = flock.initial_count ?? 0;
    if (initial === 0) continue;

    const d = new Date(row.date);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const weekKey = monday.toISOString().slice(0, 10);

    const bucket = weekly.get(weekKey) ?? { mortality: 0, birds: 0 };
    bucket.mortality += row.mortality_count ?? 0;
    bucket.birds += initial;
    weekly.set(weekKey, bucket);
  }

  return Array.from(weekly.entries())
    .map(([date, b]) => ({
      date,
      rate_per_1000: b.birds === 0 ? 0 : Number(((b.mortality / b.birds) * 1000).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchWithdrawalSnapshot(clientId: string) {
  const supabase = await createClient();

  const [activeFlocksRes, prescRes] = await Promise.all([
    supabase
      .from("flocks")
      .select("id, houses!inner(farms!inner(client_id))")
      .eq("active", true)
      .eq("houses.farms.client_id", clientId),

    supabase
      .from("prescriptions")
      .select("flock_id, end_date, withdrawal_days")
      .eq("client_id", clientId),
  ]);

  const activeFlocks = (activeFlocksRes.data ?? []).map(f => f.id);
  const prescriptions = prescRes.data ?? [];

  const now = Date.now();
  const flocksInWithdrawal = new Set<string>();
  for (const p of prescriptions) {
    const end = new Date(p.end_date).getTime();
    const withdrawalUntil = end + (p.withdrawal_days ?? 0) * 86_400_000;
    if (now <= withdrawalUntil && activeFlocks.includes(p.flock_id)) {
      flocksInWithdrawal.add(p.flock_id);
    }
  }

  return {
    in_withdrawal: flocksInWithdrawal.size,
    total_active: activeFlocks.length,
    cleared: Math.max(0, activeFlocks.length - flocksInWithdrawal.size),
  };
}
