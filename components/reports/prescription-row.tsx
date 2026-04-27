"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deletePrescription } from "@/app/(app)/prescriptions/actions";

interface Prescription {
  id: string;
  drug_name: string;
  active_ingredient: string | null;
  indication: string | null;
  start_date: string;
  end_date: string;
  withdrawal_days: number;
  flock_id: string;
  flock_reference: string | null;
  farm_name: string;
  withdrawal_until: Date;
  isInWithdrawal: boolean;
}

export function PrescriptionRow({ prescription: p }: { prescription: Prescription }) {
  const [pending, startTransition] = useTransition();

  function fmt(d: string) {
    return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
  }

  function fmtFull(d: Date) {
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  }

  function onDelete() {
    if (!confirm(`Delete this prescription for ${p.drug_name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deletePrescription(p.id);
      if (!result.ok) alert(result.error);
    });
  }

  return (
    <div
      className="grid items-center gap-3 border-b px-5 py-3.5 last:border-b-0"
      style={{
        borderColor: "var(--divider)",
        gridTemplateColumns: "1.6fr 1.4fr 100px 100px 110px 80px",
      }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{p.drug_name}</div>
        <div className="text-[11px]" style={{ color: "var(--text-2)" }}>
          {p.active_ingredient ?? "—"}
        </div>
        {p.indication && (
          <div className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-3)" }}>
            {p.indication.length > 90 ? p.indication.slice(0, 90) + "…" : p.indication}
          </div>
        )}
      </div>
      <div className="text-[12px]">
        <div className="font-mono font-medium">{p.flock_reference ?? "—"}</div>
        <div className="text-[11px]" style={{ color: "var(--text-3)" }}>{p.farm_name}</div>
      </div>
      <div className="text-right font-mono text-[12px]">{fmt(p.start_date)}</div>
      <div className="text-right font-mono text-[12px]">{fmt(p.end_date)}</div>
      <div className="text-right">
        {p.isInWithdrawal ? (
          <span className="pill pill--warn">until {fmtFull(p.withdrawal_until)}</span>
        ) : (
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {p.withdrawal_days}d cleared
          </span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 text-[11px]">
        <Link
          href={`/prescriptions/${p.id}/edit`}
          style={{ color: "var(--text-2)" }}
        >
          Edit
        </Link>
        <button
          onClick={onDelete}
          disabled={pending}
          style={{ color: pending ? "var(--text-3)" : "var(--bad)" }}
        >
          {pending ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
