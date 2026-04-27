"use client";

import { useState } from "react";

export interface BirdScore {
  bird_number: number;
  score: number | null;
  numeric_value: number | null;
  text_value: string | null;
}

interface Props {
  defName: string;
  module: string;
  flockReference: string | null;
  fieldType: "score" | "numeric" | "sex";
  scaleMax: number;
  startAt: number;
  birdScores: BirdScore[];
  totalBirds: number;
  unit?: string;
}

const COLOR_RAMP = [
  { bg: "var(--ok-bg)",   fg: "var(--ok)" },
  { bg: "#e8f0d9",        fg: "#5d7a2c" },
  { bg: "var(--warn-bg)", fg: "var(--warn)" },
  { bg: "#f5d2bd",        fg: "#a64d1e" },
  { bg: "var(--bad-bg)",  fg: "var(--bad)" },
  { bg: "#7a1a14",        fg: "#fafaf6" },
  { bg: "#4a0e0a",        fg: "#fafaf6" },
  { bg: "#2c0807",        fg: "#fafaf6" },
  { bg: "#1a0303",        fg: "#fafaf6" },
];

function colorForScore(score: number, scaleMax: number, startAt: number): { bg: string; fg: string } {
  const range = scaleMax - startAt;
  if (range === 0) return COLOR_RAMP[0];
  const idx = Math.round(((score - startAt) / range) * (COLOR_RAMP.length - 1));
  return COLOR_RAMP[Math.min(Math.max(idx, 0), COLOR_RAMP.length - 1)];
}

export function VisitScoreRow(props: Props) {
  const [expanded, setExpanded] = useState(false);

  const { defName, module, flockReference, fieldType, scaleMax, startAt, birdScores, totalBirds, unit } = props;

  let aggregateLabel: React.ReactNode;
  let aggregateMeta: string;
  let canExpand = birdScores.length > 0;
  let warningTone: "ok" | "warn" | "bad" | "neutral" = "neutral";

  if (fieldType === "score") {
    const validScores = birdScores
      .map(function (b) { return b.score; })
      .filter(function (s): s is number { return s !== null; });

    if (validScores.length === 0) {
      aggregateLabel = <span style={{ color: "var(--text-3)" }}>Not scored</span>;
      aggregateMeta = "0 of " + totalBirds + " birds";
      canExpand = false;
    } else {
      const avg = validScores.reduce(function (a, b) { return a + b; }, 0) / validScores.length;
      const max = Math.max(...validScores);
      const colors = colorForScore(avg, scaleMax, startAt);

      const ratio = scaleMax > 0 ? avg / scaleMax : 0;
      if (ratio >= 0.6) warningTone = "bad";
      else if (ratio >= 0.3) warningTone = "warn";
      else if (avg > 0) warningTone = "ok";

      aggregateLabel = (
        <span className="flex items-baseline gap-2">
          <span
            className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 font-mono text-[13px] font-medium tabular-nums"
            style={{ background: colors.bg, color: colors.fg }}
          >
            {avg.toFixed(1)}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
            avg / max {max} / scale {startAt}-{scaleMax}
          </span>
        </span>
      );
      aggregateMeta = validScores.length + " of " + totalBirds + " birds scored";
    }
  } else if (fieldType === "numeric") {
    const validNums = birdScores
      .map(function (b) { return b.numeric_value; })
      .filter(function (n): n is number { return n !== null; });

    if (validNums.length === 0) {
      aggregateLabel = <span style={{ color: "var(--text-3)" }}>Not recorded</span>;
      aggregateMeta = "0 of " + totalBirds + " birds";
      canExpand = false;
    } else {
      const avg = validNums.reduce(function (a, b) { return a + b; }, 0) / validNums.length;
      const min = Math.min(...validNums);
      const max = Math.max(...validNums);
      aggregateLabel = (
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[14px] font-medium tabular-nums">
            {Math.round(avg)}{unit ? " " + unit : ""}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
            avg / range {min}-{max}
          </span>
        </span>
      );
      aggregateMeta = validNums.length + " of " + totalBirds + " birds recorded";
    }
  } else {
    const validVals = birdScores
      .map(function (b) { return b.text_value; })
      .filter(function (v): v is string { return v !== null && v.trim() !== ""; });

    if (validVals.length === 0) {
      aggregateLabel = <span style={{ color: "var(--text-3)" }}>Not recorded</span>;
      aggregateMeta = "0 of " + totalBirds + " birds";
      canExpand = false;
    } else {
      const males = validVals.filter(function (v) { return v.toUpperCase() === "M"; }).length;
      const females = validVals.filter(function (v) { return v.toUpperCase() === "F"; }).length;
      const malePct = Math.round((males / validVals.length) * 100);
      aggregateLabel = (
        <span className="flex items-baseline gap-2">
          <span
            className="inline-flex h-7 items-center rounded-md px-2.5 font-mono text-[12px] font-medium tabular-nums"
            style={{ background: "var(--green-100)", color: "var(--green-700)" }}
          >
            {males}M / {females}F
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
            {malePct}% male
          </span>
        </span>
      );
      aggregateMeta = validVals.length + " of " + totalBirds + " birds recorded";
    }
  }

  const sortedBirds = birdScores.slice().sort(function (a, b) { return a.bird_number - b.bird_number; });

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--divider)" }}>
      <button
        type="button"
        onClick={function () { if (canExpand) setExpanded(function (v) { return !v; }); }}
        disabled={!canExpand}
        className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors"
        style={{
          background: "transparent",
          cursor: canExpand ? "pointer" : "default",
        }}
      >
        <span
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{
            background:
              warningTone === "bad" ? "var(--bad)" :
              warningTone === "warn" ? "var(--warn)" :
              warningTone === "ok" ? "var(--ok)" :
              "transparent",
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{defName}</div>
          <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
            {module}
            {flockReference ? " · " + flockReference : ""}
            {" · " + aggregateMeta}
          </div>
        </div>

        <div className="flex-shrink-0">{aggregateLabel}</div>

        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[14px]"
          style={{ color: canExpand ? "var(--text-3)" : "transparent" }}
        >
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && canExpand ? (
        <div
          className="grid gap-2 border-t px-5 py-3"
          style={{
            borderColor: "var(--divider)",
            background: "var(--surface-2)",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          }}
        >
          {sortedBirds.map(function (b) {
            let chip: React.ReactNode;
            if (fieldType === "score" && b.score !== null) {
              const colors = colorForScore(b.score, scaleMax, startAt);
              chip = (
                <span
                  className="inline-flex h-6 min-w-[28px] items-center justify-center rounded font-mono text-[11px] font-medium tabular-nums"
                  style={{ background: colors.bg, color: colors.fg }}
                >
                  {b.score}
                </span>
              );
            } else if (fieldType === "numeric" && b.numeric_value !== null) {
              chip = (
                <span className="font-mono text-[11px] tabular-nums">
                  {b.numeric_value}{unit ? unit : ""}
                </span>
              );
            } else if (fieldType === "sex" && b.text_value !== null) {
              chip = (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-medium"
                  style={{
                    background: "var(--green-100)",
                    color: "var(--green-700)",
                  }}
                >
                  {b.text_value.toUpperCase()}
                </span>
              );
            } else {
              chip = (
                <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  -
                </span>
              );
            }

            return (
              <div
                key={b.bird_number}
                className="flex flex-col items-center gap-1 rounded-md py-1.5"
                style={{ background: "var(--surface)" }}
              >
                <span
                  className="text-[9px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-3)" }}
                >
                  Bird {b.bird_number}
                </span>
                {chip}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
