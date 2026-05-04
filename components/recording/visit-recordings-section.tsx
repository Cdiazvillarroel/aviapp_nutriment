"use client";

// components/recording/visit-recordings-section.tsx
//
// Desktop component for the visit detail page. Lists all audio recordings
// for a visit with native browser audio players.
//
// Renders:
//  - Loading state while fetching
//  - Empty state if no recordings exist
//  - One card per recording with date, duration, file size, audio player
//  - Badge "Audio expired" for recordings where audio was deleted (>30 days)
//  - Future Phase 2: button to view transcript / AI summary
//
// USAGE:
//   <VisitRecordingsSection visitId={visit.id} />

import { useEffect, useState, useCallback } from "react";
import {
  listVisitRecordings,
  type ListedRecording,
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listVisitRecordings({ visitId });
    if (result.ok) {
      setRecordings(result.recordings);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  // ============= LOADING =============
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

  // ============= ERROR =============
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

  // ============= EMPTY =============
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

  // ============= LIST =============
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
          <RecordingCard key={rec.id} recording={rec} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Individual recording card
// ---------------------------------------------------------------------

function RecordingCard({ recording: r }: { recording: ListedRecording }) {
  const audioExpired = !!r.audioDeletedAt;
  const daysLeft = audioExpired ? null : daysUntilExpiry(r.expiresAt);

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Header: date + duration + size + status */}
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

        {audioExpired ? (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
            title={`Audio file deleted on ${r.audioDeletedAt ? formatDateTime(r.audioDeletedAt) : ""}`}
          >
            Audio expired
          </span>
        ) : daysLeft !== null && daysLeft <= 7 ? (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--surface-2)", color: "var(--orange-500)" }}
            title="Audio will be deleted soon. Transcript and analysis (if any) will be preserved."
          >
            Expires in {daysLeft}d
          </span>
        ) : null}
      </div>

      {/* Audio player or expired notice */}
      {audioExpired ? (
        <p
          className="m-0 rounded-md p-2 text-[11px] leading-relaxed"
          style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
        >
          The audio for this recording has been deleted as part of the 30-day
          retention policy. Any transcript or AI analysis below has been
          preserved.
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

      {/* Transcript / AI summary indicators (Phase 2) */}
      {(r.transcript || r.hasAiSummary) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.transcript && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
            >
              ✓ Transcript available
            </span>
          )}
          {r.hasAiSummary && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
            >
              ✓ AI summary
            </span>
          )}
        </div>
      )}
    </div>
  );
}
