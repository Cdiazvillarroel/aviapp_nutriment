import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { computeAlerts } from "@/lib/alerts";
import { AlertRow } from "@/components/alerts/alert-row";

interface SearchParams {
  view?: string;
  severity?: string;
  rule?: string;
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = params.view ?? "active";
  const severity = params.severity ?? "all";
  const rule = params.rule ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const all = await computeAlerts(membership!.client_id);

  const filtered = all.filter(function (a) {
    if (view === "active" && a.dismissed) return false;
    if (view === "dismissed" && !a.dismissed) return false;
    if (severity !== "all" && a.severity !== severity) return false;
    if (rule !== "all" && a.rule_key !== rule) return false;
    return true;
  });

  const counts = {
    active: all.filter(function (a) { return !a.dismissed; }).length,
    dismissed: all.filter(function (a) { return a.dismissed; }).length,
    all: all.length,
    high: all.filter(function (a) { return !a.dismissed && a.severity === "high"; }).length,
    medium: all.filter(function (a) { return !a.dismissed && a.severity === "medium"; }).length,
    low: all.filter(function (a) { return !a.dismissed && a.severity === "low"; }).length,
  };

  function buildHref(patch: Partial<SearchParams>): string {
    const sp = new URLSearchParams();
    const merged = Object.assign(
      { view: view, severity: severity, rule: rule },
      patch
    );
    if (merged.view !== "active") sp.set("view", merged.view);
    if (merged.severity !== "all") sp.set("severity", merged.severity);
    if (merged.rule !== "all") sp.set("rule", merged.rule);
    const qs = sp.toString();
    return qs ? `/alerts?${qs}` : "/alerts";
  }

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Alerts" },
        ]}
      />
      <div className="w-full max-w-[920px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Alerts</h1>
            <div className="page-header__sub">
              {counts.active} active alert{counts.active === 1 ? "" : "s"}
              {counts.high > 0 ? " - " + counts.high + " high severity" : ""}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <SevStat label="High" count={counts.high} color="#a02020" />
          <SevStat label="Medium" count={counts.medium} color="#c66b1f" />
          <SevStat label="Low" count={counts.low} color="#3a6b48" />
        </div>

        <div
          className="mb-3 flex items-center gap-1 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          {[
            { key: "active", label: "Active", count: counts.active },
            { key: "dismissed", label: "Dismissed", count: counts.dismissed },
            { key: "all", label: "All", count: counts.all },
          ].map(function (t) {
            const isActive = view === t.key;
            return (
              <Link
                key={t.key}
                href={buildHref({ view: t.key })}
                className="relative -mb-px flex items-center gap-2 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors"
                style={{
                  color: isActive ? "var(--text)" : "var(--text-2)",
                  borderBottom: `2px solid ${isActive ? "var(--green-700)" : "transparent"}`,
                }}
              >
                {t.label}
                <span
                  className="rounded-full px-1.5 py-px text-[10px] font-mono tabular-nums"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-3)",
                  }}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
          <span style={{ color: "var(--text-3)" }} className="font-medium uppercase tracking-wider">
            Filters:
          </span>
          {[
            { key: "all", label: "All severities" },
            { key: "high", label: "High" },
            { key: "medium", label: "Medium" },
            { key: "low", label: "Low" },
          ].map(function (s) {
            const isActive = severity === s.key;
            return (
              <Link
                key={s.key}
                href={buildHref({ severity: s.key })}
                className="rounded-full px-2.5 py-0.5"
                style={{
                  background: isActive ? "var(--green-100)" : "var(--surface-2)",
                  color: isActive ? "var(--green-700)" : "var(--text-2)",
                  fontWeight: isActive ? 500 : 400,
                  border: `1px solid ${isActive ? "var(--green-700)" : "transparent"}`,
                }}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        <div className="card">
          <div className="card__body card__body--flush">
            {filtered.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="font-display text-[18px] font-medium m-0 mb-1">
                  All clear
                </div>
                <p className="m-0 text-[12px]" style={{ color: "var(--text-3)" }}>
                  {view === "active"
                    ? "No active alerts match your filters."
                    : view === "dismissed"
                      ? "Nothing has been dismissed yet."
                      : "No alerts to show."}
                </p>
              </div>
            ) : (
              filtered.map(function (a) {
                return <AlertRow key={a.id} alert={a} />;
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SevStat(props: { label: string; count: number; color: string }) {
  return (
    <div
      className="rounded-md border p-3"
      style={{
        borderColor: "var(--divider)",
        background: "var(--surface)",
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-widest"
        style={{ color: props.color }}
      >
        {props.label}
      </div>
      <div
        className="mt-1 font-display text-[24px] leading-none"
        style={{ color: props.count > 0 ? "var(--text)" : "var(--text-3)" }}
      >
        {props.count}
      </div>
    </div>
  );
}
