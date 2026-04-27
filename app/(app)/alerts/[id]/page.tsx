import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { computeAlerts } from "@/lib/alerts";
import { dismissAlert, undismissAlert } from "@/app/(app)/alerts/actions";

const SEVERITY_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  high:   { label: "High severity", bg: "#fbe6e3", fg: "#a02020" },
  medium: { label: "Medium severity", bg: "#fdf3ea", fg: "#c66b1f" },
  low:    { label: "Low severity", bg: "#e9efe1", fg: "#3a6b48" },
};

export default async function AlertDetailPage({
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

  const all = await computeAlerts(membership!.client_id);
  const alert = all.find(function (a) { return a.id === id; });

  if (!alert) {
    return (
      <>
        <Topbar
          crumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Alerts", href: "/alerts" },
            { label: "Not found" },
          ]}
        />
        <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
          <div className="card">
            <div className="card__body text-center" style={{ padding: 60 }}>
              <h2 className="font-display text-[18px] font-medium m-0 mb-2">
                Alert resolved
              </h2>
              <p className="m-0 mb-4 text-[13px]" style={{ color: "var(--text-2)" }}>
                This alert is no longer active. The underlying condition may have changed.
              </p>
              <Link href="/alerts" className="btn btn--primary">
                Back to alerts
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const sev = SEVERITY_LABELS[alert.severity];

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Alerts", href: "/alerts" },
          { label: alert.rule_label },
        ]}
      />
      <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ background: sev.bg, color: sev.fg }}
              >
                {sev.label}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
              >
                {alert.rule_label}
              </span>
              {alert.dismissed ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
                >
                  Dismissed
                </span>
              ) : null}
            </div>
            <h1>{alert.title}</h1>
            <div className="page-header__sub">{alert.body}</div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card__header">
            <h2 className="card__title text-[13px] font-medium">Context</h2>
          </div>
          <div className="card__body card__body--flush">
            {alert.farm_id ? (
              <Row label="Farm">
                <Link
                  href={`/farms/${alert.farm_id}`}
                  className="text-[13px] font-medium"
                  style={{ color: "var(--green-700)" }}
                >
                  {alert.farm_name ?? "View farm"}
                </Link>
              </Row>
            ) : null}
            {alert.flock_id ? (
              <Row label="Flock">
                <span className="font-mono text-[12px]">
                  {alert.flock_reference ?? alert.flock_id}
                </span>
              </Row>
            ) : null}
            {alert.visit_id ? (
              <Row label="Visit">
                <Link
                  href={`/visits/${alert.visit_id}`}
                  className="text-[12px]"
                  style={{ color: "var(--green-700)" }}
                >
                  Open visit
                </Link>
              </Row>
            ) : null}
            <Row label="Detected">
              <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
                {new Date(alert.triggered_at).toLocaleString("en-AU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
            </Row>
            {alert.dismissed && alert.dismissed_at ? (
              <Row label="Dismissed">
                <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
                  {new Date(alert.dismissed_at).toLocaleString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </Row>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={alert.action_href} className="btn btn--primary">
            {alert.action_label}
          </Link>

          <form action={alert.dismissed ? undismissAlert : dismissAlert} className="contents">
            <input type="hidden" name="rule_key" value={alert.rule_key} />
            <input type="hidden" name="entity_key" value={alert.entity_key} />
            <button type="submit" className="btn">
              {alert.dismissed ? "Restore alert" : "Dismiss alert"}
            </button>
          </form>

          <Link href="/alerts" className="btn">
            Back to alerts
          </Link>
        </div>

        <p className="mt-5 text-[11px]" style={{ color: "var(--text-3)" }}>
          Alerts are computed in real time from your data. Dismissing an alert hides it,
          but if the underlying condition changes (e.g. a new visit happens), a fresh
          alert may appear.
        </p>
      </div>
    </>
  );
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-3 border-b px-5 py-3 last:border-b-0"
      style={{
        borderColor: "var(--divider)",
        gridTemplateColumns: "120px 1fr",
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-widest"
        style={{ color: "var(--text-3)" }}
      >
        {props.label}
      </div>
      <div>{props.children}</div>
    </div>
  );
}
