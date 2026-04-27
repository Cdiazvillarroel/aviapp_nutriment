import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { IconReport, IconCalendar, IconAlert } from "@/components/ui/icons";
import { ReportsFilters } from "@/components/reports/reports-filters";
import { PrescriptionRow } from "@/components/reports/prescription-row";

interface Prescription {
  id: string;
  drug_name: string;
  active_ingredient: string | null;
  dose: string | null;
  administration: string | null;
  start_date: string;
  end_date: string;
  withdrawal_days: number;
  indication: string | null;
  vet_name_override: string | null;
  vet_license: string | null;
  flock_id: string;
  flock_reference: string | null;
  farm_name: string;
  withdrawal_until: Date;
  isInWithdrawal: boolean;
}

const QUARTERS = [
  { key: "q1", label: "Q1 (Jan–Mar)", start: 0,  end: 2  },
  { key: "q2", label: "Q2 (Apr–Jun)", start: 3,  end: 5  },
  { key: "q3", label: "Q3 (Jul–Sep)", start: 6,  end: 8  },
  { key: "q4", label: "Q4 (Oct–Dec)", start: 9,  end: 11 },
];

function getCurrentQuarterRange(): { start: Date; end: Date; label: string; key: string } {
  const now = new Date();
  const q = QUARTERS[Math.floor(now.getMonth() / 3)];
  const start = new Date(now.getFullYear(), q.start, 1);
  const end = new Date(now.getFullYear(), q.end + 1, 0, 23, 59, 59);
  return { start, end, label: `${q.label} ${now.getFullYear()}`, key: `${now.getFullYear()}-${q.key}` };
}

function parseQuarterParam(param: string | undefined): { start: Date; end: Date; label: string; key: string } {
  if (!param) return getCurrentQuarterRange();
  const [yearStr, qKey] = param.split("-");
  const year = parseInt(yearStr, 10);
  const q = QUARTERS.find(x => x.key === qKey);
  if (!year || !q) return getCurrentQuarterRange();
  const start = new Date(year, q.start, 1);
  const end = new Date(year, q.end + 1, 0, 23, 59, 59);
  return { start, end, label: `${q.label} ${year}`, key: param };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; farm?: string; flock?: string }>;
}) {
  const params = await searchParams;
  const { start, end, label: quarterLabel, key: quarterKey } = parseQuarterParam(params.q);
  const farmFilter = params.farm ?? "";
  const flockFilter = params.flock ?? "";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [prescriptionsRes, farmsRes] = await Promise.all([
    supabase
      .from("prescriptions")
      .select(`
        id, drug_name, active_ingredient, dose, administration,
        start_date, end_date, withdrawal_days,
        indication, reason,
        vet_name_override, vet_license,
        flock_id,
        flocks(reference, houses(farm_id, farms(id, name)))
      `)
      .eq("client_id", clientId)
      .order("start_date", { ascending: false }),

    supabase
      .from("farms")
      .select("id, name")
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("name"),
  ]);

  const allRaw = prescriptionsRes.data ?? [];
  const now = new Date();

  const all: Prescription[] = allRaw.map(p => {
    const flock = Array.isArray(p.flocks) ? p.flocks[0] : p.flocks;
    const house = flock ? (Array.isArray(flock.houses) ? flock.houses[0] : flock.houses) : null;
    const farm = house ? (Array.isArray(house.farms) ? house.farms[0] : house.farms) : null;

    const endDate = new Date(p.end_date);
    const withdrawalUntil = new Date(endDate);
    withdrawalUntil.setDate(withdrawalUntil.getDate() + (p.withdrawal_days ?? 0));

    return {
      id: p.id,
      drug_name: p.drug_name,
      active_ingredient: p.active_ingredient,
      dose: p.dose,
      administration: p.administration,
      start_date: p.start_date,
      end_date: p.end_date,
      withdrawal_days: p.withdrawal_days ?? 0,
      indication: (p.indication as string | null) ?? (p.reason as string | null) ?? null,
      vet_name_override: p.vet_name_override,
      vet_license: p.vet_license,
      flock_id: p.flock_id,
      flock_reference: flock?.reference ?? null,
      farm_name: farm?.name ?? "—",
      withdrawal_until: withdrawalUntil,
      isInWithdrawal: now <= withdrawalUntil,
    };
  });

  const filtered = all.filter(p => {
    const startD = new Date(p.start_date);
    if (startD < start || startD > end) return false;
    if (flockFilter && p.flock_id !== flockFilter) return false;
    if (farmFilter && p.farm_name !== farmsRes.data?.find(f => f.id === farmFilter)?.name) return false;
    return true;
  });

  const drugBreakdown = new Map<string, { count: number; days: number }>();
  for (const p of filtered) {
    const days = Math.max(1, Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86_400_000) + 1);
    const existing = drugBreakdown.get(p.drug_name) ?? { count: 0, days: 0 };
    drugBreakdown.set(p.drug_name, { count: existing.count + 1, days: existing.days + days });
  }
  const drugRanking = Array.from(drugBreakdown.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const flocksAffected = new Set(filtered.map(p => p.flock_id)).size;
  const inWithdrawalCount = all.filter(p => p.isInWithdrawal).length;

  const quarterOptions: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (i * 3));
    const q = QUARTERS[Math.floor(d.getMonth() / 3)];
    const key = `${d.getFullYear()}-${q.key}`;
    quarterOptions.push({ key, label: `${q.label} ${d.getFullYear()}` });
  }

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports" },
        ]}
      />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Reports & APVMA</h1>
            <div className="page-header__sub">
              Antimicrobial use, prescriptions, and withdrawal tracking.
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/reports/${quarterKey}`} className="btn">
              Generate APVMA report
            </Link>
            <Link href="/prescriptions/new" className="btn btn--primary">
              + Record prescription
            </Link>
          </div>
        </div>

        <ReportsFilters
          farms={farmsRes.data ?? []}
          quarterOptions={quarterOptions}
          currentQuarter={quarterKey}
          currentFarm={farmFilter}
        />

        {inWithdrawalCount > 0 && (
          <div
            className="mt-4 grid gap-3 rounded-lg border p-4"
            style={{
              background: "var(--warn-bg)",
              borderColor: "var(--warn)",
              gridTemplateColumns: "auto 1fr",
            }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "var(--warn)", color: "var(--text-inv)" }}
            >
              <IconAlert size={16} />
            </div>
            <div>
              <div className="text-[13px] font-medium" style={{ color: "var(--warn)" }}>
                {inWithdrawalCount} flock{inWithdrawalCount === 1 ? "" : "s"} in withdrawal period
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--warn)" }}>
                These flocks must not be sent to slaughter until their withdrawal period ends. See the table below.
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="stat">
            <div className="stat__label">{quarterLabel}</div>
            <div className="stat__value">{filtered.length}</div>
            <div className="stat__sub">prescriptions in period</div>
          </div>
          <div className="stat">
            <div className="stat__label">Flocks affected</div>
            <div className="stat__value">{flocksAffected}</div>
            <div className="stat__sub">unique flocks treated</div>
          </div>
          <div className="stat">
            <div className="stat__label">Top drug</div>
            <div className="stat__value" style={{ fontSize: 18 }}>
              {drugRanking[0]?.[0] ?? "—"}
            </div>
            <div className="stat__sub">
              {drugRanking[0] ? `${drugRanking[0][1].count} prescriptions` : "no data"}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">In withdrawal</div>
            <div className="stat__value">{inWithdrawalCount}</div>
            <div className="stat__sub">across all periods</div>
          </div>
        </div>

        {drugRanking.length > 0 && (
          <div className="mt-6 card">
            <div className="card__header">
              <h2 className="card__title">
                <IconReport size={16} />
                Drug breakdown — {quarterLabel}
              </h2>
            </div>
            <div className="card__body card__body--flush">
              {drugRanking.map(([drug, stats]) => (
                <div
                  key={drug}
                  className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
                  style={{ borderColor: "var(--divider)", gridTemplateColumns: "2fr 80px 80px" }}
                >
                  <div className="text-[13px] font-medium">{drug}</div>
                  <div className="text-right font-mono text-[12px] tabular-nums">
                    {stats.count} <span style={{ color: "var(--text-3)" }}>presc.</span>
                  </div>
                  <div className="text-right font-mono text-[12px] tabular-nums">
                    {stats.days} <span style={{ color: "var(--text-3)" }}>days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 card">
          <div className="card__header">
            <h2 className="card__title">
              <IconCalendar size={16} />
              All prescriptions — {quarterLabel}
            </h2>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {filtered.length} record{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="card__body card__body--flush">
            {filtered.length === 0 ? (
              <div className="px-5 py-14 text-center text-sm" style={{ color: "var(--text-2)" }}>
                {all.length === 0 ? (
                  <>
                    No prescriptions yet.{" "}
                    <Link href="/prescriptions/new" style={{ color: "var(--green-700)" }}>
                      Record the first one →
                    </Link>
                  </>
                ) : (
                  <>No prescriptions match the current filters.</>
                )}
              </div>
            ) : (
              <>
                <div
                  className="grid items-center gap-3 border-b px-5 py-3 text-[11px] font-medium uppercase tracking-wider"
                  style={{
                    borderColor: "var(--divider)",
                    background: "var(--surface-2)",
                    color: "var(--text-3)",
                    gridTemplateColumns: "1.6fr 1.4fr 100px 100px 110px 80px",
                  }}
                >
                  <div>Drug & indication</div>
                  <div>Flock · Farm</div>
                  <div className="text-right">Start</div>
                  <div className="text-right">End</div>
                  <div className="text-right">Withdrawal</div>
                  <div></div>
                </div>
                {filtered.map(p => (
                  <PrescriptionRow key={p.id} prescription={p} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
