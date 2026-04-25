import Link from "next/link";
import { IconSparkles } from "@/components/ui/icons";
import type { Alert } from "@/lib/types";

export function AiInsight({ alert }: { alert: Alert | null }) {
  if (!alert) return null;

  return (
    <div
      className="mb-6 grid gap-3.5 rounded-lg border p-5"
      style={{
        background: "linear-gradient(135deg, var(--green-50) 0%, #f4f1e8 100%)",
        borderColor: "var(--green-100)",
        gridTemplateColumns: "auto 1fr",
      }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-inv"
        style={{ background: "var(--green-800)" }}
      >
        <IconSparkles size={16} />
      </div>
      <div>
        <div
          className="mb-1.5 text-[11px] font-medium uppercase tracking-widest"
          style={{ color: "var(--green-700)" }}
        >
          Predictive insight
        </div>
        <p className="m-0 text-[13px] leading-relaxed">{alert.body}</p>
        <div className="mt-2.5 flex gap-2">
          <Link href="/visits" className="btn btn--primary btn--sm">
            Schedule visit
          </Link>
          <Link href={`/alerts/${alert.id}` as any} className="btn btn--sm">
            View full analysis
          </Link>
          <button className="btn btn--ghost btn--sm">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
