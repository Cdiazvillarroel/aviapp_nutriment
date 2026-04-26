"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconSearch } from "@/components/ui/icons";

interface Props {
  regions: string[];
  complexes: string[];
  currentQ: string;
  currentRegion: string;
  currentComplex: string;
}

export function FarmsFilters({ regions, complexes, currentQ, currentRegion, currentComplex }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v); else params.delete(k);
    }
    startTransition(() => {
      router.push(`/farms?${params.toString()}`);
    });
  }

  function clearAll() {
    startTransition(() => router.push("/farms"));
  }

  const hasActive = currentQ || currentRegion || currentComplex;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1" style={{ minWidth: 200 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none", display: "inline-flex" }}>
          <IconSearch size={14} />
        </span>
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          placeholder="Search farm name or reference…"
          defaultValue={currentQ}
          onChange={(e) => update({ q: e.target.value })}
        />
      </div>

      <select
        className="select"
        style={{ width: "auto" }}
        value={currentRegion}
        onChange={(e) => update({ region: e.target.value })}
      >
        <option value="">All regions</option>
        {regions.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <select
        className="select"
        style={{ width: "auto" }}
        value={currentComplex}
        onChange={(e) => update({ complex: e.target.value })}
      >
        <option value="">All complexes</option>
        {complexes.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {hasActive && (
        <button onClick={clearAll} className="btn btn--ghost btn--sm" disabled={pending}>
          Clear filters
        </button>
      )}
    </div>
  );
}
