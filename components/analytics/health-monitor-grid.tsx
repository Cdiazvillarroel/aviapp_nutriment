"use client";

import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  ComposedChart,
} from "recharts";
import type { MonthlyAggregateRow } from "@/lib/analytics-queries";

const COLORS = {
  primary: "#3a6b48",
  secondary: "#7a9c39",
  accent: "#c66b1f",
  muted: "#a8a8a0",
  trachea: "#cda53b",
  bursa1: "#bdd9b8",
  bursa2: "#3a6b48",
};

interface Props {
  bursaData: MonthlyAggregateRow[];
  skeletalData: MonthlyAggregateRow[];
  cocciData: MonthlyAggregateRow[];
  respiratoryData: MonthlyAggregateRow[];
}

export function HealthMonitorGrid({ bursaData, skeletalData, cocciData, respiratoryData }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Bursa Meter">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bursaData.map(m => ({ month: m.month_label, ...m.metrics }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 8]} tick={{ fontSize: 10 }} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle()} />
            <Legend wrapperStyle={legendStyle()} />
            <Bar dataKey="Bursa Meter" fill={COLORS.primary} name="Avg Bursa Meter" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Skeletal lesions">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={skeletalData.map(m => ({ month: m.month_label, ...m.metrics }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 3]} tick={{ fontSize: 10 }} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle()} />
            <Legend wrapperStyle={legendStyle()} />
            <Bar dataKey="Detached Cartilage" fill={COLORS.primary} name="Detached cartilage" />
            <Bar dataKey="Tibial Dyschondroplasia" fill={COLORS.secondary} name="Tibial dyschondro." />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Coccidiosis scores">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cocciData.map(m => ({ month: m.month_label, ...m.metrics }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle()} />
            <Legend wrapperStyle={legendStyle()} />
            <Bar dataKey="Eimeria acervulina" stackId="cocci" fill={COLORS.bursa1} name="Acervulina" />
            <Bar dataKey="Eimeria maxima"     stackId="cocci" fill={COLORS.primary} name="Maxima" />
            <Bar dataKey="Eimeria tenella"    stackId="cocci" fill={COLORS.accent} name="Tenella" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Respiratory (Trachea)">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={respiratoryData.map(m => ({ month: m.month_label, ...m.metrics }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle()} />
            <Legend wrapperStyle={legendStyle()} />
            <Bar dataKey="Trachea" fill={COLORS.trachea} name="Avg Trachea score" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title text-[13px] font-medium">{title}</h3>
      </div>
      <div className="card__body" style={{ padding: 16 }}>
        {children}
      </div>
    </div>
  );
}

function tooltipStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 11,
    padding: "6px 8px",
  };
}

function legendStyle() {
  return { fontSize: 10, paddingTop: 4 };
}
