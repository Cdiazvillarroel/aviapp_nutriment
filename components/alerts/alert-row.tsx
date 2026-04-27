"use client";

import Link from "next/link";
import { dismissAlert, undismissAlert } from "@/app/(app)/alerts/actions";
import type { Alert, AlertSeverity } from "@/lib/alerts";

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; fg: string; border: string }> = {
  high:   { bg: "#fbe6e3", fg: "#a02020", border: "#a02020" },
  medium: { bg: "#fdf3ea", fg: "#c66b1f", border: "#c66b1f" },
  low:    { bg: "#e9efe1", fg: "#3a6b48", border: "#3a6b48" },
};

interface Props {
  alert: Alert;
  showDismiss?: boolean;
  compact?: boolean;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    const future = Math.abs(ms);
    if (future < 3600_000) return `in ${Math.round(future / 60_000)}m`;
    if (future < 86_400_000) return `in ${Math.round(future / 3600_000)}h`;
    return `in ${Math.round(future / 86_400_000)}d`;
  }
  if (ms < 60_000) return "now";
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function AlertRow(props: Props) {
  const a = props.alert;
  const sev = SEVERITY_STYLES[a.severity];
  const showDismiss = props.showDismiss !== false;

  return (
    <div
      className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
      style={{
        borderColor: "var(--divider)",
        gridTemplateColumns: props.compact ? "auto 1fr auto" : "auto 1fr auto auto",
        opacity: a.dismissed ? 0.55 : 1,
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: sev.fg }}
        />
        <span
          className="text-[8px] font-medium uppercase tracking-wider"
          style={{ color: sev.fg }}
        >
          {a.severity}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/alerts/${a.id}`}
            className="text-[13px] font-medium hover:underline"
            style={{ color: a.dismissed ? "var(--text-2)" : "var(--text)" }}
          >
            {a.title}
          </Link>
          {a.dismissed ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
              style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
            >
              Dismissed
            </span>
          ) : null}
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
          {a.body}
          {" - "}
          <span style={{ color: "var(--text-3)" }}>{timeAgo(a.triggered_at)}</span>
        </div>
      </div>

      {!props.compact ? (
        <Link
          href={a.action_href}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium"
          style={{
            background: "var(--surface-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {a.action_label}
        </Link>
      ) : null}

      {showDismiss ? (
        <form action={a.dismissed ? undismissAlert : dismissAlert}>
          <input type="hidden" name="rule_key" value={a.rule_key} />
          <input type="hidden" name="entity_key" value={a.entity_key} />
          <button
            type="submit"
            className="rounded-md px-2 py-1 text-[11px]"
            style={{ color: "var(--text-3)" }}
            title={a.dismissed ? "Undismiss" : "Dismiss"}
          >
            {a.dismissed ? "Restore" : "Dismiss"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
