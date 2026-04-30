"use client";

import { useState, useTransition } from "react";

interface ScoringDef {
  id: string;
  name: string;
  module: string;
  scale_max: number;
  field_type: "score" | "numeric" | "sex";
}

interface Cell {
  scoreId: string | null;
  score: number | null;
  numericValue: number | null;
  textValue: string | null;
  hasPhoto: boolean;
}

interface Props {
  definition: ScoringDef;
  cell: Cell;
  visitId: string;
  flockId: string;
  birdNumber: number;
  onScoreChange: (
    definitionId: string,
    birdNumber: number,
    update: Partial<Cell>
  ) => void;
  onAIRequest: (definitionId: string, birdNumber: number) => void;
  upsertScore: (formData: FormData) => Promise<{ ok: boolean; scoreId?: string; error?: string }>;
  uploadPhoto: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

export function ScoreItemMobile(props: Props) {
  const { definition, cell } = props;
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  // Bursa Meter scale starts at 1, others at 0
  const minScore = definition.name === "Bursa Meter" ? 1 : 0;
  const maxScore = definition.scale_max;

  function handleScoreSelect(score: number) {
    const fd = new FormData();
    fd.append("visitId", props.visitId);
    fd.append("definitionId", definition.id);
    fd.append("flockId", props.flockId);
    fd.append("birdNumber", String(props.birdNumber));
    fd.append("score", String(score));

    startTransition(async function () {
      const result = await props.upsertScore(fd);
      if (result.ok) {
        props.onScoreChange(definition.id, props.birdNumber, {
          score,
          scoreId: result.scoreId ?? cell.scoreId,
        });
      }
    });
  }

  function handleNumericChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value);
    if (isNaN(value)) return;

    const fd = new FormData();
    fd.append("visitId", props.visitId);
    fd.append("definitionId", definition.id);
    fd.append("flockId", props.flockId);
    fd.append("birdNumber", String(props.birdNumber));
    fd.append("numericValue", String(value));

    startTransition(async function () {
      const result = await props.upsertScore(fd);
      if (result.ok) {
        props.onScoreChange(definition.id, props.birdNumber, {
          numericValue: value,
          scoreId: result.scoreId ?? cell.scoreId,
        });
      }
    });
  }

  function handleSexChange(value: "M" | "F") {
    const fd = new FormData();
    fd.append("visitId", props.visitId);
    fd.append("definitionId", definition.id);
    fd.append("flockId", props.flockId);
    fd.append("birdNumber", String(props.birdNumber));
    fd.append("textValue", value);

    startTransition(async function () {
      const result = await props.upsertScore(fd);
      if (result.ok) {
        props.onScoreChange(definition.id, props.birdNumber, {
          textValue: value,
          scoreId: result.scoreId ?? cell.scoreId,
        });
      }
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!cell.scoreId) {
      // Need to save score first to get scoreId
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    fd.append("scoreId", cell.scoreId);
    fd.append("visitId", props.visitId);

    try {
      const result = await props.uploadPhoto(fd);
      if (result.ok) {
        props.onScoreChange(definition.id, props.birdNumber, { hasPhoto: true });
      }
    } finally {
      setUploading(false);
    }
  }

  // Determine current value for rendering
  const currentValue =
    definition.field_type === "score"
      ? cell.score
      : definition.field_type === "numeric"
      ? cell.numericValue
      : cell.textValue;

  const isFilled = currentValue !== null && currentValue !== undefined;

  return (
    <div
      className="border-b px-4 py-3.5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--divider)",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium leading-tight" style={{ color: "var(--text-1)" }}>
            {definition.name}
          </div>
          {definition.field_type === "score" && (
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
              {minScore} = healthy · {maxScore} = severe
            </div>
          )}
        </div>

        {/* Photo button */}
        <label
          className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-md"
          style={{
            background: cell.hasPhoto ? "var(--green-50)" : "transparent",
            border: `1px dashed ${cell.hasPhoto ? "var(--green-700)" : "var(--border)"}`,
          }}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
            disabled={uploading || !cell.scoreId}
          />
          {cell.hasPhoto ? (
            <span style={{ color: "var(--green-700)" }}>✓</span>
          ) : (
            <span style={{ color: "var(--text-3)", fontSize: "20px" }}>📷</span>
          )}
        </label>
      </div>

      {/* Score buttons / numeric input / sex toggle */}
      <div className="mt-3">
        {definition.field_type === "score" && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {Array.from(
              { length: maxScore - minScore + 1 },
              function (_, i) { return minScore + i; }
            ).map(function (n) {
              const isSelected = cell.score === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={function () { handleScoreSelect(n); }}
                  disabled={isPending}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-medium transition-colors"
                  style={{
                    background: isSelected ? "var(--green-700)" : "var(--surface-2)",
                    color: isSelected ? "#ffffff" : "var(--text-2)",
                    border: `1.5px solid ${isSelected ? "var(--green-700)" : "var(--border)"}`,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}

        {definition.field_type === "numeric" && (
          <input
            type="number"
            inputMode="decimal"
            placeholder="grams"
            defaultValue={cell.numericValue ?? ""}
            onBlur={handleNumericChange}
            disabled={isPending}
            className="w-full rounded-md px-3 py-2.5 text-[16px]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-1)",
            }}
          />
        )}

        {definition.field_type === "sex" && (
          <div className="flex items-center gap-3">
            {(["M", "F"] as const).map(function (s) {
              const isSelected = cell.textValue === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={function () { handleSexChange(s); }}
                  disabled={isPending}
                  className="flex h-12 flex-1 items-center justify-center rounded-md text-[16px] font-medium transition-colors"
                  style={{
                    background: isSelected ? "var(--green-700)" : "var(--surface-2)",
                    color: isSelected ? "#ffffff" : "var(--text-2)",
                    border: `1.5px solid ${isSelected ? "var(--green-700)" : "var(--border)"}`,
                  }}
                >
                  {s === "M" ? "Male" : "Female"}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Saved indicator */}
      {isFilled && (
        <div
          className="mt-2 text-[11px]"
          style={{ color: "var(--text-3)" }}
        >
          {isPending ? "Saving..." : "✓ Saved"}
        </div>
      )}
    </div>
  );
}
