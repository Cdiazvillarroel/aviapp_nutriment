import Link from "next/link";
import { IconCalendar } from "@/components/ui/icons";
import { timeOf, visitTypeLabel } from "@/lib/utils";
import type { Visit, VisitStatus } from "@/lib/types";

const STATUS_DOT: Record<VisitStatus, string> = {
  completed:    "dot-status--ok",
  in_progress:  "dot-status--bad",
  planned:      "",
  cancelled:    "",
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  completed:   "Completed",
  in_progress: "In progress",
  planned:     "Planned",
  cancelled:   "Cancelled",
};

export function TodayVisits({ visits }: { visits: Visit[] }) {
  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <IconCalendar size={16} />
          Today&apos;s visits
        </h2>
        <Link href="/visits" className="card__action">All →</Link>
      </div>
      <div className="card__body card__body--flush">
        {visits.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-2)" }}>
            No visits scheduled for today.
          </div>
        ) : (
          visits.map((v) => (
            <div
              key={v.id}
              className="grid items-center gap-3.5 border-b px-5 py-3.5 last:border-b-0"
              style={{ borderColor: "var(--divider)", gridTemplateColumns: "56px 1fr auto" }}
            >
              <div className="font-mono text-[13px] font-medium">
                {timeOf(v.scheduled_at)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">
                  {v.farms?.name ?? "Unknown farm"}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs"
                     style={{ color: "var(--text-2)" }}>
                  <span className={`dot-status ${STATUS_DOT[v.status]}`} />
                  <span>{STATUS_LABEL[v.status]}</span>
                  <span style={{ color: "var(--text-3)" }}>·</span>
                  <span>{visitTypeLabel(v.type)}</span>
                </div>
              </div>
              <Link href={`/scoring?visit=${v.id}` as any} className="card__action">
                Open
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
