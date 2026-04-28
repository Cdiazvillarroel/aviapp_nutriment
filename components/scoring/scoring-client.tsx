"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  upsertScore,
  setBirdCount,
  deleteBird,
  updateVisitTreatment,
} from "@/app/(app)/scoring/actions";
import { ScoreCircles } from "./score-circles";
import { SexToggle } from "./sex-toggle";
import { NumericInput } from "./numeric-input";
import { PhotoCapture } from "./photo-capture";
import { AIAssistPanel } from "./ai-assist-panel";
import { IconCheckSquare, IconHome } from "@/components/ui/icons";

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

interface VisitTreatment {
  coccidiostat: string | null;
  other_treatment: string | null;
}

interface Props {
  visitId: string;
  visitFarmName: string;
  visitDate: string;
  initialBirdCount: number;
  initialTreatment: VisitTreatment;
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

export function ScoringClient({
  visitId,
  visitFarmName,
  visitDate,
  initialBirdCount,
  initialTreatment,
  flocks,
  definitions,
  initialScores,
}: Props) {
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
  const [activeFlockId, setActiveFlockId] = useState<string>(flocks[0]?.id ?? "");
  const [activeBird, setActiveBird] = useState<number>(1);
  const [birdCount, setBirdCountState] = useState<number>(Math.max(initialBirdCount, 1));
  const [activeModule, setActiveModule] = useState<string>(
    [...new Set(definitions.map(d => d.module))][0] ?? ""
  );
  const [coccidiostat, setCoccidiostat] = useState<string>(initialTreatment.coccidiostat ?? "");
  const [otherTreatment, setOtherTreatment] = useState<string>(initialTreatment.other_treatment ?? "");
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

  const activeFlock = flocks.find(f => f.id === activeFlockId);

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

  function addBird() {
    const next = birdCount + 1;
    setBirdCountState(next);
    setActiveBird(next);
    startTransition(async () => { await setBirdCount(visitId, next); });
  }

  function removeBird(n: number) {
    if (birdCount <= 1) return;
    if (!confirm(`Remove Bird ${n}? All its scores for this visit will be deleted.`)) return;

    startTransition(async () => {
      await deleteBird(visitId, n);
      setScoreMap(prev => {
        const next = new Map<string, CellState>();
        for (const [k, v] of prev) {
          const [flockId, birdStr, defId] = k.split("::");
          const birdNum = parseInt(birdStr, 10);
          if (birdNum === n) continue;
          const newBirdNum = birdNum > n ? birdNum - 1 : birdNum;
          next.set(`${flockId}::${newBirdNum}::${defId}`, v);
        }
        return next;
      });
      const newCount = birdCount - 1;
      setBirdCountState(newCount);
      setActiveBird(prev => Math.min(prev, newCount));
      await setBirdCount(visitId, newCount);
    });
  }

  function commitTreatment(field: "coccidiostat" | "other_treatment", value: string) {
    startTransition(async () => {
      await updateVisitTreatment(visitId, { [field]: value || null });
    });
  }

  const totalCellsForBird = definitions.length * flocks.length;
  let scoredCellsForBird = 0;
  for (const f of flocks) {
    for (const d of definitions) {
      const c = getCell(f.id, activeBird, d.id);
      const hasValue =
        (d.field_type === "score" && c.score !== null) ||
        (d.field_type === "numeric" && c.numericValue !== null) ||
        (d.field_type === "sex" && c.textValue !== null);
      if (hasValue) scoredCellsForBird += 1;
    }
  }

  const activeDefinitions = itemsByModule.get(activeModule) ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
            <Link href={`/visits/${visitId}`} style={{ color: "var(--text-2)" }}>← Back to visit</Link>
          </div>
          <h1>Scoring · {visitFarmName}</h1>
          <div className="page-header__sub">
            {visitDate} · {scoredCellsForBird}/{totalCellsForBird} items for Bird {activeBird} · autosaving
          </div>
        </div>
      </div>

      <div
        className="mb-5 grid items-center gap-4 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)", gridTemplateColumns: "1fr 1fr" }}
      >
        <label className="block">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Coccidiostat
          </div>
          <input
            type="text"
            className="input"
            value={coccidiostat}
            onChange={(e) => setCoccidiostat(e.target.value)}
            onBlur={() => commitTreatment("coccidiostat", coccidiostat)}
            placeholder="—"
          />
        </label>
        <label className="block">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Other treatment
          </div>
          <input
            type="text"
            className="input"
            value={otherTreatment}
            onChange={(e) => setOtherTreatment(e.target.value)}
            onBlur={() => commitTreatment("other_treatment", otherTreatment)}
            placeholder="—"
          />
        </label>
      </div>

      {flocks.length > 1 && (
        <div className="mb-3 flex items-center gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
          {flocks.map(f => {
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
                <IconHome size={13} />
                <span className="font-mono">{f.reference ?? "—"}</span>
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                  {f.house_name} · {f.age_days}d
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-5 flex items-center gap-1 overflow-x-auto">
        {Array.from({ length: birdCount }, (_, i) => i + 1).map(n => {
          const isActive = activeBird === n;
          return (
            <div key={n} className="flex items-center gap-1">
              <button
                onClick={() => setActiveBird(n)}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  background: isActive ? "var(--green-100)" : "var(--surface-2)",
                  color: isActive ? "var(--green-700)" : "var(--text-2)",
                  border: `1px solid ${isActive ? "var(--green-700)" : "var(--border)"}`,
                }}
              >
                Bird {n}
              </button>
              {birdCount > 1 && isActive && (
                <button
                  onClick={() => removeBird(n)}
                  className="text-[14px] leading-none"
                  title={`Remove Bird ${n}`}
                  style={{ color: "var(--text-3)" }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={addBird}
          className="ml-1 rounded-md px-3 py-1.5 text-[12px] font-medium"
          style={{
            color: "var(--green-700)",
            border: "1px dashed var(--green-700)",
            background: "transparent",
          }}
        >
          + Bird
        </button>
      </div>

      {flocks.length === 0 ? (
        <div className="card">
          <div className="card__body text-center" style={{ padding: "60px 24px" }}>
            <div className="font-display text-xl mb-2" style={{ fontVariationSettings: "'opsz' 48", color: "var(--text-2)" }}>
              No flocks attached to this visit
            </div>
            <p className="m-0 mb-4 text-[13px]" style={{ color: "var(--text-2)" }}>
              You need to attach at least one flock before scoring.
            </p>
            <Link href={`/visits/${visitId}/edit`} className="btn btn--primary">
              Attach flocks
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "200px 1fr" }}>
          <aside className="self-start">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
              Modules
            </div>
            <div className="flex flex-col gap-px">
              {moduleNames.map(m => {
                const isActive = activeModule === m;
                const itemsInModule = (itemsByModule.get(m) ?? []).length;
                let scored = 0;
                if (activeFlockId) {
                  for (const d of itemsByModule.get(m) ?? []) {
                    const c = getCell(activeFlockId, activeBird, d.id);
                    const hasValue =
                      (d.field_type === "score" && c.score !== null) ||
                      (d.field_type === "numeric" && c.numericValue !== null) ||
                      (d.field_type === "sex" && c.textValue !== null);
                    if (hasValue) scored += 1;
                  }
                }
                return (
                  <button
                    key={m}
                    onClick={() => setActiveModule(m)}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-left text-[13px] transition-colors"
                    style={{
                      background: isActive ? "var(--green-700)" : "transparent",
                      color: isActive ? "var(--text-inv)" : "var(--text-2)",
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    <span>{m}</span>
                    <span
                      className="text-[10px] tabular-nums"
                      style={{
                        color: isActive ? "rgba(255,255,255,0.85)" : "var(--text-3)",
                      }}
                    >
                      {scored}/{itemsInModule}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                <IconCheckSquare size={16} />
                {activeModule}
                {activeFlock && (
                  <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-3)" }}>
                    {activeFlock.reference ?? "—"} · Bird {activeBird}
                  </span>
                )}
              </h2>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {activeDefinitions.length} item{activeDefinitions.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="card__body card__body--flush">
              {activeDefinitions.map(d => {
                if (!activeFlockId) return null;
                const cell = getCell(activeFlockId, activeBird, d.id);
                return (
                  <ScoreItemRow
                    key={d.id}
                    visitId={visitId}
                    flockId={activeFlockId}
                    birdNumber={activeBird}
                    definition={d}
                    cell={cell}
                    onScoreChange={(v) => saveScore(activeFlockId, activeBird, d, { score: v })}
                    onNumericChange={(v) => saveScore(activeFlockId, activeBird, d, { numericValue: v })}
                    onSexChange={(v) => saveScore(activeFlockId, activeBird, d, { textValue: v })}
                    onAIAccept={(score, scoreText) => {
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
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreItemRow({
  visitId, flockId, birdNumber, definition, cell, onScoreChange, onNumericChange, onSexChange, onAIAccept,
}: {
  visitId: string;
  flockId: string;
  birdNumber: number;
  definition: Definition;
  cell: CellState;
  onScoreChange: (value: number | null) => void;
  onNumericChange: (value: number | null) => void;
  onSexChange: (value: string | null) => void;
  onAIAccept: (score: number, scoreText: string) => void;
}) {
  const supportsPhoto = definition.field_type === "score";
  const startAt = definition.name === "Bursa Meter" ? 1 : 0;
  const hasPhoto = cell.photos.length > 0;

  return (
    <div
      className="border-b px-5 py-4 last:border-b-0"
      style={{ borderColor: "var(--divider)" }}
    >
      <div
        className="grid items-center gap-4"
        style={{ gridTemplateColumns: "1.4fr auto 1.5fr 80px" }}
      >
        <div>
          <div className="text-[13px] font-medium">{definition.name}</div>
          <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {definition.field_type === "score" && (
              <>
                {startAt} = healthy · {definition.scale_max} = severe
              </>
            )}
            {definition.field_type === "numeric" && "grams"}
            {definition.field_type === "sex" && "Male / Female"}
          </div>
        </div>

        <div>
          {definition.field_type === "score" && (
            <ScoreCircles
              scaleMax={definition.scale_max}
              startAt={startAt}
              currentScore={cell.score}
              onChange={onScoreChange}
              disabled={cell.status === "saving"}
            />
          )}
          {definition.field_type === "numeric" && (
            <NumericInput
              current={cell.numericValue}
              unit="g"
              onChange={onNumericChange}
              disabled={cell.status === "saving"}
            />
          )}
          {definition.field_type === "sex" && (
            <SexToggle
              current={cell.textValue}
              onChange={onSexChange}
              disabled={cell.status === "saving"}
            />
          )}
        </div>

        <div>
          {supportsPhoto ? (
            <PhotoCapture
              visitId={visitId}
              visitScoreId={cell.scoreId}
              onScoreNeeded={async () => null}
              initialPhotos={cell.photos}
            />
          ) : null}
        </div>

        <div className="text-right text-[11px]" style={{ color: cell.status === "error" ? "var(--bad)" : "var(--text-3)" }}>
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

      {/* AI Assist Panel — only when score row exists and has photo */}
      {cell.scoreId && hasPhoto && definition.field_type === "score" ? (
        <div className="mt-3">
          <AIAssistPanel
            visitId={visitId}
            definitionId={definition.id}
            flockId={flockId}
            birdNumber={birdNumber}
            hasPhoto={hasPhoto}
            currentScore={cell.score}
            onAccept={onAIAccept}
          />
        </div>
      ) : null}
    </div>
  );
}
