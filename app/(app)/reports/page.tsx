import { Topbar } from "@/components/ui/topbar";
import Link from "next/link";

export default function ReportsPage() {
  return (
    <>
      <Topbar crumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Reports" },
      ]} />

      <div className="w-full max-w-[1280px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Reports</h1>
            <div className="page-header__sub">Coming in the next iteration.</div>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <div className="flex flex-col items-start gap-3 py-8">
              <div className="font-display text-xl"
                   style={{ fontVariationSettings: "'opsz' 48", color: "var(--text-2)" }}>
                Reports module
              </div>
              <p className="m-0 max-w-lg text-[13px]" style={{ color: "var(--text-2)" }}>
                Módulo APVMA con generación de reporte regulatorio. Diferenciador #3.
              </p>
              <p className="m-0 max-w-lg text-[13px]" style={{ color: "var(--text-3)" }}>
                The HTML mockup at <code className="font-mono text-[12px]">reports.html</code>
                in the design package shows the target layout. The Supabase tables and RLS
                policies needed are already created — only the UI is pending.
              </p>
              <Link href="/dashboard" className="btn btn--primary mt-2">
                ← Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
