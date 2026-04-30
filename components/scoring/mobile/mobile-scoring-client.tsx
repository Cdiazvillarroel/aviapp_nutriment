"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upsertScore } from "@/app/(app)/scoring/actions";
import { ScoreCircles } from "../score-circles";
import { SexToggle } from "../sex-toggle";
import { NumericInput } from "../numeric-input";
import { PhotoCapture } from "../photo-capture";
import { AIAssistPanel } from "../ai-assist-panel";

interface Definition {
  id: string;
  name: string;
  scale_max: number;
  module: string;
  module_order: number;
  order_in_module: number;
  field_type: "score" | "numeric" | "sex";
}

interface Flock {
  id: string;
  reference: string | null;
  house_name: string;
  age_days: number;
  breed_name: string | null;
}

export interface InitialScore {
  flockId: string;
  birdNumber: number;
  definitionId: string;
  scoreId: string;
  score: number | null;
  numericValue: number | null;
  textValue: string | null;
  photos: { id: string; url: string }[];
}

interface Props {
  visitId: string;
  visitFarmName: string;
  birdCount: number;
  flocks: Flock[];
  definitions: Definition[];
  initialScores: InitialScore[];
}

interface CellState {
  scoreId: string | null;
  score: number | null;
  numericValue: number | null;
  textValue: string | null;
  status: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
  photos: { id: string; url: string }[];
}

function key(flockId: string, birdNumber: number, defId: string) {
  return `${flockId}::${birdNumber}::${defId}`;
}

export function MobileScoringClient({
  visitId,
  visitFarmName,
  birdCount,
  flocks,
  definitions,
  initialScores,
}: Props) {
  const router = useRouter();

  const initialMap = new Map<string, CellState>();
  for (const s of initialScores) {
    initialMap.set(key(s.flockId, s.birdNumber, s.definitionId), {
      scoreId: s.scoreId,
      score: s.score,
      numericValue: s.numericValue,
      textValue: s.textValue,
      status: "idle",
      photos: s.photos,
    });
  }

  const [scoreMap, setScoreMap] = useState<Map<string, CellState>>(initialMap);
  const activeFlockId = flocks[0]?.id ?? "";
  const activeFlock = flocks[0];
  const [activeBird, setActiveBird] = useState<number>(1);
  const [, startTransition] = useTransition();

  const moduleNames: string[] = [];
  const seen = new Set<string>();
  const sortedDefs = [...definitions].sort(
    (a, b) => a.module_order - b.module_order || a.order_in_module - b.order_in_module
  );
  for (const d of sortedDefs) {
    if (!seen.has(d.module)) {
      seen.add(d.module);
      moduleNames.push(d.module);
    }
  }

  const itemsByModule = new Map<string, Definition[]>();
  for (const d of sortedDefs) {
    if (!itemsByModule.has(d.module)) itemsByModule.set(d.module, []);
    itemsByModule.get(d.module)!.push(d);
  }

  const [activeModule, setActiveModule] = useState<string>(moduleNames[0] ?? "");

  function getCell(flockId: string, birdNumber: number, defId: string): CellState {
    return scoreMap.get(key(flockId, birdNumber, defId)) ?? {
      scoreId: null,
      score: null,
      numericValue: null,
      textValue: null,
      status: "idle",
      photos: [],
    };
  }

  function setCell(flockId: string, birdNumber: number, defId: string, patch: Partial<CellState>) {
    setScoreMap(prev => {
      const next = new Map(prev);
      const existing = next.get(key(flockId, birdNumber, defId)) ?? {
        scoreId: null,
        score: null,
        numericValue: null,
        textValue: null,
        status: "idle" as const,
        photos: [],
      };
      next.set(key(flockId, birdNumber, defId), { ...existing, ...patch });
      return next;
    });
  }

  async function saveScore(
    flockId: string,
    birdNumber: number,
    def: Definition,
    patch: { score?: number | null; numericValue?: number | null; textValue?: string | null }
  ) {
    const cell = getCell(flockId, birdNumber, def.id);
    setCell(flockId, birdNumber, def.id, { ...patch, status: "saving" });

    startTransition(async () => {
      const result = await upsertScore({
        visitId,
        flockId,
        birdNumber,
        definitionId: def.id,
        fieldType: def.field_type,
        scoreValue: patch.score ?? null,
        numericValue: patch.numericValue ?? null,
        textValue: patch.textValue ?? null,
      });
      if (result.ok) {
        setCell(flockId, birdNumber, def.id, { scoreId: result.scoreId, status: "saved" });
        setTimeout(() => setCell(flockId, birdNumber, def.id, { status: "idle" }), 1200);
      } else {
        setCell(flockId, birdNumber, def.id, { ...cell, status: "error", errorMsg: result.error });
      }
    });
  }

  // Compute global save state - any cell currently saving means we're saving
  let isSavingAny = false;
  let hasError = false;
  for (const c of scoreMap.values()) {
    if (c.status === "saving") isSavingAny = true;
    if (c.status === "error") hasError = true;
  }

  // Total progress
  let totalDone = 0;
  let totalCells = 0;
  for (const f of flocks) {
    for (let bird = 1; bird <= birdCount; bird++) {
      for (const d of definitions) {
        totalCells += 1;
        const c = getCell(f.id, bird, d.id);
        const hasValue =
          (d.field_type === "score" && c.score !== null) ||
          (d.field_type === "numeric" && c.numericValue !== null) ||
          (d.field_type === "sex" && c.textValue !== null);
        if (hasValue) totalDone += 1;
      }
    }
  }

  const activeDefinitions = itemsByModule.get(activeModule) ?? [];

  function handleBack() {
    if (isSavingAny) {
      alert("Please wait — still saving last changes.");
      return;
    }
    router.push("/scoring/mobile");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 border-b px-3 py-2.5"
        style={{ background: "var(--surface)", borderColor: "var(--divider)" }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-[14px]"
          style={{ color: "var(--text-2)", background: "var(--surface-2)" }}
          aria-label="Back to visits"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="truncate text-[14px] font-medium leading-tight"
               style={{ color: "var(--text-1)" }}>
            {visitFarmName}
            {activeFlock?.reference && (
              <span className="ml-1.5 font-mono text-[12px]"
                    style={{ color: "var(--text-3)" }}>
                {activeFlock.reference}
              </span>
            )}
          </div>
          {activeFlock && (
            <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Day {activeFlock.age_days} · {totalDone}/{totalCells} items
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-[11px] font-medium tabular-nums">
          {hasError ? (
            <span style={{ color: "var(--bad)" }}>⚠ Error</span>
          ) : isSavingAny ? (
            <span style={{ color: "var(--orange-500)" }}>Saving…</span>
          ) : (
            <span style={{ color: "var(--ok)" }}>✓ All saved</span>
          )}
        </div>
      </header>

      {/* Bird selector — sticky */}
      <div
        className="sticky top-[57px] z-20 flex items-center gap-2 overflow-x-auto px-3 py-2.5"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}>
          Bird
        </span>
        {Array.from({ length: birdCount }, (_, i) => i + 1).map(n => {
          const isActive = activeBird === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActiveBird(n)}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-medium transition-colors"
              style={{
                background: isActive ? "var(--green-700)" : "var(--surface-2)",
                color: isActive ? "#ffffff" : "var(--text-2)",
                border: `1px solid ${isActive ? "var(--green-700)" : "var(--border)"}`,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Module selector — sticky */}
      <div
        className="sticky top-[121px] z-20 overflow-x-auto px-3 py-2"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        <div className="flex items-center gap-2 whitespace-nowrap">
          {moduleNames.map(m => {
            const isActive = activeModule === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setActiveModule(m)}
                className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                style={{
                  background: isActive ? "var(--green-700)" : "var(--surface-2)",
                  color: isActive ? "#ffffff" : "var(--text-2)",
                  border: `1px solid ${isActive ? "var(--green-700)" : "var(--border)"}`,
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Score items */}
      <div className="pb-20">
        {flocks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="m-0 mb-3 text-[13px]" style={{ color: "var(--text-2)" }}>
              No flocks attached to this visit.
            </p>
            <Link href={`/visits/${visitId}/edit?desktop=1`} className="btn btn--primary">
              Attach flocks
            </Link>
          </div>
        ) : (
          activeDefinitions.map(d => {
            const cell = getCell(activeFlockId, activeBird, d.id);
            const startAt = d.name === "Bursa Meter" ? 1 : 0;
            const supportsPhoto = d.field_type === "score";
            const hasPhoto = cell.photos.length > 0;

            return (
              <div
                key={d.id}
                className="border-b px-4 py-3.5"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--divider)",
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium leading-tight"
                         style={{ color: "var(--text-1)" }}>
                      {d.name}
                    </div>
                    <div className="mt-0.5 text-[11px]"
                         style={{ color: "var(--text-3)" }}>
                      {d.field_type === "score" && (
                        <>{startAt} = healthy · {d.scale_max} = severe</>
                      )}
                      {d.field_type === "numeric" && "grams"}
                      {d.field_type === "sex" && "Male / Female"}
                    </div>
                  </div>
                  <div className="text-right text-[11px] flex-shrink-0"
                       style={{ color: cell.status === "error" ? "var(--bad)" : "var(--text-3)" }}>
                    {cell.status === "saving" && "Saving…"}
                    {cell.status === "saved" && (
                      <span style={{ color: "var(--ok)" }}>✓ Saved</span>
                    )}
                    {cell.status === "error" && (cell.errorMsg ?? "Error")}
                    {cell.status === "idle" &&
                      (cell.score !== null || cell.numericValue !== null || cell.textValue !== null) && (
                        <span style={{ color: "var(--text-3)" }}>Saved</span>
                      )}
                  </div>
                </div>

                {/* Score input */}
                <div className="mb-2">
                  {d.field_type === "score" && (
                    <ScoreCircles
                      scaleMax={d.scale_max}
                      startAt={startAt}
                      currentScore={cell.score}
                      onChange={(v) => saveScore(activeFlockId, activeBird, d, { score: v })}
                      disabled={cell.status === "saving"}
                    />
                  )}
                  {d.field_type === "numeric" && (
                    <NumericInput
                      current={cell.numericValue}
                      unit="g"
                      onChange={(v) => saveScore(activeFlockId, activeBird, d, { numericValue: v })}
                      disabled={cell.status === "saving"}
                    />
                  )}
                  {d.field_type === "sex" && (
                    <SexToggle
                      current={cell.textValue}
                      onChange={(v) => saveScore(activeFlockId, activeBird, d, { textValue: v })}
                      disabled={cell.status === "saving"}
                    />
                  )}
                </div>

                {/* Photo button */}
                {supportsPhoto && (
                  <div className="mt-3 flex items-center gap-2">
                    <PhotoCapture
                      visitId={visitId}
                      visitScoreId={cell.scoreId}
                      onScoreNeeded={async () => null}
                      initialPhotos={cell.photos}
                    />
                  </div>
                )}

                {/* AI Assist Panel — only when score row exists and has photo */}
                {cell.scoreId && hasPhoto && d.field_type === "score" ? (
                  <div className="mt-3">
                    <AIAssistPanel
                      visitId={visitId}
                      definitionId={d.id}
                      flockId={activeFlockId}
                      birdNumber={activeBird}
                      hasPhoto={hasPhoto}
                      currentScore={cell.score}
                      onAccept={(score, scoreText) => {
                        if (d.field_type === "score") {
                          setCell(activeFlockId, activeBird, d.id, { score: score, status: "saved" });
                        } else if (d.field_type === "numeric") {
                          setCell(activeFlockId, activeBird, d.id, { numericValue: score, status: "saved" });
                        } else if (d.field_type === "sex") {
                          setCell(activeFlockId, activeBird, d.id, { textValue: scoreText, status: "saved" });
                        }
                        setTimeout(() => setCell(activeFlockId, activeBird, d.id, { status: "idle" }), 1200);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
