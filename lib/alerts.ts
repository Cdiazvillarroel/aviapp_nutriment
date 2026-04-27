import { createClient } from "@/lib/supabase/server";

export type AlertSeverity = "high" | "medium" | "low";
export type AlertRuleKey =
  | "visit_overdue"
  | "no_initial_visit"
  | "withdrawal_expiring"
  | "withdrawal_active"
  | "critical_score"
  | "high_eimeria"
  | "bursa_damage"
  | "visit_starts_soon"
  | "empty_house";

export interface Alert {
  id: string;
  rule_key: AlertRuleKey;
  rule_label: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  entity_key: string;
  entity_kind: "farm" | "flock" | "prescription" | "house" | "visit";
  farm_id: string | null;
  farm_name: string | null;
  flock_id: string | null;
  flock_reference: string | null;
  visit_id: string | null;
  prescription_id: string | null;
  action_href: string;
  action_label: string;
  triggered_at: string;
  dismissed: boolean;
  dismissed_at: string | null;
}

const RULE_LABELS: Record<AlertRuleKey, string> = {
  visit_overdue:        "Visit overdue",
  no_initial_visit:     "No initial visit",
  withdrawal_expiring:  "Withdrawal expiring",
  withdrawal_active:    "Withdrawal active",
  critical_score:       "Critical score",
  high_eimeria:         "High Eimeria",
  bursa_damage:         "Bursa damage",
  visit_starts_soon:    "Visit starting soon",
  empty_house:          "Empty house",
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

interface DismissalRow {
  rule_key: string;
  entity_key: string;
  dismissed_at: string;
}

function unwrap<T>(x: T | T[] | null | undefined): T | null {
  if (x === null || x === undefined) return null;
  if (Array.isArray(x)) return x[0] ?? null;
  return x;
}

export async function computeAlerts(clientId: string): Promise<Alert[]> {
  const supabase = await createClient();
  const now = Date.now();

  const [
    farmsRes,
    flocksRes,
    visitsRes,
    prescsRes,
    scoresRes,
    dismissalsRes,
  ] = await Promise.all([
    supabase
      .from("farms")
      .select("id, name, latitude, longitude")
      .eq("client_id", clientId),

    supabase
      .from("flocks")
      .select(`
        id, reference, active, placement_date, expected_clearout,
        houses!inner(id, archived_at, farms!inner(id, name, client_id))
      `)
      .eq("houses.farms.client_id", clientId),

    supabase
      .from("visits")
      .select("id, farm_id, scheduled_at, type, status")
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false }),

    supabase
      .from("prescriptions")
      .select(`
        id, drug_name, end_date, withdrawal_days, flock_id,
        flocks(id, reference, active, houses(farm_id, farms(name)))
      `)
      .eq("client_id", clientId),

    supabase
      .from("visit_scores")
      .select(`
        score, bird_number,
        scoring_definitions(name, scale_max, module),
        visits!inner(id, farm_id, scheduled_at, client_id),
        flocks(id, reference, placement_date)
      `)
      .eq("visits.client_id", clientId)
      .gte("visits.scheduled_at", new Date(now - 30 * 86_400_000).toISOString())
      .not("score", "is", null),

    supabase
      .from("alert_dismissals")
      .select("rule_key, entity_key, dismissed_at")
      .eq("client_id", clientId),
  ]);

  const farms = (farmsRes.data ?? []) as Array<{ id: string; name: string }>;
  const flocks = (flocksRes.data ?? []) as Array<{
    id: string; reference: string | null; active: boolean;
    placement_date: string; expected_clearout: string | null;
    houses: {
      id: string; archived_at: string | null;
      farms: { id: string; name: string } | { id: string; name: string }[] | null;
    } | { id: string; archived_at: string | null; farms: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  }>;
  const visits = (visitsRes.data ?? []) as Array<{
    id: string; farm_id: string | null; scheduled_at: string;
    type: string; status: string;
  }>;
  const prescriptions = (prescsRes.data ?? []) as Array<{
    id: string; drug_name: string | null; end_date: string;
    withdrawal_days: number | null; flock_id: string;
    flocks: {
      id: string; reference: string | null; active: boolean;
      houses: { farm_id: string; farms: { name: string } | { name: string }[] | null } | { farm_id: string; farms: { name: string } | { name: string }[] | null }[] | null;
    } | { id: string; reference: string | null; active: boolean; houses: { farm_id: string; farms: { name: string } | { name: string }[] | null } | { farm_id: string; farms: { name: string } | { name: string }[] | null }[] | null }[] | null;
  }>;
  const scores = (scoresRes.data ?? []) as Array<{
    score: number | null; bird_number: number;
    scoring_definitions: { name: string; scale_max: number; module: string } | { name: string; scale_max: number; module: string }[] | null;
    visits: { id: string; farm_id: string | null; scheduled_at: string } | { id: string; farm_id: string | null; scheduled_at: string }[] | null;
    flocks: { id: string; reference: string | null; placement_date: string } | { id: string; reference: string | null; placement_date: string }[] | null;
  }>;
  const dismissals = (dismissalsRes.data ?? []) as DismissalRow[];

  const dismissalMap = new Map<string, string>();
  for (const d of dismissals) {
    dismissalMap.set(`${d.rule_key}|${d.entity_key}`, d.dismissed_at);
  }

  const farmById = new Map(farms.map(f => [f.id, f]));

  const latestVisitByFarm = new Map<string, { date: string; visitId: string }>();
  for (const v of visits) {
    if (!v.farm_id) continue;
    if (v.status !== "completed") continue;
    if (!latestVisitByFarm.has(v.farm_id)) {
      latestVisitByFarm.set(v.farm_id, { date: v.scheduled_at, visitId: v.id });
    }
  }

  const activeFlocksByFarm = new Map<string, typeof flocks>();
  for (const fl of flocks) {
    if (!fl.active) continue;
    const house = unwrap(fl.houses);
    if (!house) continue;
    const farm = unwrap(house.farms);
    if (!farm) continue;
    const list = activeFlocksByFarm.get(farm.id) ?? [];
    list.push(fl);
    activeFlocksByFarm.set(farm.id, list);
  }

  const out: Alert[] = [];

  function build(opts: {
    rule: AlertRuleKey;
    severity: AlertSeverity;
    title: string;
    body: string;
    entity_key: string;
    entity_kind: Alert["entity_kind"];
    farm_id?: string | null;
    farm_name?: string | null;
    flock_id?: string | null;
    flock_reference?: string | null;
    visit_id?: string | null;
    prescription_id?: string | null;
    action_href: string;
    action_label: string;
    triggered_at: string;
  }): Alert {
    const dismissedAt = dismissalMap.get(`${opts.rule}|${opts.entity_key}`) ?? null;
    return {
      id: `${opts.rule}__${opts.entity_key}`,
      rule_key: opts.rule,
      rule_label: RULE_LABELS[opts.rule],
      severity: opts.severity,
      title: opts.title,
      body: opts.body,
      entity_key: opts.entity_key,
      entity_kind: opts.entity_kind,
      farm_id: opts.farm_id ?? null,
      farm_name: opts.farm_name ?? null,
      flock_id: opts.flock_id ?? null,
      flock_reference: opts.flock_reference ?? null,
      visit_id: opts.visit_id ?? null,
      prescription_id: opts.prescription_id ?? null,
      action_href: opts.action_href,
      action_label: opts.action_label,
      triggered_at: opts.triggered_at,
      dismissed: dismissedAt !== null,
      dismissed_at: dismissedAt,
    };
  }

  // ===== RULE 1: Visit overdue =========================================
  for (const [farmId, farmFlocks] of activeFlocksByFarm) {
    if (farmFlocks.length === 0) continue;
    const farm = farmById.get(farmId);
    if (!farm) continue;

    const last = latestVisitByFarm.get(farmId);
    const thresholdMs = 14 * 86_400_000;
    let isOverdue: boolean;
    let daysSince: number;
    let triggeredAt: string;

    if (!last) {
      isOverdue = true;
      daysSince = -1;
      triggeredAt = new Date(now - thresholdMs).toISOString();
    } else {
      const ageMs = now - new Date(last.date).getTime();
      isOverdue = ageMs >= thresholdMs;
      daysSince = Math.floor(ageMs / 86_400_000);
      triggeredAt = new Date(new Date(last.date).getTime() + thresholdMs).toISOString();
    }

    if (isOverdue) {
      const fingerprint = last ? last.date.slice(0, 10) : "never";
      out.push(build({
        rule: "visit_overdue",
        severity: "high",
        title: `${farm.name} hasn't been visited`,
        body: daysSince === -1
          ? `No visits recorded yet for this farm.`
          : `${daysSince} days since last visit (${last!.date.slice(0, 10)}).`,
        entity_key: `farm:${farmId}|${fingerprint}`,
        entity_kind: "farm",
        farm_id: farmId,
        farm_name: farm.name,
        action_href: `/visits/new?farm=${farmId}`,
        action_label: "Schedule visit",
        triggered_at: triggeredAt,
      }));
    }
  }

  // ===== RULE 2: No initial visit ======================================
  for (const fl of flocks) {
    if (!fl.active) continue;
    const house = unwrap(fl.houses);
    if (!house) continue;
    const farm = unwrap(house.farms);
    if (!farm) continue;

    const placementMs = new Date(fl.placement_date).getTime();
    const ageDays = Math.floor((now - placementMs) / 86_400_000);
    if (ageDays < 7) continue;

    const farmVisitsAfterPlacement = visits.filter(v =>
      v.farm_id === farm.id &&
      v.status === "completed" &&
      new Date(v.scheduled_at).getTime() >= placementMs
    );
    if (farmVisitsAfterPlacement.length > 0) continue;

    out.push(build({
      rule: "no_initial_visit",
      severity: "high",
      title: `${fl.reference ?? "Flock"} - no initial visit`,
      body: `Placed ${ageDays} days ago at ${farm.name}. No visit recorded yet.`,
      entity_key: `flock:${fl.id}`,
      entity_kind: "flock",
      farm_id: farm.id,
      farm_name: farm.name,
      flock_id: fl.id,
      flock_reference: fl.reference,
      action_href: `/visits/new?farm=${farm.id}`,
      action_label: "Schedule visit",
      triggered_at: new Date(placementMs + 7 * 86_400_000).toISOString(),
    }));
  }

  // ===== RULE 3 & 4: Withdrawal expiring / active ======================
  for (const p of prescriptions) {
    const flock = unwrap(p.flocks);
    if (!flock) continue;
    const house = unwrap(flock.houses);
    if (!house) continue;
    const farm = unwrap(house.farms);
    const farmId = house.farm_id;
    const farmName = farm?.name ?? null;

    const endMs = new Date(p.end_date).getTime();
    const withdrawalUntil = endMs + (p.withdrawal_days ?? 0) * 86_400_000;
    if (withdrawalUntil < now) continue;

    const daysRemaining = Math.ceil((withdrawalUntil - now) / 86_400_000);

    if (daysRemaining <= 3) {
      out.push(build({
        rule: "withdrawal_expiring",
        severity: "medium",
        title: `${p.drug_name ?? "Prescription"} clearing in ${daysRemaining}d`,
        body: `${flock.reference ?? "Flock"} at ${farmName ?? "farm"} - withdrawal ends ${new Date(withdrawalUntil).toISOString().slice(0, 10)}.`,
        entity_key: `prescription:${p.id}`,
        entity_kind: "prescription",
        farm_id: farmId,
        farm_name: farmName,
        flock_id: flock.id,
        flock_reference: flock.reference,
        prescription_id: p.id,
        action_href: `/reports`,
        action_label: "View prescription",
        triggered_at: new Date(withdrawalUntil - 3 * 86_400_000).toISOString(),
      }));
    } else {
      out.push(build({
        rule: "withdrawal_active",
        severity: "low",
        title: `${p.drug_name ?? "Prescription"} active`,
        body: `${flock.reference ?? "Flock"} at ${farmName ?? "farm"} - ${daysRemaining}d until cleared.`,
        entity_key: `prescription:${p.id}`,
        entity_kind: "prescription",
        farm_id: farmId,
        farm_name: farmName,
        flock_id: flock.id,
        flock_reference: flock.reference,
        prescription_id: p.id,
        action_href: `/reports`,
        action_label: "View prescription",
        triggered_at: new Date(endMs).toISOString(),
      }));
    }
  }

  // ===== RULE 5 & 6 & 7: score-based ===================================
  const visitFlockKeyToData = new Map<string, {
    visit_id: string; visit_date: string; farm_id: string | null;
    flock_id: string | null; flock_reference: string | null;
    flock_placement: string | null;
    eimerias: number[];
    bursa_meters: { score: number; ageDays: number }[];
    critical: { defName: string; score: number; max: number }[];
  }>();

  for (const s of scores) {
    if (s.score === null) continue;
    const def = unwrap(s.scoring_definitions);
    const visit = unwrap(s.visits);
    const flock = unwrap(s.flocks);
    if (!def || !visit) continue;

    const key = `${visit.id}|${flock?.id ?? "none"}`;
    if (!visitFlockKeyToData.has(key)) {
      visitFlockKeyToData.set(key, {
        visit_id: visit.id,
        visit_date: visit.scheduled_at,
        farm_id: visit.farm_id,
        flock_id: flock?.id ?? null,
        flock_reference: flock?.reference ?? null,
        flock_placement: flock?.placement_date ?? null,
        eimerias: [],
        bursa_meters: [],
        critical: [],
      });
    }
    const bucket = visitFlockKeyToData.get(key)!;

    if (def.module === "Coccidiosis" && def.name.startsWith("Eimeria ")) {
      bucket.eimerias.push(s.score);
    }

    if (def.name === "Bursa Meter" && bucket.flock_placement) {
      const ageDays = Math.floor(
        (new Date(visit.scheduled_at).getTime() - new Date(bucket.flock_placement).getTime())
        / 86_400_000
      );
      bucket.bursa_meters.push({ score: s.score, ageDays });
    }

    const visitAgeMs = now - new Date(visit.scheduled_at).getTime();
    if (visitAgeMs <= 72 * 3600_000 && s.score >= 3 && def.scale_max >= 3) {
      bucket.critical.push({ defName: def.name, score: s.score, max: def.scale_max });
    }
  }

  for (const [, bucket] of visitFlockKeyToData) {
    const farm = bucket.farm_id ? farmById.get(bucket.farm_id) : null;
    const farmName = farm?.name ?? null;
    const visitDateStr = bucket.visit_date.slice(0, 10);

    if (bucket.critical.length > 0) {
      const top = bucket.critical[0];
      out.push(build({
        rule: "critical_score",
        severity: "high",
        title: `Critical ${top.defName} score`,
        body: `${bucket.flock_reference ?? "Flock"} at ${farmName ?? "farm"} - ${top.defName}: ${top.score}/${top.max}.`,
        entity_key: `visit:${bucket.visit_id}|${top.defName}`,
        entity_kind: "visit",
        farm_id: bucket.farm_id,
        farm_name: farmName,
        flock_id: bucket.flock_id,
        flock_reference: bucket.flock_reference,
        visit_id: bucket.visit_id,
        action_href: `/visits/${bucket.visit_id}`,
        action_label: "View visit",
        triggered_at: bucket.visit_date,
      }));
    }

    if (bucket.eimerias.length >= 3) {
      const avg = bucket.eimerias.reduce((a, b) => a + b, 0) / bucket.eimerias.length;
      const totalAvgPerBird = avg * 3;
      if (totalAvgPerBird >= 2) {
        out.push(build({
          rule: "high_eimeria",
          severity: "medium",
          title: `Elevated Eimeria load`,
          body: `${bucket.flock_reference ?? "Flock"} at ${farmName ?? "farm"} - avg ${avg.toFixed(1)}/Eimeria on ${visitDateStr}.`,
          entity_key: `visit:${bucket.visit_id}|eimeria`,
          entity_kind: "visit",
          farm_id: bucket.farm_id,
          farm_name: farmName,
          flock_id: bucket.flock_id,
          flock_reference: bucket.flock_reference,
          visit_id: bucket.visit_id,
          action_href: `/visits/${bucket.visit_id}`,
          action_label: "View visit",
          triggered_at: bucket.visit_date,
        }));
      }
    }

    const olderLowBursa = bucket.bursa_meters.filter(b => b.ageDays > 25 && b.score < 3);
    if (olderLowBursa.length > 0) {
      out.push(build({
        rule: "bursa_damage",
        severity: "medium",
        title: `Possible bursa damage`,
        body: `${bucket.flock_reference ?? "Flock"} at ${farmName ?? "farm"} - ${olderLowBursa.length} bird(s) with Bursa Meter <3 at >25d.`,
        entity_key: `visit:${bucket.visit_id}|bursa`,
        entity_kind: "visit",
        farm_id: bucket.farm_id,
        farm_name: farmName,
        flock_id: bucket.flock_id,
        flock_reference: bucket.flock_reference,
        visit_id: bucket.visit_id,
        action_href: `/visits/${bucket.visit_id}`,
        action_label: "View visit",
        triggered_at: bucket.visit_date,
      }));
    }
  }

  // ===== RULE 8: Visit starts soon (next 24h) ===========================
  for (const v of visits) {
    if (v.status === "completed") continue;
    if (!v.farm_id) continue;
    const startMs = new Date(v.scheduled_at).getTime();
    const inHours = (startMs - now) / 3600_000;
    if (inHours < 0 || inHours > 24) continue;

    const farm = farmById.get(v.farm_id);
    out.push(build({
      rule: "visit_starts_soon",
      severity: "low",
      title: `Visit at ${farm?.name ?? "farm"} in ${Math.round(inHours)}h`,
      body: `${new Date(v.scheduled_at).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} - ${v.type.replace("_", " ")}.`,
      entity_key: `visit:${v.id}`,
      entity_kind: "visit",
      farm_id: v.farm_id,
      farm_name: farm?.name ?? null,
      visit_id: v.id,
      action_href: `/visits/${v.id}`,
      action_label: "View visit",
      triggered_at: v.scheduled_at,
    }));
  }

  // ===== RULE 9: Empty house ============================================
  const housesById = new Map<string, { id: string; archived: boolean; farmId: string; farmName: string | null }>();
  const lastClearByHouse = new Map<string, number>();
  const activeByHouse = new Set<string>();
  for (const fl of flocks) {
    const house = unwrap(fl.houses);
    if (!house) continue;
    const farm = unwrap(house.farms);
    if (!farm) continue;
    if (!housesById.has(house.id)) {
      housesById.set(house.id, {
        id: house.id,
        archived: house.archived_at !== null,
        farmId: farm.id,
        farmName: farm.name,
      });
    }
    if (fl.active) {
      activeByHouse.add(house.id);
    } else if (fl.expected_clearout) {
      const clearMs = new Date(fl.expected_clearout).getTime();
      const cur = lastClearByHouse.get(house.id) ?? 0;
      if (clearMs > cur) lastClearByHouse.set(house.id, clearMs);
    }
  }
  for (const [houseId, h] of housesById) {
    if (h.archived) continue;
    if (activeByHouse.has(houseId)) continue;
    const lastClear = lastClearByHouse.get(houseId);
    if (!lastClear) continue;
    const daysEmpty = Math.floor((now - lastClear) / 86_400_000);
    if (daysEmpty < 21) continue;

    out.push(build({
      rule: "empty_house",
      severity: "low",
      title: `House empty for ${daysEmpty} days`,
      body: `${h.farmName ?? "Farm"} - house has been empty since ${new Date(lastClear).toISOString().slice(0, 10)}.`,
      entity_key: `house:${houseId}`,
      entity_kind: "house",
      farm_id: h.farmId,
      farm_name: h.farmName,
      action_href: `/farms/${h.farmId}`,
      action_label: "View farm",
      triggered_at: new Date(lastClear + 21 * 86_400_000).toISOString(),
    }));
  }

  out.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return b.triggered_at.localeCompare(a.triggered_at);
  });

  return out;
}

export function alertsCountByFarm(alerts: Alert[]): Map<string, { high: number; medium: number; low: number }> {
  const m = new Map<string, { high: number; medium: number; low: number }>();
  for (const a of alerts) {
    if (a.dismissed) continue;
    if (!a.farm_id) continue;
    const cur = m.get(a.farm_id) ?? { high: 0, medium: 0, low: 0 };
    cur[a.severity] += 1;
    m.set(a.farm_id, cur);
  }
  return m;
}
