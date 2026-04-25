import { IconCheckSquare } from "@/components/ui/icons";

interface Trend {
  label: string;
  sub: string;
  trend: "up" | "down" | "flat";
  value: string;
  values: number[];                   // 6 points for the mini sparkline
}

// For now this is static demo data — once we have visit_scores populated,
// we'll compute these from real aggregations (group by definition,
// avg score over the last 7 days).
const DEMO: Trend[] = [
  { label: "Footpad dermatitis",      sub: "stable across this week",   trend: "flat", value: "0.4", values: [15, 12, 14, 9, 7, 5] },
  { label: "Coccidiosis (Eimeria max)", sub: "↑ rising in 3 farms",     trend: "up",   value: "1.2", values: [15, 14, 11, 9, 6, 4] },
  { label: "Hock burn",                sub: "stable",                    trend: "flat", value: "0.6", values: [12, 11, 12, 11, 12, 11] },
  { label: "Gait score",               sub: "improving",                 trend: "down", value: "1.1", values: [8, 9, 11, 12, 14, 15] },
  { label: "Intestinal lesions",       sub: "2 farms exceed threshold",  trend: "up",   value: "0.9", values: [14, 12, 11, 8, 7, 5] },
];

const TREND_COLOR = {
  up:   "#b53d27",
  down: "#3f8b5c",
  flat: "#5d6a60",
} as const;

export function ScoringTrends() {
  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <IconCheckSquare size={16} />
          Recent scoring activity
        </h2>
      </div>
      <div className="card__body card__body--flush">
        {DEMO.map((t) => (
          <div
            key={t.label}
            className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
            style={{ borderColor: "var(--divider)", gridTemplateColumns: "1fr 80px 60px" }}
          >
            <div className="text-[13px]">
              {t.label}
              <small className="block text-[11px]" style={{ color: "var(--text-3)" }}>
                {t.sub}
              </small>
            </div>
            <svg width="80" height="20" viewBox="0 0 80 20">
              <polyline
                points={t.values.map((v, i) => `${(i / (t.values.length - 1)) * 80},${v}`).join(" ")}
                stroke={TREND_COLOR[t.trend]}
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
            <div className="text-right font-mono text-[13px] tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
