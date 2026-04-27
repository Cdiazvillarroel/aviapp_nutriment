"use client";

import {
  Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { MortalityTrendRow } from "@/lib/analytics-queries";

const VIC_BENCHMARK = 5.0;

interface Props {
  data: MortalityTrendRow[];
}

export function MortalityTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-2)" }}>
        No daily mortality records found in the period.
      </div>
    );
  }

  const formatted = data.map(d => ({
    label: new Date(d.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
    rate: d.rate_per_1000,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          label={{
            value: "per 1000 birds / week",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 11, fill: "var(--text-2)", textAnchor: "middle" },
          }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <ReferenceLine
          y={VIC_BENCHMARK}
          stroke="#c66b1f"
          strokeDasharray="5 3"
          label={{
            value: `VIC benchmark ${VIC_BENCHMARK}`,
            position: "right",
            fontSize: 10,
            fill: "#c66b1f",
          }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#3a6b48"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Mortality rate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
