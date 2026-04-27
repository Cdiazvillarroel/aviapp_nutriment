"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Props {
  farms: { id: string; name: string }[];
  quarterOptions: { key: string; label: string }[];
  currentQuarter: string;
  currentFarm: string;
}

export function ReportsFilters({ farms, quarterOptions, currentQuarter, currentFarm }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(patch: { q?: string; farm?: string }) {
    const params = new URLSearchParams();
    const q = patch.q ?? currentQuarter;
    const farm = patch.farm ?? currentFarm;
    if (q) params.set("q", q);
    if (farm) params.set("farm", farm);
    startTransition(() => router.push(`/reports?${params.toString()}`));
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <select
        className="select"
        style={{ width: "auto" }}
        value={currentQuarter}
        onChange={(e) => update({ q: e.target.value })}
        disabled={pending}
      >
        {quarterOptions.map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>

      <select
        className="select"
        style={{ width: "auto" }}
        value={currentFarm}
        onChange={(e) => update({ farm: e.target.value })}
        disabled={pending}
      >
        <option value="">All farms</option>
        {farms.map(f => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      {currentFarm && (
        <button
          onClick={() => update({ farm: "" })}
          className="btn btn--ghost btn--sm"
          disabled={pending}
        >
          Clear farm
        </button>
      )}
    </div>
  );
}
