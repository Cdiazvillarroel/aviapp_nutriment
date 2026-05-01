"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScoreCircles } from "../score-circles";
import { SexToggle } from "../sex-toggle";
import { NumericInput } from "../numeric-input";
import { AIAssistPanel } from "../ai-assist-panel";
import {
  saveVisitScoreLocal,
  savePhotoLocal,
  getOfflineScoringPayload,
} from "@/lib/offline/repository";
import {
  downloadVisitForOffline,
} from "@/lib/offline/sync";
import {
  useOnlineStatus,
  usePendingMutations,
  emitPendingChanged,
} from "@/lib/offline/use-online-status";

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
  offlineLoadOnly?: boolean;
}

interface CellState {
  scoreId: string | null;
  score: number | null;
  numericValue: number | null;
  textValue: string | null;
  status: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
  photos: { id: string; url: string; isLocal?: boolean }[];
}

function key(flockId: string, birdNumber: number, defId: string) {
  return `${flockId}::${birdNumber}::${defId}`;
}

export function MobileScoringClient(props: Props) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingMutations();

  // State for visit data — starts from server props, overridden if loaded from IndexedDB
  const [visitData, setVisitData] = useState({
    farmName: props.visitFarmName,
    birdCount: props.birdCount,
    flocks: props.flocks,
    definitions: props.definitions,
    initialScores: props.initialScores,
  });

  const [loadedFromOffline, setLoadedFromOffline] = useState(false);
  const [loadingOffline, setLoadingOffline] = useState(props.offlineLoadOnly === true);
  const [cachedForOffline, setCachedForOffline] = useState(false);

  // On mount: try to load from IndexedDB if needed
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // If we're in offline-only mode (server returned nothing), try IndexedDB
      if (props.offlineLoadOnly) {
        try {
          const payload = await getOfflineScoringPayload(props.visitId);
          if (cancelled) return;

          if (payload && payload.visit) {
            setVisitData({
              farmName: payload.farm?.name ?? "Unknown farm",
              birdCount: payload.visit.bird_count ?? 5,
              flocks: payload.flocks.map((f) => ({
                id: f.id,
                reference: f.reference,
                house_name: f.house_name ?? "—",
                breed_name: f.breed_name ?? null,
                age_days: f.age_days ?? 0,
              })),
              definitions: payload.definitions.map((d) => ({
                id: d.id,
                name: d.name,
                scale_max: d.scale_max,
                module: d.module,
                module_order: d.module_order,
                order_in_module: d.order_in_module,
                field_type: d.field_type,
              })),
              initialScores: payload.scores.map((s) => ({
                flockId: s.flock_id,
                birdNumber: s.bird_number,
                definitionId: s.definition_id,
                scoreId: s.id,
                score: s.score,
                numericValue: s.numeric_value,
                textValue: s.text_value,
                photos: (s.photos ?? []).map((p) => ({
                  id: p.id,
                  url: p.url ?? "",
                  isLocal: p._is_local === true,
                })),
              })),
            });
            setLoadedFromOffline(true);
          }
        } catch {
          // IndexedDB might not have data — show empty state
        } finally {
          if (!cancelled) setLoadingOffline(false);
        }
      } else if (isOnline) {
        // We have server data and we're online — pre-cache for offline use in background
        try {
          await downloadVisitForOffline(props.visitId);
          if (!cancelled) setCachedForOffline(true);
        } catch {
          // Silent fail — pre-cache is best-effort
        }
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visitId]);

  // Initialize cells from current data
  const [scoreMap, setScoreMap] = useState<Map<string, CellState>>(new Map());

  // Re-init scoreMap when visitData changes (e.g., loaded from IndexedDB)
  useEffect(() => {
    const map = new Map<string, CellState>();
    for (const s of visitData.initialScores) {
      map.set(key(s.flockId, s.birdNumber, s.definitionId), {
        scoreId: s.scoreId,
        score: s.score,
        numericValue: s.numericValue,
        textValue: s.textValue,
        status: "idle",
        photos: s.photos,
      });
    }
    setScoreMap(map);
  }, [visitData]);

  const activeFlockId = visitData.flocks[0]?.id ?? "";
  const activeFlock = visitData.flocks[0];
  const [activeBird, setActiveBird] = useState<number>(1);
  const [, startTransition] = useTransition();

  const moduleNames: string[] = [];
  const seen = new Set<string>();
  const sortedDefs = [...visitData.definitions].sort(
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

  const [activeModule, setActiveModule] = useState<string>("");

  // Set first module as active when modules load
  useEffect(() => {
    if (moduleNames.length > 0 && !activeModule) {
      setActiveModule(moduleNames[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleNames.length]);

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

  // Save to IndexedDB - always local first.
  // Sync to server happens later via "Sync now" button on home.
  async function saveScore(
    flockId: string,
    birdNumber: number,
    def: Definition,
    patch: { score?: number | null; numericValue?: number | null; textValue?: string | null }
  ) {
    setCell(flockId, birdNumber, def.id, { ...patch, status: "saving" });

    try {
      const result = await saveVisitScoreLocal({
        visitId: props.visitId,
        flockId,
        birdNumber,
        definitionId: def.id,
        fieldType: def.field_type,
        scoreValue: patch.score ?? null,
        numericValue: patch.numericValue ?? null,
        textValue: patch.textValue ?? null,
      });
      setCell(flockId, birdNumber, def.id, { scoreId: result.scoreId, status: "saved" });
      emitPendingChanged();
      setTimeout(() => setCell(flockId, birdNumber, def.id, { status: "idle" }), 1200);
    } catch (e: any) {
      setCell(flockId, birdNumber, def.id, { status: "error", errorMsg: e?.message });
    }
  }

  // Photo capture - save blob locally
  async function handlePhotoCapture(
    flockId: string,
    birdNumber: number,
    def: Definition,
    file: File
  ) {
    const cell = getCell(flockId, birdNumber, def.id);
    if (!cell.scoreId) {
      // Need a score row first
      alert("Please set a score before adding a photo.");
      return;
    }

    try {
      const result = await savePhotoLocal({
        visitId: props.visitId,
        visitScoreId: cell.scoreId,
        blob: file,
      });

      // Create local URL for preview
      const localUrl = URL.createObjectURL(file);
      setCell(flockId, birdNumber, def.id, {
        photos: [...cell.photos, { id: result.photoId, url: localUrl, isLocal: true }],
      });
      emitPendingChanged();
    } catch (e: any) {
      alert(`Failed to save photo: ${e?.message ?? "unknown error"}`);
    }
  }

  // Compute global save state
  let isSavingAny = false;
  let hasError = false;
  for (const c of scoreMap.values()) {
    if (c.status === "saving") isSavingAny = true;
    if (c.status === "error") hasError = true;
  }

  // Total progress
  let totalDone = 0;
  let totalCells = 0;
  for (const f of visitData.flocks) {
    for (let bird = 1; bird <= visitData.birdCount; bird++) {
      for (const d of visitData.definitions) {
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
    router.push("/scoring/mobile");
  }

  // ============= RENDER =============

  // Loading state
  if (loadingOffline) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6"
           style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <p className="m-0 text-[14px]" style={{ color: "var(--text-2)" }}>
            Loading offline data…
          </p>
        </div>
      </div>
    );
  }

  // Empty state — no data available, online or offline
  if (!loadingOffline && visitData.flocks.length === 0 && visitData.definitions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6"
           style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <p className="m-0 mb-3 text-[14px]" style={{ color: "var(--text-1)" }}>
            This visit isn&apos;t available offline.
          </p>
          <p className="m-0 mb-5 text-[12px]" style={{ color: "var(--text-3)" }}>
            Connect to WiFi and open this visit at least once to enable offline access.
          </p>
          <Link
            href="/scoring/mobile"
            className="inline-block rounded-md px-4 py-2 text-[13px] font-medium"
            style={{ background: "var(--green-700)", color: "#fff" }}
          >
            Back to visits
          </Link>
        </div>
      </div>
    );
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
            {visitData.farmName}
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
          {!isOnline ? (
            <span style={{ color: "var(--orange-500)" }}>● Offline</span>
          ) : pendingCount > 0 ? (
            <span style={{ color: "var(--orange-500)" }}>{pendingCount} pending</span>
          ) : isSavingAny ? (
            <span style={{ color: "var(--orange-500)" }}>Saving…</span>
          ) : hasError ? (
            <span style={{ color: "var(--bad)" }}>⚠ Error</span>
          ) : (
            <span style={{ color: "var(--ok)" }}>✓ Saved</span>
          )}
        </div>
      </header>

      {/* Bird selector */}
      <div className="sticky top-[57px] z-20 flex items-center gap-2 overflow-x-auto px-3 py-2.5"
           style={{ background: "var(--surface)", borderBottom: "1px solid var(--divider)" }}>
        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}>
          Bird
        </span>
        {Array.from({ length: visitData.birdCount }, (_, i) => i + 1).map(n => {
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

      {/* Module selector */}
      <div className="sticky top-[121px] z-20 overflow-x-auto px-3 py-2"
           style={{ background: "var(--surface)", borderBottom: "1px solid var(--divider)" }}>
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
        {activeDefinitions.map(d => {
          const cell = getCell(activeFlockId, activeBird, d.id);
          const startAt = d.name === "Bursa Meter" ? 1 : 0;
          const supportsPhoto = d.field_type === "score";
          const hasPhoto = cell.photos.length > 0;

          return (
            <div
              key={d.id}
              className="border-b px-4 py-3.5"
              style={{ background: "var(--surface)", borderColor: "var(--divider)" }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium leading-tight"
                       style={{ color: "var(--text-1)" }}>
                    {d.name}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
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

              {/* Photo input - native file input with capture */}
              {supportsPhoto && (
                <div className="mt-3 flex items-center gap-3">
                  {cell.photos.map((p) => (
                    <div
                      key={p.id}
                      className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {p.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt="" className="h-full w-full object-cover" />
                      )}
                      {p.isLocal && (
                        <span
                          className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-medium"
                          style={{ background: "rgba(226,125,46,0.9)", color: "#fff" }}
                        >
                          Pending
                        </span>
                      )}
                    </div>
                  ))}
                  <label
                    className="flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-[20px]"
                    style={{ borderColor: "var(--border)", color: "var(--text-3)" }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoCapture(activeFlockId, activeBird, d, file);
                        e.target.value = "";
                      }}
                    />
                    +
                  </label>
                </div>
              )}

              {/* AI Assist - only if has uploaded photo (not local-only) */}
              {cell.scoreId && hasPhoto && d.field_type === "score" &&
               cell.photos.some((p) => !p.isLocal) && isOnline ? (
                <div className="mt-3">
                  <AIAssistPanel
                    visitId={props.visitId}
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
              ) : cell.scoreId && hasPhoto && d.field_type === "score" && !isOnline ? (
                <div className="mt-3 rounded-md px-3 py-2 text-[11px]"
                     style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                  AI Assist requires internet. Sync when back online.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
