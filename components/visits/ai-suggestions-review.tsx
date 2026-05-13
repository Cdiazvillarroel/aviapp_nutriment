"use client";

import { useState, useTransition } from "react";
import {
  acceptSuggestion,
  rejectSuggestion,
  modifySuggestion,
  confirmMatch,
  acceptAllClean,
} from "@/app/(app)/visits/[id]/_actions/review-suggestions";

interface Suggestion {
  id: string;
  recording_id: string;
  bird_number: number | null;
  definition: {
    id: string;
    name: string;
    module: string;
    field_type: "score" | "numeric" | "sex";
    scale_max: number;
  };
  suggested_score: number | null;
  suggested_numeric: number | null;
  suggested_text: string | null;
  quote: string | null;
  conflicts_with_score_id: string | null;
  existing_score_value: number | null;
  existing_numeric_value: number | null;
  existing_text_value: string | null;
}

interface Props {
  suggestions: Suggestion[];
}

type Category = "match" | "conflict" | "new";

function categorize(s: Suggestion): Category {
  if (!s.conflicts_with_score_id) return "new";

  // Compare AI value vs existing value based on field_type
  if (s.definition.field_type === "score") {
    return s.suggested_score === s.existing_score_value ? "match" : "conflict";
  }
  if (s.definition.field_type === "numeric") {
    return Number(s.suggested_numeric) === Number(s.existing_numeric_value) ? "match" : "conflict";
  }
  if (s.definition.field_type === "sex") {
    return s.suggested_text === s.existing_text_value ? "match" : "conflict";
  }
  return "new";
}

function formatValue(s: Suggestion, kind: "suggested" | "existing"): string {
  if (s.definition.field_type === "score") {
    const v = kind === "suggested" ? s.suggested_score : s.existing_score_value;
    return v == null ? "—" : String(v);
  }
  if (s.definition.field_type === "numeric") {
    const v = kind === "suggested" ? s.suggested_numeric : s.existing_numeric_value;
    return v == null ? "—" : `${v}`;
  }
  if (s.definition.field_type === "sex") {
    const v = kind === "suggested" ? s.suggested_text : s.existing_text_value;
    return v ?? "—";
  }
  return "—";
}

export function AISuggestionsReview({ suggestions }: Props) {
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [modifyValue, setModifyValue] = useState<string>("");

  if (suggestions.length === 0) return null;

  // Group by category
  const grouped: Record<Category, Suggestion[]> = {
    match: [],
    conflict: [],
    new: [],
  };
  for (const s of suggestions) {
    grouped[categorize(s)].push(s);
  }

  // For bulk accept: only count "new" (clean, no conflict)
  const cleanCount = grouped.new.length;
  const recordingId = suggestions[0]?.recording_id;

  const handleAccept = (id: string) => {
    setLoadingId(id);
    startTransition(async () => {
      await acceptSuggestion(id);
      setLoadingId(null);
    });
  };

  const handleReject = (id: string) => {
    setLoadingId(id);
    startTransition(async () => {
      await rejectSuggestion(id);
      setLoadingId(null);
    });
  };

  const handleConfirmMatch = (id: string) => {
    setLoadingId(id);
    startTransition(async () => {
      await confirmMatch(id);
      setLoadingId(null);
    });
  };

  const handleStartModify = (s: Suggestion) => {
    setModifyingId(s.id);
    setModifyValue(formatValue(s, "suggested"));
  };

  const handleCancelModify = () => {
    setModifyingId(null);
    setModifyValue("");
  };

  const handleSaveModify = (s: Suggestion) => {
    setLoadingId(s.id);
    const newValue: { score?: number | null; numeric?: number | null; text?: string | null } = {};
    if (s.definition.field_type === "score") {
      newValue.score = parseInt(modifyValue, 10);
    } else if (s.definition.field_type === "numeric") {
      newValue.numeric = parseFloat(modifyValue);
    } else if (s.definition.field_type === "sex") {
      newValue.text = modifyValue.toLowerCase().trim();
    }
    startTransition(async () => {
      await modifySuggestion(s.id, newValue);
      setLoadingId(null);
      setModifyingId(null);
      setModifyValue("");
    });
  };

  const handleAcceptAllClean = () => {
    if (!recordingId) return;
    setLoadingId("bulk");
    startTransition(async () => {
      await acceptAllClean(recordingId);
      setLoadingId(null);
    });
  };

  return (
    <div className="space-y-3">
      {/* Bulk actions header */}
      <div className="card">
        <div className="card__body" style={{ padding: 16 }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="card__title text-[13px] font-medium m-0">
                🎯 AI Score Suggestions · {suggestions.length} pending
              </h3>
              <p className="m-0 mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                {grouped.new.length} new
                {grouped.match.length > 0 ? ` · ${grouped.match.length} confirms manual` : ""}
                {grouped.conflict.length > 0 ? ` · ${grouped.conflict.length} conflicts` : ""}
              </p>
            </div>
            {cleanCount > 0 ? (
              <button
                type="button"
                onClick={handleAcceptAllClean}
                disabled={pending || loadingId === "bulk"}
                className="btn btn--primary text-[12px]"
              >
                {loadingId === "bulk" ? "Accepting…" : `Accept all clean (${cleanCount})`}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Match group */}
      {grouped.match.length > 0 ? (
        <SuggestionGroup
          title="✅ Confirms manual scoring"
          accentColor="var(--green-700)"
          suggestions={grouped.match}
          renderCard={s => (
            <SuggestionCard
              s={s}
              category="match"
              loading={loadingId === s.id}
              disabled={pending}
              modifying={modifyingId === s.id}
              modifyValue={modifyValue}
              setModifyValue={setModifyValue}
              onAccept={handleAccept}
              onReject={handleReject}
              onConfirmMatch={handleConfirmMatch}
              onStartModify={handleStartModify}
              onCancelModify={handleCancelModify}
              onSaveModify={handleSaveModify}
            />
          )}
        />
      ) : null}

      {/* Conflict group */}
      {grouped.conflict.length > 0 ? (
        <SuggestionGroup
          title="⚠️ Conflicts with manual scoring"
          accentColor="var(--bad)"
          suggestions={grouped.conflict}
          renderCard={s => (
            <SuggestionCard
              s={s}
              category="conflict"
              loading={loadingId === s.id}
              disabled={pending}
              modifying={modifyingId === s.id}
              modifyValue={modifyValue}
              setModifyValue={setModifyValue}
              onAccept={handleAccept}
              onReject={handleReject}
              onConfirmMatch={handleConfirmMatch}
              onStartModify={handleStartModify}
              onCancelModify={handleCancelModify}
              onSaveModify={handleSaveModify}
            />
          )}
        />
      ) : null}

      {/* New group */}
      {grouped.new.length > 0 ? (
        <SuggestionGroup
          title="🆕 New scores from voice"
          accentColor="var(--text-2)"
          suggestions={grouped.new}
          renderCard={s => (
            <SuggestionCard
              s={s}
              category="new"
              loading={loadingId === s.id}
              disabled={pending}
              modifying={modifyingId === s.id}
              modifyValue={modifyValue}
              setModifyValue={setModifyValue}
              onAccept={handleAccept}
              onReject={handleReject}
              onConfirmMatch={handleConfirmMatch}
              onStartModify={handleStartModify}
              onCancelModify={handleCancelModify}
              onSaveModify={handleSaveModify}
            />
          )}
        />
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------

function SuggestionGroup({
  title,
  accentColor,
  suggestions,
  renderCard,
}: {
  title: string;
  accentColor: string;
  suggestions: Suggestion[];
  renderCard: (s: Suggestion) => React.ReactNode;
}) {
  return (
    <div>
      <h4
        className="text-[11px] font-medium uppercase tracking-widest mb-2"
        style={{ color: accentColor }}
      >
        {title} ({suggestions.length})
      </h4>
      <div className="space-y-2">
        {suggestions.map(s => (
          <div key={s.id}>{renderCard(s)}</div>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  s,
  category,
  loading,
  disabled,
  modifying,
  modifyValue,
  setModifyValue,
  onAccept,
  onReject,
  onConfirmMatch,
  onStartModify,
  onCancelModify,
  onSaveModify,
}: {
  s: Suggestion;
  category: Category;
  loading: boolean;
  disabled: boolean;
  modifying: boolean;
  modifyValue: string;
  setModifyValue: (v: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onConfirmMatch: (id: string) => void;
  onStartModify: (s: Suggestion) => void;
  onCancelModify: () => void;
  onSaveModify: (s: Suggestion) => void;
}) {
  const valueLabel = (() => {
    if (s.definition.field_type === "score") return "Score";
    if (s.definition.field_type === "numeric") return "Value";
    if (s.definition.field_type === "sex") return "Sex";
    return "";
  })();

  const unit = s.definition.field_type === "numeric" ? "" : "";
  const bird = s.bird_number != null ? `Bird ${s.bird_number}` : "Bird ?";

  return (
    <div className="card">
      <div className="card__body" style={{ padding: 14 }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="text-[13px] font-medium">
              {s.definition.name}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {s.definition.module} · {bird}
            </div>
          </div>
          <div className="text-right shrink-0">
            {category === "conflict" ? (
              <div className="text-[11px]">
                <span style={{ color: "var(--text-3)" }}>Manual:</span>{" "}
                <span style={{ color: "var(--text-1)" }}>{formatValue(s, "existing")}</span>
                {" · "}
                <span style={{ color: "var(--text-3)" }}>AI:</span>{" "}
                <span style={{ color: "var(--bad)", fontWeight: 500 }}>
                  {formatValue(s, "suggested")}
                </span>
              </div>
            ) : category === "match" ? (
              <div className="text-[11px]">
                <span style={{ color: "var(--text-3)" }}>{valueLabel}:</span>{" "}
                <span style={{ color: "var(--green-700)", fontWeight: 500 }}>
                  {formatValue(s, "suggested")}
                </span>
              </div>
            ) : (
              <div className="text-[11px]">
                <span style={{ color: "var(--text-3)" }}>{valueLabel}:</span>{" "}
                <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
                  {formatValue(s, "suggested")}{unit}
                </span>
              </div>
            )}
          </div>
        </div>

        {s.quote ? (
          <div
            className="text-[11px] italic mb-3 px-2 py-1 rounded"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            "{s.quote}"
          </div>
        ) : null}

        {/* Action buttons */}
        {modifying ? (
          <div className="flex items-center gap-2">
            <input
              type={s.definition.field_type === "sex" ? "text" : "number"}
              value={modifyValue}
              onChange={e => setModifyValue(e.target.value)}
              placeholder={
                s.definition.field_type === "score"
                  ? `0 - ${s.definition.scale_max}`
                  : s.definition.field_type === "numeric"
                    ? "value"
                    : "male / female"
              }
              className="text-[12px] px-2 py-1 rounded flex-1"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-1)",
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => onSaveModify(s)}
              disabled={loading || disabled}
              className="btn btn--primary text-[11px]"
              style={{ padding: "4px 10px" }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelModify}
              disabled={loading || disabled}
              className="btn text-[11px]"
              style={{ padding: "4px 10px" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {category === "match" ? (
              <button
                type="button"
                onClick={() => onConfirmMatch(s.id)}
                disabled={loading || disabled}
                className="btn text-[11px]"
                style={{
                  padding: "4px 10px",
                  color: "var(--green-700)",
                  borderColor: "var(--green-700)",
                }}
              >
                {loading ? "…" : "Confirm AI match"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onAccept(s.id)}
                  disabled={loading || disabled}
                  className="btn btn--primary text-[11px]"
                  style={{ padding: "4px 10px" }}
                >
                  {loading ? "…" : category === "conflict" ? "Use AI value" : "Accept"}
                </button>
                <button
                  type="button"
                  onClick={() => onStartModify(s)}
                  disabled={loading || disabled}
                  className="btn text-[11px]"
                  style={{ padding: "4px 10px" }}
                >
                  Modify
                </button>
                <button
                  type="button"
                  onClick={() => onReject(s.id)}
                  disabled={loading || disabled}
                  className="btn text-[11px]"
                  style={{ padding: "4px 10px", color: "var(--text-3)" }}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
