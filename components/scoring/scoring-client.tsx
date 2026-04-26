"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { upsertScore, clearScore } from "@/app/(app)/scoring/actions";
import { ScoreButtons } from "./score-buttons";
import { PhotoCapture } from "./photo-capture";
import { IconCheckSquare } from "@/components/ui/icons";

interface Definition {
  id: string;
  section: string;
  name: string;
  scale_max: number;
  display_order: number;
}

interface Flock {
  id: string;
  reference: string | null;
  house_name: string;
  age_days: number;
}

export interface InitialScore {
  flockId: string;
  definitionId: string;
  scoreId: string;
  score: number | null;
  notes: string | null;
  photos: { id: string; url: string }[];
}

interface Props {
  visitId: string;
  visitFarmName: string;
  flocks: Flock[];
  definitions: Definition[];
  initialScores: InitialScore[];
}

interface ScoreCellState {
  scoreId: string | null;
  score: number | null;
  status: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
  photos: { id: string; url: string }[];
}

function key(flockId: string, defId: string) {
  return `${flockId}::${defId}`;
}

export function ScoringClient({ visitId, visitFarmName, flocks, definitions, initialScores }: Props) {
  const initialMap = new Map<string, ScoreCellState>();
  for (const s of initialScores) {
    initialMap.set(key(s.flockId, s.definitionId), {
      scoreId: s.scoreId,
      score: s.score,
      status: "idle",
      photos: s.photos,
    });
  }

  const [scoreMap, setScoreMap] = useState<Map<string, ScoreCellState>>(initialMap);
  const [activeFlockId, setActiveFlockId] = useState<string>(flocks[0]?.id ?? "");
  const [, startTransition] = useTransition();

  const sections = Array.from(
    definitions.reduce((acc, d) => {
      if (!acc.has(d.section)) acc.set(d.section, []);
      acc.get(d.section)!.push(d);
      return acc;
    }, new Map<string, Definition[]>())
  ).map(([section, defs]) => ({ section, defs: defs.sort((a, b) => a.display_order - b.display_order) }));

  const totalForFlock = definitions.length;
  const scoredForFlock = Array.from(scoreMap.entries()).filter(
    ([k, v]) => k.startsWith(`${activeFlockId}::`) && v.score !== null
  ).length;

  function getCell(flockId: string, defId: string): ScoreCellState {
    return scoreMap.get(key(flockId, defId)) ?? {
      scoreId: null,
      score: null,
      status: "idle",
      photos: [],
    };
  }

  function setCell(flockId: string, defId: string, patch: Partial<ScoreCellState>) {
    setScoreMap(prev => {
      const next = new Map(prev);
      const existing = next.get(key(flockId, defId)) ?? {
        scoreId: null,
        score: null,
        status: "idle" as const,
        photos: [],
      };
      next.set(key(flockId, defId), { ...existing, ...patch });
      return next;
    });
  }

  async function handleScoreChange(flockId: string, defId: string, newScore: number | null) {
    const cell = getCell(flockId, defId);
    setCell(flockId, defId, { score: newScore, status: "saving" });

    startTransition(async () => {
      try {
        if (newScore === null) {
          const result = await clearScore({ visitId, flockId, definitionId: defId });
          if (result.ok) {
            setCell(flockId, defId, { status: "saved" });
            setTimeout(() => setCell(flockId, defId, { status: "idle" }), 1500);
          } else {
            setCell(flockId, defId, { status: "error", errorMsg: result.error });
          }
        } else {
          const result = await upsertScore({
            visitId,
            flockId,
            definitionId: defId,
            score: newScore,
          });
          if (result.ok) {
            setCell(flockId, defId, { scoreId: result.scoreId, status: "saved" });
            setTimeout(() => setCell(flockId, defId, { status: "idle" }), 1500);
          } else {
            setCell(flockId, defId, { score: cell.score, status: "error", errorMsg: result.error });
          }
        }
      } catch (e) {
        setCell(flockId, defId, { score: cell.score, status: "error", errorMsg: String(e) });
      }
    });
  }

  const activeFlock = flocks.find(f => f.id === activeFlockId);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
            <Link href={`/visits/${visitId}`} style={{ color: "var(--text-2)" }}>
              ← Back to visit
            </Link>
          </div>
          <h1>Scoring · {visitFarmName}</h1>
          <div className="page-header__sub">
            {scoredForFlock} of {totalForFlock} items scored for {activeFlock?.reference ?? "this flock"} · autosaving
          </div>
        </div>
      </div>

      {flocks.length > 1 && (
        <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
          {flocks.map(f => {
            const flockKey = `${f.id}::`;
            const flockScoredCount = Array.from(scoreMap.entries()).filter(
              ([k, v]) => k.startsWith(flockKey) && v.score !== null
            ).length;
            const isActive = activeFlockId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFlockId(f.id)}
                className="relative -mb-px flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors"
                style={{
                  color: isActive ? "var(--text)" : "var(--text-2)",
                  borderBottom: `2px solid ${isActive ? "var(--green-700)" : "transparent"}`,
                }}
              >
                <span className="font-mono">{f.reference ?? "—"}</span>
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                  {f.house_name} · {f.age_days}d
                </span>
                <span className="rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
                      style={{
                        background: isActive ? "var(--green-100)" : "var(--surface-2)",
                        color: isActive ? "var(--green-700)" : "var(--text-3)",
                      }}>
                  {flockScoredCount}/{totalForFlock}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {flocks.length === 0 && (
        <div className="card">
          <div className="card__body text-center" style={{ padding: "60px 24px" }}>
            <div className="font-display text-xl mb-2" style={{ fontVariationSettings: "'opsz' 48", color: "var(--text-2)" }}>
              No flocks attached to this visit
            </div>
            <p className="m-0 mb-4 text-[13px]" style={{ color: "var(--text-2)" }}>
              You need to attach at least one flock before scoring.
            </p>
            <Link href={`/visits/${visitId}`} className="btn btn--primary">
              Back to visit
            </Link>
          </div>
        </div>
      )}

      {flocks.length > 0 && sections.map(({ section, defs }) => (
        <div key={section} className="card mb-4">
          <div className="card__header">
            <h2 className="card__title">
              <IconCheckSquare size={16} />
              {section}
            </h2>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {defs.length} item{defs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="card__body card__body--flush">
            {defs.map(d => {
              const cell = getCell(activeFlockId, d.id);
              return (
                <ScoreItemRow
                  key={d.id}
                  visitId={visitId}
                  flockId={activeFlockId}
                  definition={d}
                  cell={cell}
                  onScoreChange={(s) => handleScoreChange(activeFlockId, d.id, s)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreItemRow({
  visitId, flockId, definition, cell, onScoreChange,
}: {
  visitId: string;
  flockId: string;
  definition: Definition;
  cell: ScoreCellState;
  onScoreChange: (score: number | null) => void;
}) {
  return (
    <div className="grid items-center gap-4 border-b px-5 py-4 last:border-b-0"
         style={{ borderColor: "var(--divider)", gridTemplateColumns: "1.4fr auto 1.5fr 80px" }}>
      <div>
        <div className="text-[13px] font-medium">{definition.name}</div>
        <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
          0 = healthy · {definition.scale_max} = severe
        </div>
      </div>

      <ScoreButtons
        scaleMax={definition.scale_max}
        currentScore={cell.score}
        onChange={onScoreChange}
        disabled={cell.status === "saving"}
      />

      <PhotoCapture
        visitId={visitId}
        visitScoreId={cell.scoreId}
        onScoreNeeded={async () => null}
        initialPhotos={cell.photos}
      />

      <div className="text-right text-[11px]" style={{ color: cell.status === "error" ? "var(--bad)" : "var(--text-3)" }}>
        {cell.status === "saving" && "Saving…"}
        {cell.status === "saved" && (
          <span style={{ color: "var(--ok)" }}>✓ Saved</span>
        )}
        {cell.status === "error" && (cell.errorMsg ?? "Error")}
        {cell.status === "idle" && cell.score !== null && (
          <span style={{ color: "var(--text-3)" }}>Saved</span>
        )}
      </div>
    </div>
  );
}
