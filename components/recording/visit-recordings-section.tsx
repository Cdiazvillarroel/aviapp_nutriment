"use client";

// components/recording/visit-recordings-section.tsx
//
// Desktop component for the visit detail page. Lists all audio recordings
// for a visit with audio player, processing status, transcript, and AI summary.
//
// Shows for each recording:
//  - Date, duration, file size
//  - Audio player (if audio still exists)
//  - Processing status badge (pending/processing/succeeded/failed)
//  - Retry button if failed
//  - Expandable transcript
//  - Expandable AI summary with structured fields
//
// USAGE:
//   <VisitRecordingsSection visitId={visit.id} />

import { useEffect, useState, useCallback, useRef } from "react";
import {
  listVisitRecordings,
  triggerRecordingProcessing,
  type ListedRecording,
  type AISummaryShape,
} from "@/app/(app)/scoring/recording-actions";

interface Props {
  visitId: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntilExpiry(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function VisitRecordingsSection({ visitId }: Props) {
  const [recordings, setRecordings] = useState<ListedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const result = await listVisitRecordings({ visitId });
    if (result.ok) {
      setRecordings(result.recordings);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh while any recording is still processing or pending.
  // Stop polling when all recordings are in terminal state.
  useEffect(() => {
    const hasInFlight = recordings.some(
      (r) => r.processingStatus === "processing" || r.processingStatus === "pending",
    );

    if (hasInFlight && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        load();
      }, 5000);
    } else if (!hasInFlight && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [recordings, load]);

  if (loading) {
    return (
      <section className="rounded-lg border p-4" style={{ borderColor: "var(--divider)" }}>
        <h3 className="m-0 text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>
          Recordings
        </h3>
        <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>
          Loading…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border p-4" style={{ borderColor: "var(--divider)" }}>
        <h3 className="m-0 text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>
          Recordings
        </h3>
        <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--bad)" }}>
          Failed to load: {error}
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-2 rounded px-2 py-1 text-[11px] font-medium"
          style={{ background: "var(--surface-2)", color: "var(--text-1)", border: "1px solid var(--border)" }}
        >
          Retry
        </button>
      </section>
    );
  }

  if (recordings.length === 0) {
    return (
      <section className="rounded-lg border p-4" style={{ borderColor: "var(--divider)" }}>
        <h3 className="m-0 text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>
          Recordings
        </h3>
        <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>
          No audio recordings for this visit.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-4" style={{ borderColor: "var(--divider)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>
          Recordings
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            {recordings.length}
          </span>
        </h3>
      </div>

      <div className="flex flex-col gap-3">
        {recordings.map((rec) => (
          <RecordingCard
            key={rec.id}
            recording={rec}
            onChanged={load}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Individual recording card
// ---------------------------------------------------------------------

function RecordingCard({
  recording: r,
  onChanged,
}: {
  recording: ListedRecording;
  onChanged: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const audioExpired = !!r.audioDeletedAt;
  const daysLeft = audioExpired ? null : daysUntilExpiry(r.expiresAt);

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    const result = await triggerRecordingProcessing({ recordingId: r.id });
    setRetrying(false);
    if (!result.ok) {
      setRetryError(result.error);
    } else {
      // Refresh — the polling effect in the parent will pick up the new state
      onChanged();
    }
  }

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Header row: date + duration + size + status */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
          {formatDateTime(r.recordedAt)}
        </span>
        <span style={{ color: "var(--text-3)" }}>·</span>
        <span style={{ color: "var(--text-2)" }}>
          {formatDuration(r.durationSeconds)}
        </span>
        <span style={{ color: "var(--text-3)" }}>·</span>
        <span style={{ color: "var(--text-3)" }}>
          {formatFileSize(r.fileSizeBytes)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <ProcessingBadge status={r.processingStatus} />
          {audioExpired ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
              title={`Audio file deleted on ${r.audioDeletedAt ? formatDateTime(r.audioDeletedAt) : ""}`}
            >
              Audio expired
            </span>
          ) : daysLeft !== null && daysLeft <= 7 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--orange-500)" }}
              title="Audio will be deleted soon. Transcript and analysis will be preserved."
            >
              Expires in {daysLeft}d
            </span>
          ) : null}
        </div>
      </div>

      {/* Audio player or expired notice */}
      {audioExpired ? (
        <p
          className="m-0 rounded-md p-2 text-[11px] leading-relaxed"
          style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
        >
          The audio for this recording has been deleted as part of the 30-day
          retention policy. The transcript and analysis below have been preserved.
        </p>
      ) : r.signedUrl ? (
        <audio
          controls
          preload="none"
          src={r.signedUrl}
          className="w-full"
          style={{ height: 36 }}
        >
          Your browser does not support audio playback.
        </audio>
      ) : (
        <p className="m-0 text-[11px]" style={{ color: "var(--text-3)" }}>
          Audio unavailable.
        </p>
      )}

      {/* Processing error + retry */}
      {r.processingStatus === "failed" && (
        <div
          className="mt-2 rounded-md p-2 text-[11px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--bad)" }}
        >
          <div style={{ color: "var(--bad)", fontWeight: 500 }}>
            Processing failed
          </div>
          {r.processingError && (
            <div className="mt-1" style={{ color: "var(--text-3)" }}>
              {r.processingError}
            </div>
          )}
          {retryError && (
            <div className="mt-1" style={{ color: "var(--bad)" }}>
              Retry failed: {retryError}
            </div>
          )}
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-2 rounded px-2 py-1 text-[11px] font-medium disabled:opacity-60"
            style={{ background: "var(--surface)", color: "var(--text-1)", border: "1px solid var(--border)" }}
          >
            {retrying ? "Retrying…" : "Retry processing"}
          </button>
        </div>
      )}

      {/* Pending: show "trigger now" button */}
      {r.processingStatus === "pending" && !audioExpired && (
        <div
          className="mt-2 rounded-md p-2 text-[11px]"
          style={{ background: "var(--surface-2)" }}
        >
          <span style={{ color: "var(--text-2)" }}>
            Waiting for AI processing.
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="ml-2 rounded px-2 py-0.5 text-[11px] font-medium disabled:opacity-60"
            style={{ background: "var(--surface)", color: "var(--text-1)", border: "1px solid var(--border)" }}
          >
            {retrying ? "Starting…" : "Process now"}
          </button>
        </div>
      )}

      {/* Transcript expandable */}
      {r.transcript && (
        <details
          className="mt-2"
          open={showTranscript}
          onToggle={(e) => setShowTranscript((e.target as HTMLDetailsElement).open)}
        >
          <summary
            className="cursor-pointer text-[11px] font-medium select-none"
            style={{ color: "var(--text-2)" }}
          >
            Transcript ({r.transcript.length.toLocaleString()} chars)
          </summary>
          <div
            className="mt-2 rounded-md p-3 text-[12px] leading-relaxed whitespace-pre-wrap"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-1)",
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {r.transcript}
          </div>
        </details>
      )}

      {/* AI Summary expandable */}
      {r.aiSummary && (
        <details
          className="mt-2"
          open={showSummary}
          onToggle={(e) => setShowSummary((e.target as HTMLDetailsElement).open)}
        >
          <summary
            className="cursor-pointer text-[11px] font-medium select-none"
            style={{ color: "var(--text-2)" }}
          >
            AI Summary
          </summary>
          <SummaryDisplay summary={r.aiSummary} />
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Processing status badge
// ---------------------------------------------------------------------

function ProcessingBadge({ status }: { status: ListedRecording["processingStatus"] }) {
  const styles: Record<typeof status, { bg: string; fg: string; label: string }> = {
    pending: { bg: "var(--surface-2)", fg: "var(--text-3)", label: "Pending" },
    processing: { bg: "var(--surface-2)", fg: "var(--orange-500)", label: "Processing…" },
    succeeded: { bg: "var(--surface-2)", fg: "var(--ok)", label: "✓ Processed" },
    failed: { bg: "var(--surface-2)", fg: "var(--bad)", label: "⚠ Failed" },
  };
  const s = styles[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------
// AI Summary structured display
// ---------------------------------------------------------------------

function SummaryDisplay({ summary }: { summary: AISummaryShape }) {
  return (
    <div
      className="mt-2 rounded-md p-3 text-[12px] leading-relaxed"
      style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
    >
      {summary.summary && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--text-3)" }}>
            Summary
          </div>
          <p className="m-0">{summary.summary}</p>
        </div>
      )}

      {summary.key_findings && summary.key_findings.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--text-3)" }}>
            Key findings
          </div>
          <ul className="m-0 pl-4 list-disc">
            {summary.key_findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.mentioned_scores && summary.mentioned_scores.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--text-3)" }}>
            Scores mentioned in audio
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: "var(--text-3)" }}>
                <th className="text-left font-medium pb-1">Bird</th>
                <th className="text-left font-medium pb-1">Indicator</th>
                <th className="text-left font-medium pb-1">Score</th>
                <th className="text-left font-medium pb-1">Quote</th>
              </tr>
            </thead>
            <tbody>
              {summary.mentioned_scores.map((m, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--divider)" }}>
                  <td className="py-1 align-top">{m.bird_number ?? "—"}</td>
                  <td className="py-1 align-top">{m.indicator}</td>
                  <td className="py-1 align-top font-medium">{String(m.score ?? "—")}</td>
                  <td className="py-1 align-top italic" style={{ color: "var(--text-3)" }}>
                    "{m.quote}"
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary.concerns && summary.concerns.length > 0 && (
        <div className="mb-1">
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--orange-500)" }}>
            Concerns
          </div>
          <ul className="m-0 pl-4 list-disc">
            {summary.concerns.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.language && summary.language !== "unknown" && (
        <div className="mt-2 text-[10px]" style={{ color: "var(--text-3)" }}>
          Detected language: {summary.language}
        </div>
      )}
    </div>
  );
}
