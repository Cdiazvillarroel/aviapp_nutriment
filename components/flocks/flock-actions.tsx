"use client";

import { useTransition } from "react";
import { clearFlock, reactivateFlock } from "@/app/(app)/flocks/actions";

interface Props {
  flockId: string;
  farmId: string | null;
  active: boolean;
}

export function FlockActions({ flockId, farmId, active }: Props) {
  const [pending, startTransition] = useTransition();

  function onClear() {
    if (!confirm("Mark this flock as cleared? This will end its active cycle.")) return;
    startTransition(async () => {
      const result = await clearFlock(flockId, farmId ?? undefined);
      if (!result.ok) alert(result.error);
    });
  }

  function onReactivate() {
    startTransition(async () => {
      const result = await reactivateFlock(flockId, farmId ?? undefined);
      if (!result.ok) alert(result.error);
    });
  }

  if (active) {
    return (
      <button
        onClick={onClear}
        disabled={pending}
        className="btn btn--ghost btn--sm"
        style={{ color: pending ? "var(--text-3)" : "var(--text-2)" }}
      >
        {pending ? "…" : "Clear"}
      </button>
    );
  }

  return (
    <button
      onClick={onReactivate}
      disabled={pending}
      className="btn btn--ghost btn--sm"
      style={{ color: pending ? "var(--text-3)" : "var(--text-2)" }}
    >
      {pending ? "…" : "Reactivate"}
    </button>
  );
}
