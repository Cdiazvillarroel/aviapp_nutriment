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
      </d
