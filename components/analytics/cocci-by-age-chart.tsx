"use client";

import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { CoccidiosisByAgeRow } from "@/lib/analytics-queries";

interface Props {
  data: CoccidiosisByAgeRow[];
}

export function CocciByAgeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-2)" }}>
        Not enough scoring data to render this chart yet. Score a few birds across visits at different
        ages and the chart will populate.
      </div>
    );
  }

  const minAge = Math.min(...data.map(d => d.age_days));
  const maxAge = Math.max(...data.map(d => d.age_days));
  const padded: CoccidiosisByAgeRow[] = [];
  const map = new Map(data.map(d => [d.age_days, d]));
  for (let age = minAge; age <= maxAge; age++) {
    padded.push(
      map.get(age) ?? {
        age_days: age, acervulina: 0, maxima: 0, tenella: 0, bird_samples: 0,
      }
    );
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={padded} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
        <XAxis
          dataKey="age_days"
          tick={{ fontSize: 11 }}
          label={{
            value: "Age (days)",
            position: "insideBottom",
            offset: -6,
            style: { fontSize: 11, fill: "var(--text-2)" },
          }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          label={{
            value: "Average score",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 11, fill: "var(--text-2)", textAnchor: "middle" },
          }}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelFormatter={(age) => `Day ${age}`}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="acervulina" stackId="cocci" fill="#bdd9b8" name="Eimeria acervulina" />
        <Bar dataKey="maxima"     stackId="cocci" fill="#3a6b48" name="Eimeria maxima" />
        <Bar dataKey="tenella"    stackId="cocci" fill="#c66b1f" name="Eimeria tenella" />
      </BarChart>
    </ResponsiveContainer>
  );
}
