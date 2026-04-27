"use client";

import {
  Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend,
} from "recharts";

interface Props {
  inWithdrawal: number;
  cleared: number;
  totalActive: number;
}

export function WithdrawalChart({ inWithdrawal, cleared, totalActive }: Props) {
  const data = [
    { name: "In withdrawal", value: inWithdrawal, color: "#c66b1f" },
    { name: "Cleared", value: cleared, color: "#3a6b48" },
  ];

  const allZero = inWithdrawal + cleared === 0;

  if (totalActive === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-2)" }}>
        No active flocks in production right now.
      </div>
    );
  }

  return (
    <div className="grid items-center gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={allZero ? [{ name: "no-data", value: 1, color: "var(--surface-2)" }] : data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {(allZero ? [0] : data).map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={allZero ? "var(--border)" : data[idx].color}
                />
              ))}
            </Pie>
            {!allZero && (
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
            )}
            {!allZero && <Legend wrapperStyle={{ fontSize: 12 }} />}
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="mb-3">
          <div className="text-[10px] font-medium uppercase tracking-widest"
               style={{ color: "var(--text-3)" }}>
            Active flocks
          </div>
          <div className="font-display text-[36px] leading-none"
               style={{ fontVariationSettings: "'opsz' 60" }}>
            {totalActive}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[12px]">
          <div className="flex items-center justify-between border-b py-1.5"
               style={{ borderColor: "var(--divider)" }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: "#c66b1f" }}></span>
              In withdrawal
            </div>
            <strong className="font-mono tabular-nums">{inWithdrawal}</strong>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: "#3a6b48" }}></span>
              Cleared for slaughter
            </div>
            <strong className="font-mono tabular-nums">{cleared}</strong>
          </div>
        </div>

        {totalActive > 0 && (
          <div className="mt-4 text-[11px]" style={{ color: "var(--text-3)" }}>
            {Math.round((cleared / totalActive) * 100)}% of active flocks are currently
            outside their withdrawal period.
          </div>
        )}
      </div>
    </div>
  );
}
