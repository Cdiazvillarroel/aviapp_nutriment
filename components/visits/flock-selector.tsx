"use client";

import { useState } from "react";

interface Props {
  flocks: { id: string; reference: string | null; house_name: string }[];
  initiallySelected?: string[];
}

export function FlockSelector({ flocks, initiallySelected }: Props) {
  // If initiallySelected is provided (edit mode), use that.
  // Otherwise default to all selected (create mode).
  const initial = initiallySelected !== undefined
    ? new Set(initiallySelected)
    : new Set(flocks.map(f => f.id));

  const [selected, setSelected] = useState<Set<string>>(initial);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div
        className="mb-2 flex items-center justify-between rounded-md border px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-2)" }}>
          {selected.size} of {flocks.length} selected
        </span>
        <span className="flex gap-2 text-[11px]">
          <button type="button" onClick={() => setSelected(new Set(flocks.map(f => f.id)))} style={{ color: "var(--green-700)" }}>
            Select all
          </button>
          <span style={{ color: "var(--text-3)" }}>·</span>
          <button type="button" onClick={() => setSelected(new Set())} style={{ color: "var(--text-2)" }}>
            None
          </button>
        </span>
      </div>

      <div className="rounded-md border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {flocks.map((fl, i) => {
          const isSelected = selected.has(fl.id);
          return (
            <label
              key={fl.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--divider)" }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(fl.id)}
                style={{ accentColor: "var(--green-700)" }}
              />
              {isSelected && <input type="hidden" name="flock_ids" value={fl.id} />}
              <div className="flex-1">
                <span className="font-mono text-[12px] font-medium">{fl.reference ?? "—"}</span>
                <span className="ml-2 text-[11px]" style={{ color: "var(--text-2)" }}>
                  {fl.house_name}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
