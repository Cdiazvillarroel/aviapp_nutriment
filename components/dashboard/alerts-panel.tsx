import Link from "next/link";
import { IconAlert, IconAlertCircle, IconClock, IconReport, IconTrendUp } from "@/components/ui/icons";
import { relativeTime } from "@/lib/utils";
import type { Alert, AlertSeverity, AlertSource } from "@/lib/types";

interface Props {
  alerts: (Alert & { farms?: { name: string; regions?: { name: string } | null } | null })[];
}

const SEV_CLASS: Record<AlertSeverity, string> = {
  critical: "pill--bad",
  warning:  "pill--warn",
  info:     "pill--info",
};

const ICON_FOR_SOURCE: Record<AlertSource, React.ComponentType<{ size?: number }>> = {
  ai_predictive: IconAlertCircle,
  rule_engine:   IconTrendUp,
  manual:        IconAlert,
  overdue:       IconClock,
};

const ICON_BG: Record<AlertSeverity, { bg: string; fg: string }> = {
  critical: { bg: "var(--bad-bg)",  fg: "var(--bad)" },
  warning:  { bg: "var(--warn-bg)", fg: "var(--warn)" },
  info:     { bg: "var(--info-bg)", fg: "var(--info)" },
};

export function AlertsPanel({ alerts }: Props) {
  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <IconAlert size={16} />
          Open alerts
        </h2>
        <Link href="/alerts" className="card__action">
          View all →
        </Link>
      </div>
      <div className="card__body card__body--flush">
        {alerts.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-2)" }}>
            No open alerts. Quiet day in the sheds.
          </div>
        ) : (
          alerts.map((a) => {
            const Icon = ICON_FOR_SOURCE[a.source] ?? IconAlert;
            const colors = ICON_BG[a.severity];

            return (
              <div
                key={a.id}
                className="grid gap-3 border-b px-5 py-3.5 last:border-b-0 hover:bg-surface-2"
                style={{ borderColor: "var(--divider)", gridTemplateColumns: "auto 1fr auto" }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: colors.bg, color: colors.fg }}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{a.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs"
                       style={{ color: "var(--text-2)" }}>
                    <span className={`pill ${SEV_CLASS[a.severity]}`}>{a.severity}</span>
                    {a.farms?.name && <span>{a.farms.name}</span>}
                    {a.farms?.regions?.name && (
                      <>
                        <span style={{ color: "var(--text-3)" }}>·</span>
                        <span>{a.farms.regions.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                  {relativeTime(a.detected_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
