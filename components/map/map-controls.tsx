"use client";

import { STATUS_COLORS, type FarmStatus } from "./map-icons";

export type FilterKey = "all" | FarmStatus | "today";

interface Counts {
  all: number;
  ok: number;
  warn: number;
  alert: number;
  today: number;
}

interface Props {
  search: string;
  onSearchChange: (s: string) => void;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  counts: Counts;
  tileLayer: "satellite" | "street";
  onTileLayerChange: (t: "satellite" | "street") => void;
}

export function MapControls({
  search, onSearchChange, filter, onFilterChange, counts,
  tileLayer, onTileLayerChange,
}: Props) {
  const filterOptions: Array<{ key: FilterKey; label: string; color: string }> = [
    { key: "all",   label: "All farms",      color: "#888" },
    { key: "ok",    label: "All clear",      color: STATUS_COLORS.ok.fill },
    { key: "warn",  label: "In withdrawal",  color: STATUS_COLORS.warn.fill },
    { key: "alert", label: "Overdue",        color: STATUS_COLORS.alert.fill },
    { key: "today", label: "Visits today",   color: "#3a6b48" },
  ];

  return (
    <>
      <div
        className="absolute left-3 top-3 z-[1000] w-[260px] overflow-hidden rounded-lg shadow-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="border-b p-2.5" style={{ borderColor: "var(--divider)" }}>
          <input
            type="text"
            placeholder="Search farms..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input w-full"
            style={{ fontSize: 13 }}
          />
        </div>
        <div>
          {filterOptions.map(opt => {
            const isActive = filter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onFilterChange(opt.key)}
                className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-[12px] transition-colors last:border-b-0"
                style={{
                  borderColor: "var(--divider)",
                  background: isActive ? "var(--green-100)" : "transparent",
                  color: isActive ? "var(--green-700)" : "var(--text)",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ background: opt.color }}
                  />
                  {opt.label}
                </span>
                <span className="font-mono tabular-nums opacity-60">
                  {counts[opt.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="absolute left-3 z-[1000] flex overflow-hidden rounded-lg shadow-lg"
        style={{
          bottom: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {(["satellite", "street"] as const).map(t => {
          const isActive = tileLayer === t;
          return (
            <button
              key={t}
              onClick={() => onTileLayerChange(t)}
              className="px-3 py-1.5 text-[11px] capitalize transition-colors"
              style={{
                background: isActive ? "var(--green-700)" : "transparent",
                color: isActive ? "var(--text-inv)" : "var(--text)",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
    </>
  );
}
