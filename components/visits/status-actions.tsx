"use client";

import { useTransition } from "react";
import { updateVisitStatus } from "@/app/(app)/visits/actions";

interface Props {
  visitId: string;
  status: string;
}

export function VisitStatusActions({ visitId, status }: Props) {
  const [pending, startTransition] = useTransition();

  function changeStatus(next: string) {
    if (pending) return;
    startTransition(async () => {
      await updateVisitStatus(visitId, next);
    });
  }

  if (status === "planned") {
    return (
      <button onClick={() => changeStatus("in_progress")} disabled={pending} className="btn btn--primary btn--sm">
        {pending ? "…" : "Start visit"}
      </button>
    );
  }

  if (status === "in_progress") {
    return (
      <button onClick={() => changeStatus("completed")} disabled={pending} className="btn btn--primary btn--sm">
        {pending ? "…" : "Mark complete"}
      </button>
    );
  }

  return null;
}
