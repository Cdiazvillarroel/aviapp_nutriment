"use client";

import { useState } from "react";

interface Props {
  current: number | null;
  unit?: string;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

export function NumericInput({ current, unit = "g", onChange, disabled }: Props) {
  const [val, setVal] = useState<string>(current?.toString() ?? "");

  function commit() {
    const trimmed = val.trim();
    if (trimmed === "") {
      if (current !== null) onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed !== current) {
      onChange(parsed);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        disabled={disabled}
        placeholder="0"
        className="h-8 w-24 rounded-md px-2 text-[13px]"
        style={{
          border: "1.5px solid var(--border)",
          background: "var(--surface)",
          textAlign: "right",
        }}
      />
      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{unit}</span>
    </div>
  );
}
