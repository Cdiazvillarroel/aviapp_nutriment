"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Props {
  farms: { id: string; name: string }[];
  current: string;
  currentTab: string;
}

export function FlocksFarmFilter({ farms, current, currentTab }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(value: string) {
    const params = new URLSearchParams();
    params.set("tab", currentTab);
    if (value) params.set("farm", value);
    startTransition(() => router.push(`/flocks?${params.toString()}`));
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        onChange={(e) => update(e.target.value)}
        className="select"
        style={{ width: "auto" }}
        disabled={pending}
      >
        <option value="">All farms</option>
        {farms.map(f => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      {current && (
        <button
          onClick={() => update("")}
          className="btn btn--ghost btn--sm"
          disabled={pending}
        >
          Clear
        </button>
      )}
    </div>
  );
}
