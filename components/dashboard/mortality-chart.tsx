import { IconTrendUp } from "@/components/ui/icons";

interface DailyPoint {
  date: string;            // ISO yyyy-mm-dd
  total_birds: number;     // sum of initial_count for active flocks that day
  mortality: number;       // sum of mortality across active flocks
}

interface Props {
  series: DailyPoint[];        // 14 points, oldest → newest
  benchmarkPct: number;        // VIC benchmark, e.g. 0.28
}

const W = 600;
const H = 120;
const PAD_TOP = 20;
const PAD_BOTTOM = 20;

export function MortalityChart({ series, benchmarkPct }: Props) {
  // Convert daily counts to a percentage rate.
  const rates = series.map(p => (p.total_birds > 0 ? (p.mortality / p.total_birds) * 100 : 0));
  const max = Math.max(...rates, benchmarkPct * 1.5, 0.5);
  const min = 0;

  const x = (i: number) => (i / (series.length - 1 || 1)) * W;
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM);

  const linePoints = rates.map((r, i) => `${x(i)},${y(r)}`).join(" L ");
  const areaPoints = `M0,${H} L${rates.map((r, i) => `${x(i)},${y(r)}`).join(" L ")} L${W},${H} Z`;

  // Stats for the bottom row
  const lastWeekAvg = average(rates.slice(-7));
  const priorWeekAvg = average(rates.slice(-14, -7));
  const delta = lastWeekAvg - priorWeekAvg;
  const benchDelta = lastWeekAvg - benchmarkPct;

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <IconTrendUp size={16} />
          Mortality, last 14 days
        </h2>
        <span className="text-xs" style={{ color: "var(--text-2)" }}>Across all flocks</span>
      </div>
      <div className="card__body">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" height={120}>
          <defs>
            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#336d4b" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#336d4b" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          <line x1="0" y1={H - PAD_BOTTOM} x2={W} y2={H - PAD_BOTTOM} stroke="#ecebe4" strokeWidth="1" />
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#ecebe4" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="0" y1={PAD_TOP} x2={W} y2={PAD_TOP} stroke="#ecebe4" strokeWidth="1" />

          {/* Benchmark line */}
          <line x1="0" y1={y(benchmarkPct)} x2={W} y2={y(benchmarkPct)}
                stroke="#8a9590" strokeWidth="1" strokeDasharray="3 3" />

          {/* Area + line */}
          <path d={areaPoints} fill="url(#sparkfill)" />
          <path d={`M${linePoints}`} stroke="#275a3d" strokeWidth="1.8" fill="none" />

          {/* Last point marker */}
          <circle cx={x(rates.length - 1)} cy={y(rates[rates.length - 1] ?? 0)} r="3.5" fill="#e27d2e" />
          <text x={W - 5} y={y(rates[rates.length - 1] ?? 0) - 8}
                textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="#5d6a60">
            {(rates[rates.length - 1] ?? 0).toFixed(2)}%
          </text>
          <text x="5" y={y(benchmarkPct) - 4}
                fontFamily="var(--font-mono)" fontSize="9" fill="#8a9590">
            benchmark {benchmarkPct.toFixed(2)}%
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-4">
          <Cell label="7-day avg" value={`${lastWeekAvg.toFixed(2)}%`} />
          <Cell label="vs prior 7d" value={delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                color={delta > 0 ? "var(--bad)" : delta < 0 ? "var(--ok)" : undefined} />
          <Cell label="vs VIC bench" value={benchDelta >= 0 ? `+${benchDelta.toFixed(2)}` : benchDelta.toFixed(2)}
                color={benchDelta > 0 ? "var(--warn)" : benchDelta < 0 ? "var(--ok)" : undefined} />
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: "22px", fontVariationSettings: "'opsz' 60", color }}>
        {value}
      </div>
    </div>
  );
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
