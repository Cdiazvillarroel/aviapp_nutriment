"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Props {
  farms: { id: string; name: string }[];
  currentTab: string;
  currentFarm: string;
  currentType: string;
  counts: { today: number; upcoming: number; past: number; all: number };
}

const TABS = [
  { key: "today",    label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past",     label: "Past" },
  { key: "all",      label: "All" },
];

const TYPES = [
  { key: "routine",     label: "Routine" },
  { key: "sanitary",    label: "Sanitary" },
  { key: "post_mortem", label: "Post-mortem" },
  { key: "audit",       label: "Audit" },
];

export function VisitsFilters({ farms, currentTab, currentFarm, currentType, counts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v); else params.delete(k);
    }
    startTransition(() => router.push(`/visits?${params.toString()}`));
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map(t => {
          const isActive = currentTab === t.key;
          const count = counts[t.key as keyof typeof counts];
          return (
            <button
              key={t.key}
              onClick={() => update({ tab: t.key })}
              disabled={pending}
              className="relative -mb-px flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                color: isActive ? "var(--text)" : "var(--text-2)",
                borderBottom: `2px solid ${isActive ? "var(--green-700)" : "transparent"}`,
              }}
            >
              {t.label}
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
                style={{
                  background: isActive ? "var(--green-100)" : "var(--surface-2)",
                  color: isActive ? "var(--green-700)" : "var(--text-3)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="select" style={{ width: "auto" }} value={currentFarm} onChange={(e) => update({ farm: e.target.value })}>
          <option value="">All farms</option>
          {farms.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <select className="select" style={{ width: "auto" }} value={currentType} onChange={(e) => update({ type: e.target.value })}>
          <option value="">All types</option>
          {TYPES.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        {(currentFarm || currentType) && (
          <button onClick={() => update({ farm: "", type: "" })} className="btn btn--ghost btn--sm" disabled={pending}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
