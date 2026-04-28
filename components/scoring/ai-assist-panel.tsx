"use client";

import { useState, useTransition } from "react";
import { requestAIAssist, acceptAISuggestion } from "@/app/(app)/scoring/[visitId]/score/ai-actions";
import type { AIScoreSuggestion } from "@/lib/ai-vision";

interface Props {
  visitId: string;
  definitionId: string;
  flockId: string;
  birdNumber: number;
  hasPhoto: boolean;
  currentScore: number | null;
  onAccept?: (score: number, scoreText: string) => void;
}

const CONFIDENCE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  high:   { bg: "var(--ok-bg)",   fg: "var(--ok)",   label: "High confidence" },
  medium: { bg: "var(--warn-bg)", fg: "var(--warn)", label: "Medium confidence" },
  low:    { bg: "var(--bad-bg)",  fg: "var(--bad)",  label: "Low confidence" },
};

export function AIAssistPanel(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<AIScoreSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [accepted, setAccepted] = useState(false);

  function runAssist(withFeedback: boolean) {
    setError(null);
    setAccepted(false);
    startTransition(async function () {
      const res = await requestAIAssist({
        visitId: props.visitId,
        definitionId: props.definitionId,
        flockId: props.flockId,
        birdNumber: props.birdNumber,
        feedback: withFeedback ? feedback.trim() : undefined,
        previousScore: withFeedback ? suggestion?.score : undefined,
      });
      if (res.ok) {
        setSuggestion(res.suggestion);
        setShowFeedback(false);
        setFeedback("");
      } else {
        setError(res.error);
      }
    });
  }

  function accept() {
    if (!suggestion) return;
    setError(null);
    startTransition(async function () {
      const res = await acceptAISuggestion({
        visitId: props.visitId,
        definitionId: props.definitionId,
        flockId: props.flockId,
        birdNumber: props.birdNumber,
        score: suggestion.score,
        scoreText: suggestion.scoreText,
      });
      if (res.ok) {
        setAccepted(true);
        if (props.onAccept) props.onAccept(suggestion.score, suggestion.scoreText);
      } else {
        setError(res.error ?? "Failed to apply score");
      }
    });
  }

  if (!props.hasPhoto) {
    return (
      <div
        className="rounded-md border px-3 py-2 text-[11px]"
        style={{
          borderColor: "var(--divider)",
          background: "var(--surface-2)",
          color: "var(--text-3)",
        }}
      >
        Upload a photo first to use AI assist
      </div>
    );
  }

  if (!suggestion && !isPending && !error) {
    return (
      <button
        type="button"
        onClick={function () { runAssist(false); }}
        className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition-colors"
        style={{
          background: "var(--green-700)",
          color: "white",
        }}
      >
        <SparkleIcon />
        Assist with AI
      </button>
    );
  }

  if (isPending && !suggestion) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-md px-3 py-3 text-[12px]"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-2)",
        }}
      >
        <SpinnerIcon />
        Analyzing image...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-md border px-3 py-2"
        style={{
          borderColor: "var(--bad)",
          background: "var(--bad-bg)",
        }}
      >
        <div className="text-[11px] font-medium" style={{ color: "var(--bad)" }}>
          AI assist failed
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-2)" }}>
          {error}
        </div>
        <button
          type="button"
          onClick={function () { setError(null); runAssist(false); }}
          className="mt-1 text-[11px] underline"
          style={{ color: "var(--green-700)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!suggestion) return null;

  const conf = CONFIDENCE_STYLES[suggestion.confidence] ?? CONFIDENCE_STYLES.medium;

  return (
    <div
      className="rounded-md border"
      style={{
        borderColor: "var(--divider)",
        background: "var(--surface)",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--divider)" }}
      >
        <SparkleIcon />
        <span className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}>
          AI Suggestion
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider"
          style={{ background: conf.bg, color: conf.fg }}
        >
          {conf.label}
        </span>
      </div>

      <div className="flex items-baseline gap-3 px-3 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest"
               style={{ color: "var(--text-3)" }}>
            Suggested score
          </div>
          <div className="font-display text-[28px] font-medium leading-none">
            {suggestion.scoreText ?? suggestion.score}
          </div>
        </div>
        {props.currentScore !== null && props.currentScore !== suggestion.score ? (
          <div
            className="rounded-md px-2 py-1 text-[10px]"
            style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
          >
            differs from current ({props.currentScore})
          </div>
        ) : null}
      </div>

      <div className="border-t px-3 py-2"
           style={{ borderColor: "var(--divider)" }}>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-widest"
             style={{ color: "var(--text-3)" }}>
          Reasoning
        </div>
        <p className="m-0 text-[12px]" style={{ color: "var(--text)" }}>
          {suggestion.explanation}
        </p>
      </div>

      {suggestion.observations.length > 0 ? (
        <div className="border-t px-3 py-2"
             style={{ borderColor: "var(--divider)" }}>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-widest"
               style={{ color: "var(--text-3)" }}>
            Observations
          </div>
          <ul className="m-0 list-none p-0">
            {suggestion.observations.map(function (obs, i) {
              return (
                <li key={i} className="mb-0.5 flex gap-1.5 text-[11px]"
                    style={{ color: "var(--text-2)" }}>
                  <span style={{ color: "var(--text-3)" }}>·</span>
                  <span>{obs}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {suggestion.warnings.length > 0 ? (
        <div
          className="border-t px-3 py-2"
          style={{ borderColor: "var(--divider)", background: "var(--warn-bg)" }}
        >
          <div className="mb-1 text-[10px] font-medium uppercase tracking-widest"
               style={{ color: "var(--warn)" }}>
            Image quality notes
          </div>
          <ul className="m-0 list-none p-0">
            {suggestion.warnings.map(function (w, i) {
              return (
                <li key={i} className="mb-0.5 text-[11px]"
                    style={{ color: "var(--warn)" }}>
                  {w}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div
        className="flex flex-wrap gap-2 border-t px-3 py-2"
        style={{ borderColor: "var(--divider)" }}
      >
        {accepted ? (
          <span
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: "var(--ok)" }}
          >
            <CheckIcon /> Score applied
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={accept}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium"
              style={{
                background: "var(--green-700)",
                color: "white",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              <CheckIcon /> Accept score
            </button>
            <button
              type="button"
              onClick={function () { setShowFeedback(function (s) { return !s; }); }}
              disabled={isPending}
              className="rounded-md px-3 py-1.5 text-[11px]"
              style={{
                background: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--divider)",
              }}
            >
              Re-analyze with feedback
            </button>
          </>
        )}
      </div>

      {showFeedback ? (
        <div className="border-t px-3 py-2"
             style={{ borderColor: "var(--divider)", background: "var(--surface-2)" }}>
          <textarea
            value={feedback}
            onChange={function (e) { setFeedback(e.target.value); }}
            placeholder="What should the AI look at differently? e.g. 'ignore the dirt, focus on the skin texture'"
            className="w-full rounded-md px-2 py-1.5 text-[11px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              color: "var(--text)",
              minHeight: 60,
              resize: "vertical",
            }}
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={function () { runAssist(true); }}
              disabled={isPending || feedback.trim() === ""}
              className="rounded-md px-3 py-1 text-[11px] font-medium"
              style={{
                background: "var(--green-700)",
                color: "white",
                opacity: (isPending || feedback.trim() === "") ? 0.5 : 1,
              }}
            >
              {isPending ? "Re-analyzing..." : "Re-analyze"}
            </button>
            <button
              type="button"
              onClick={function () { setShowFeedback(false); setFeedback(""); }}
              className="rounded-md px-3 py-1 text-[11px]"
              style={{ color: "var(--text-3)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         className="animate-spin">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
