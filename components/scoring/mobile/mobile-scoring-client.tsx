"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BirdSelector } from "./bird-selector";
import { ModuleSelector } from "./module-selector";
import { ScoreItemMobile } from "./score-item-mobile";
import { AIFab } from "./ai-fab";

interface ScoringDef {
  id: string;
  name: string;
  module: string;
  scale_max: number;
  field_type: "score" | "numeric" | "sex";
  module_order?: number;
  order_in_module?: number;
}

interface ExistingScore {
  id: string;
  visit_id: string;
  definition_id: string;
  flock_id: string;
  bird_number: number;
  score: number | null;
  numeric_value: number | null;
  text_value: string | null;
  has_photo?: boolean;
}

interface Visit {
  id: string;
  farm_id: string;
  scheduled_at: string;
  bird_count: number | null;
  notes: string | null;
}

interface Farm {
  id: string;
  name: string;
}

interface Flock {
  id: string;
  reference: string | null;
  placement_date: string;
}

interface Cell {
  scoreId: string | null;
  score: number | null;
  numericValue: number | null;
  textValue: string | null;
  hasPhoto: boolean;
}

interface Props {
  visit: Visit;
  farm: Farm;
  flocks: Flock[];
  scoringDefinitions: ScoringDef[];
  existingScores: ExistingScore[];
  upsertScore: (formData: FormData) => Promise<{ ok: boolean; scoreId?: string; error?: string }>;
  uploadPhoto: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

export function MobileScoringClient(props: Props) {
  const birdCount = props.visit.bird_count ?? 5;
  const flockId = props.flocks[0]?.id ?? "";

  // Order modules
  const modules = useMemo(function () {
    const seen = new Set<string>();
    const ordered: string[] = [];
    [...props.scoringDefinitions]
      .sort(function (a, b) {
        return (a.module_order ?? 0) - (b.module_order ?? 0);
      })
      .forEach(function (d) {
        if (!seen.has(d.module)) {
          seen.add(d.module);
          ordered.push(d.module);
        }
      });
    return ordered;
  }, [props.scoringDefinitions]);

  const [activeBird, setActiveBird] = useState(1);
  const [activeModule, setActiveModule] = useState(modules[0] ?? "");

  // Build cells map: definitionId+birdNumber -> Cell
  const initialCells = useMemo(function () {
    const map: Record<string, Cell> = {};
    props.scoringDefinitions.forEach(function (def) {
      for (let bird = 1; bird <= birdCount; bird++) {
        const key = `${def.id}|${bird}`;
        map[key] = {
          scoreId: null,
          score: null,
          numericValue: null,
          textValue: null,
          hasPhoto: false,
        };
      }
    });
    props.existingScores.forEach(function (s) {
      const key = `${s.definition_id}|${s.bird_number}`;
      map[key] = {
        scoreId: s.id,
        score: s.score,
        numericValue: s.numeric_value,
        textValue: s.text_value,
        hasPhoto: s.has_photo ?? false,
      };
    });
    return map;
  }, [props.scoringDefinitions, props.existingScores, birdCount]);

  const [cells, setCells] = useState<Record<string, Cell>>(initialCells);

  function updateCell(definitionId: string, birdNumber: number, update: Partial<Cell>) {
    const key = `${definitionId}|${birdNumber}`;
    setCells(function (prev) {
      return {
        ...prev,
        [key]: { ...prev[key], ...update },
      };
    });
  }

  // Filter definitions by active module
  const moduleDefinitions = useMemo(function () {
    return props.scoringDefinitions
      .filter(function (d) { return d.module === activeModule; })
      .sort(function (a, b) {
        return (a.order_in_module ?? 0) - (b.order_in_module ?? 0);
      });
  }, [props.scoringDefinitions, activeModule]);

  // Calculate progress totals
  const totalCells = props.scoringDefinitions.length * birdCount;
  const totalDone = useMemo(function () {
    let count = 0;
    Object.values(cells).forEach(function (c) {
      if (c.score !== null || c.numericValue !== null || c.textValue !== null) {
        count++;
      }
    });
    return count;
  }, [cells]);

  // Compute date and age
  const visitDate = new Date(props.visit.scheduled_at);
  const placementDate = props.flocks[0] ? new Date(props.flocks[0].placement_date) : null;
  const ageDays = placementDate
    ? Math.floor((visitDate.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const flockRef = props.flocks[0]?.reference ?? "";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 border-b px-3 py-2.5"
        style={{ background: "var(--surface)", borderColor: "var(--divider)" }}
      >
        <Link
          href={`/visits/${props.visit.id}`}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[14px]"
          style={{ color: "var(--text-2)", background: "var(--surface-2)" }}
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <div className="truncate text-[14px] font-medium leading-tight" style={{ color: "var(--text-1)" }}>
            {props.farm.name} {flockRef && ` · ${flockRef}`}
          </div>
          {ageDays !== null && (
            <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Day {ageDays}
            </div>
          )}
        </div>
        <div
          className="flex-shrink-0 text-[11px] font-mono"
          style={{ color: "var(--text-3)" }}
        >
          ✓ Saved
        </div>
      </header>

      <BirdSelector
        birdCount={birdCount}
        activeBird={activeBird}
        onSelectBird={setActiveBird}
        totalDone={totalDone}
        totalCells={totalCells}
      />

      <ModuleSelector
        modules={modules}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
      />

      {/* Score items */}
      <div className="pb-20">
        {moduleDefinitions.map(function (def) {
          const key = `${def.id}|${activeBird}`;
          const cell = cells[key];
          if (!cell) return null;

          return (
            <ScoreItemMobile
              key={def.id}
              definition={def}
              cell={cell}
              visitId={props.visit.id}
              flockId={flockId}
              birdNumber={activeBird}
              onScoreChange={updateCell}
              onAIRequest={function () { /* future */ }}
              upsertScore={props.upsertScore}
              uploadPhoto={props.uploadPhoto}
            />
          );
        })}
      </div>

      <AIFab
        visitId={props.visit.id}
        hasActivePhoto={false}
        activeBird={activeBird}
        activeModule={activeModule}
      />
    </div>
  );
}
