"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Props {
  current: string;
  options: { key: string; label: string }[];
}

export function AnalyticsFilters({ current, options }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(value: string) {
    const params = new URLSearchParams();
    params.set("range", value);
    startTransition(() => router.push(`/analytics?${params.toString()}`));
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-3)" }}>
        Date range
      </span>
      <select
        className="select"
        style={{ width: "auto" }}
        value={current}
        onChange={(e) => update(e.target.value)}
        disabled={pending}
      >
        {options.map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
