"use client";

// components/recording/recording-controls.tsx
//
// Standalone audio recording controls. Renders a single button when idle,
// and expands to show a recording indicator + pause/stop buttons while active.
//
// Designed to live in the top bar of the mobile scoring page, but works
// anywhere a visitId is in scope.
//
// USAGE:
//   <RecordingControls visitId={visitId} onStateChange={(s) => ...} />
//
// The host component is responsible for:
//   - Confirming farmer consent before allowing the recording (Phase 1d)
//   - Showing recovery prompts for interrupted recordings (Phase 1d)
//
// This component just exposes the recording controls themselves.

import { useEffect, useState } from "react";
import {
  useAudioRecorder,
  type RecorderState,
} from "@/lib/audio/use-audio-recorder";

interface Props {
  visitId: string;
  /** Optional callback fired whenever recorder state changes. */
  onStateChange?: (state: RecorderState) => void;
  /** If false, the component shows nothing while idle (caller decides when to show entry point). */
  showWhenIdle?: boolean;
  /** Compact mode for tight headers — smaller text, fewer affordances. */
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordingControls({
  visitId,
  onStateChange,
  showWhenIdle = true,
  compact = false,
}: Props) {
  const recorder = useAudioRecorder({ visitId });
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Bubble state changes up to host
  useEffect(() => {
    onStateChange?.(recorder.state);
  }, [recorder.state, onStateChange]);

  // Reset cancel confirmation if recorder leaves recording/paused state
  useEffect(() => {
    if (recorder.state !== "recording" && recorder.state !== "paused") {
      setConfirmingCancel(false);
    }
  }, [recorder.state]);

  // Don't render anything if device can't record
  if (recorder.state === "unsupported") {
    return null;
  }

  // ============= IDLE STATE =============
  if (recorder.state === "idle") {
    if (!showWhenIdle) return null;
    return (
      <button
        type="button"
        onClick={() => recorder.start()}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium"
            : "inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium"
        }
        style={{ background: "var(--surface-2)", color: "var(--text-1)", border: "1px solid var(--border)" }}
      >
        <span aria-hidden>🎙️</span>
        <span>Record session</span>
      </button>
    );
  }

  // ============= REQUESTING MIC =============
  if (recorder.state === "requesting_mic") {
    return (
      <div
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]"
            : "inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px]"
        }
        style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
      >
        <span>Requesting microphone…</span>
      </div>
    );
  }

  // ============= ERROR STATE =============
  if (recorder.state === "error") {
    return (
      <div
        className="inline-flex flex-col gap-1 rounded-md px-3 py-2 text-[12px]"
        style={{ background: "var(--surface-2)", border: "1px solid var(--bad)", color: "var(--bad)" }}
      >
        <span className="font-medium">Recording error</span>
        <span style={{ color: "var(--text-2)" }}>{recorder.errorMessage}</span>
        <button
          type="button"
          onClick={() => recorder.start()}
          className="mt-1 self-start rounded px-2 py-0.5 text-[11px] font-medium"
          style={{ background: "var(--surface)", color: "var(--text-1)", border: "1px solid var(--border)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ============= STOPPING =============
  if (recorder.state === "stopping") {
    return (
      <div
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]"
            : "inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px]"
        }
        style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
      >
        <span>Saving…</span>
      </div>
    );
  }

  // ============= ACTIVE: recording or paused =============
  const isPaused = recorder.state === "paused";
  const indicatorColor = isPaused ? "var(--text-3)" : "var(--bad)";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5"
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${isPaused ? "var(--border)" : "var(--bad)"}`,
      }}
    >
      {/* Pulsing red dot when recording, dimmed when paused */}
      <span
        className={`inline-block h-2 w-2 rounded-full ${isPaused ? "" : "animate-pulse"}`}
        style={{ background: indicatorColor }}
        aria-hidden
      />
      <span
        className="text-[12px] font-medium tabular-nums"
        style={{ color: isPaused ? "var(--text-2)" : "var(--text-1)" }}
      >
        {isPaused ? "PAUSED" : "REC"} {formatDuration(recorder.durationSeconds)}
      </span>

      {/* Pause/Resume */}
      {!isPaused ? (
        <button
          type="button"
          onClick={() => recorder.pause()}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded text-[11px]"
          style={{ background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }}
          aria-label="Pause recording"
          title="Pause"
        >
          ⏸
        </button>
      ) : (
        <button
          type="button"
          onClick={() => recorder.resume()}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded text-[11px]"
          style={{ background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }}
          aria-label="Resume recording"
          title="Resume"
        >
          ▶
        </button>
      )}

      {/* Stop (saves) */}
      <button
        type="button"
        onClick={() => recorder.stop()}
        className="flex h-7 items-center rounded px-2 text-[11px] font-medium"
        style={{ background: "var(--green-700)", color: "#fff" }}
        title="Stop and save"
      >
        Stop
      </button>

      {/* Cancel (discards) — two-step to avoid accidental data loss */}
      {!confirmingCancel ? (
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          className="flex h-7 w-7 items-center justify-center rounded text-[11px]"
          style={{ background: "var(--surface)", color: "var(--text-3)", border: "1px solid var(--border)" }}
          aria-label="Cancel recording"
          title="Discard recording"
        >
          ×
        </button>
      ) : (
        <div className="ml-1 inline-flex items-center gap-1">
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Discard?</span>
          <button
            type="button"
            onClick={() => recorder.cancel()}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--bad)", color: "#fff" }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmingCancel(false)}
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{ background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
