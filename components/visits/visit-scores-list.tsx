"use client";

import { useState, useMemo } from "react";
import { VisitScoreRow, type BirdScore } from "./visit-score-row";

export interface ScoreItem {
  defId: string;
  defName: string;
  module: string;
  moduleOrder: number;
  orderInModule: number;
  fieldType: "score" | "numeric" | "sex";
  scaleMax: number;
  flockReference: string | null;
  birdScores: BirdScore[];
  totalBirds: number;
}

type SortKey = "module" | "severity" | "name";

interface Props {
  items: ScoreItem[];
}

function severityScore(item: ScoreItem): number {
  if (item.fieldType !== "score") return -1;

  const valid = item.birdScores
    .map(function (b) { return b.score; })
    .filter(function (s): s is number { return s !== null; });

  if (valid.length === 0) return -1;

  const avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
  const ratio = item.scaleMax > 0 ? avg / item.scaleMax : 0;
  return ratio;
}

export function VisitScoresList(props: Props) {
  const [sort, setSort] = useState<SortKey>("module");

  const sorted = useMemo(function () {
    const items = props.items.slice();
    if (sort === "module") {
      items.sort(function (a, b) {
        const m = a.moduleOrder - b.moduleOrder;
        if (m !== 0) return m;
        return a.orderInModule - b.orderInModule;
      });
    } else if (sort === "severity") {
      items.sort(function (a, b) {
        return severityScore(b) - severityScore(a);
      });
    } else {
      items.sort(function (a, b) {
        return a.defName.localeCompare(b.defName);
      });
    }
    return items;
  }, [props.items, sort]);

  const withWarning = props.items.filter(function (i) {
    if (i.fieldType !== "score") return false;
    const ratio = severityScore(i);
    return ratio >= 0.3;
  }).length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[11px]">
        <span style={{ color: "var(--text-3)" }} className="font-medium uppercase tracking-wider">
          Sort by:
        </span>
        {[
          { key: "module" as const, label: "Module order" },
          { key: "severity" as const, label: "Severity" },
          { key: "name" as const, label: "A-Z" },
        ].map(function (opt) {
          const isActive = sort === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={function () { setSort(opt.key); }}
              className="rounded-full px-2.5 py-0.5"
              style={{
                background: isActive ? "var(--green-100)" : "var(--surface-2)",
                color: isActive ? "var(--green-700)" : "var(--text-2)",
                fontWeight: isActive ? 500 : 400,
                border: `1px solid ${isActive ? "var(--green-700)" : "transparent"}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}

        {withWarning > 0 ? (
          <span className="ml-auto text-[10px]" style={{ color: "var(--warn)" }}>
            {withWarning} item{withWarning === 1 ? "" : "s"} with elevated scores
          </span>
        ) : null}
      </div>

      <div className="card">
        <div className="card__body card__body--flush">
          {sorted.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px]"
                 style={{ color: "var(--text-3)" }}>
              No scoring items defined.
            </div>
          ) : (
            sorted.map(function (item) {
              return (
                <VisitScoreRow
                  key={item.defId + "|" + (item.flockReference ?? "")}
                  defName={item.defName}
                  module={item.module}
                  flockReference={item.flockReference}
                  fieldType={item.fieldType}
                  scaleMax={item.scaleMax}
                  startAt={item.defName === "Bursa Meter" ? 1 : 0}
                  birdScores={item.birdScores}
                  totalBirds={item.totalBirds}
                  unit={item.fieldType === "numeric" ? "g" : undefined}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
