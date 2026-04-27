import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { IconTrendUp } from "@/components/ui/icons";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { HealthMonitorGrid } from "@/components/analytics/health-monitor-grid";
import { CocciByAgeChart } from "@/components/analytics/cocci-by-age-chart";
import { MortalityTrendChart } from "@/components/analytics/mortality-trend-chart";
import { WithdrawalChart } from "@/components/analytics/withdrawal-chart";
import {
  rangeFromPreset,
  fetchScoresInRange,
  aggregateCoccidiosisByAge,
  aggregateByMonth,
  fetchMortalityTrend,
  fetchWithdrawalSnapshot,
} from "@/lib/analytics-queries";

const RANGE_OPTIONS = [
  { key: "last_3_months",  label: "Last 3 months" },
  { key: "last_6_months",  label: "Last 6 months" },
  { key: "last_12_months", label: "Last 12 months" },
  { key: "ytd",            label: "Year to date" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeKey } = await searchParams;
  const currentRangeKey = rangeKey ?? "last_12_months";
  const range = rangeFromPreset(currentRangeKey);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [scoreRows, mortalityData, withdrawalSnapshot] = await Promise.all([
    fetchScoresInRange(clientId, range),
    fetchMortalityTrend(clientId, range),
    fetchWithdrawalSnapshot(clientId),
  ]);

  const cocciByAge = aggregateCoccidiosisByAge(scoreRows);

  const bursaMonthly      = aggregateByMonth(scoreRows, ["Bursa Meter"]);
  const skeletalMonthly   = aggregateByMonth(scoreRows, ["Detached Cartilage", "Tibial Dyschondroplasia"]);
  const cocciMonthly      = aggregateByMonth(scoreRows, ["Eimeria acervulina", "Eimeria maxima", "Eimeria tenella"]);
  const respiratoryMonthly = aggregateByMonth(scoreRows, ["Trachea"]);

  const totalScores = scoreRows.length;
  const uniqueBirds = new Set(scoreRows.map(r => {
    const v = Array.isArray(r.visits) ? r.visits[0] : r.visits;
    return `${v?.scheduled_at ?? ""}|${r.bird_number}`;
  })).size;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Analytics" },
        ]}
      />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Analytics</h1>
            <div className="page-header__sub">
              Health monitor, coccidiosis trends, mortality, and withdrawal compliance.
            </div>
          </div>
          <AnalyticsFilters current={currentRangeKey} options={RANGE_OPTIONS} />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="stat">
            <div className="stat__label">Birds scored</div>
            <div className="stat__value">{uniqueBirds}</div>
            <div className="stat__sub">in selected period</div>
          </div>
          <div className="stat">
            <div className="stat__label">Total score points</div>
            <div className="stat__value">{totalScores}</div>
            <div className="stat__sub">across all items</div>
          </div>
          <div className="stat">
            <div className="stat__label">Active flocks</div>
            <div className="stat__value">{withdrawalSnapshot.total_active}</div>
            <div className="stat__sub">
              {withdrawalSnapshot.in_withdrawal} in withdrawal
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Mortality weeks</div>
            <div className="stat__value">{mortalityData.length}</div>
            <div className="stat__sub">tracked</div>
          </div>
        </div>

        <SectionHeader>Health Monitor</SectionHeader>
        <HealthMonitorGrid
          bursaData={bursaMonthly}
          skeletalData={skeletalMonthly}
          cocciData={cocciMonthly}
          respiratoryData={respiratoryMonthly}
        />

        <SectionHeader className="mt-8">Coccidiosis scores by bird age</SectionHeader>
        <div className="card">
          <div className="card__header">
            <h3 className="card__title text-[13px] font-medium">
              <IconTrendUp size={16} />
              Average Eimeria scores by bird age (days)
            </h3>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {cocciByAge.length} age buckets
            </span>
          </div>
          <div className="card__body" style={{ padding: 16 }}>
            <CocciByAgeChart data={cocciByAge} />
          </div>
        </div>

        <SectionHeader className="mt-8">Mortality trend</SectionHeader>
        <div className="card">
          <div className="card__header">
            <h3 className="card__title text-[13px] font-medium">
              Weekly mortality rate per 1000 birds
            </h3>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              vs Victoria broiler benchmark
            </span>
          </div>
          <div className="card__body" style={{ padding: 16 }}>
            <MortalityTrendChart data={mortalityData} />
          </div>
        </div>

        <SectionHeader className="mt-8">Withdrawal compliance</SectionHeader>
        <div className="card">
          <div className="card__header">
            <h3 className="card__title text-[13px] font-medium">
              Active flocks vs withdrawal status
            </h3>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              real-time snapshot
            </span>
          </div>
          <div className="card__body" style={{ padding: 16 }}>
            <WithdrawalChart
              inWithdrawal={withdrawalSnapshot.in_withdrawal}
              cleared={withdrawalSnapshot.cleared}
              totalActive={withdrawalSnapshot.total_active}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeader({
  children, className = "",
}: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <h2
      className={`mb-3 font-display text-[18px] font-normal ${className}`}
      style={{ fontVariationSettings: "'opsz' 36", color: "var(--text)" }}
    >
      {children}
    </h2>
  );
}
