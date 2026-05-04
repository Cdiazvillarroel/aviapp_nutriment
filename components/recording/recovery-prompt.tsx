"use client";

// components/recording/recovery-prompt.tsx
//
// On mount, checks IndexedDB for any recordings on this visit that are
// flagged _is_active=true (recording was interrupted, never committed).
// If found, shows a prompt with two options:
//   - Save and upload: commits the recording with the snapshot data we have.
//   - Discard: deletes the local recording + blob.
//
// The vet may have closed Safari or the iPad ran out of memory while
// recording. The 60s snapshots from useAudioRecorder mean we have at most
// 60 seconds of lost audio.

import { useCallback, useEffect, useState } from "react";
import {
  getLocalRecordingsForVisit,
  getBlob,
  commitRecordingLocal,
  discardRecordingLocal,
} from "@/lib/offline/repository";
import type { OfflineRecording } from "@/lib/offline/db";

interface Props {
  visitId: string;
  /** Called after the user resolves the prompt (either submit or discard). */
  onResolved?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecoveryPrompt({ visitId, onResolved }: Props) {
  const [interrupted, setInterrupted] = useState<OfflineRecording | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for interrupted recordings on mount
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const recordings = await getLocalRecordingsForVisit(visitId);
        const active = recordings.find(
          (r) => r._is_active === true && r._is_local === true && r._local_blob_id
        );
        if (cancelled) return;
        setInterrupted(active ?? null);
      } catch (e) {
        console.error("[recovery] Failed to check for interrupted recordings:", e);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  const handleSubmit = useCallback(async () => {
    if (!interrupted || !interrupted._local_blob_id) return;
    setBusy(true);
    setError(null);
    try {
      const blobRow = await getBlob(interrupted._local_blob_id);
      if (!blobRow) {
        // Blob is gone (cleared cache?) — nothing to recover
        await discardRecordingLocal({
          recordingId: interrupted.id,
          blobId: interrupted._local_blob_id,
        });
        setInterrupted(null);
        onResolved?.();
        return;
      }
      await commitRecordingLocal({
        recordingId: interrupted.id,
        blobId: interrupted._local_blob_id,
        visitId,
        blob: blobRow.blob,
        durationSeconds: interrupted.duration_seconds,
      });
      setInterrupted(null);
      onResolved?.();
    } catch (e: any) {
      console.error("[recovery] Submit failed:", e);
      setError(e?.message ?? "Failed to save recording");
    } finally {
      setBusy(false);
    }
  }, [interrupted, visitId, onResolved]);

  const handleDiscard = useCallback(async () => {
    if (!interrupted || !interrupted._local_blob_id) return;
    setBusy(true);
    setError(null);
    try {
      await discardRecordingLocal({
        recordingId: interrupted.id,
        blobId: interrupted._local_blob_id,
      });
      setInterrupted(null);
      onResolved?.();
    } catch (e: any) {
      console.error("[recovery] Discard failed:", e);
      setError(e?.message ?? "Failed to discard recording");
    } finally {
      setBusy(false);
    }
  }, [interrupted, onResolved]);

  if (!interrupted) return null;

  const sizeMB = (interrupted.file_size_bytes / 1024 / 1024).toFixed(1);

  return (
    <div
      className="mx-3 mt-3 rounded-md p-3 text-[12px]"
      style={{ background: "var(--surface-2)", border: "1px solid var(--orange-500)" }}
    >
      <div className="font-medium" style={{ color: "var(--text-1)" }}>
        Unfinished recording detected
      </div>
      <div className="mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>
        A recording of {formatDuration(interrupted.duration_seconds)} ({sizeMB} MB)
        was interrupted before being saved. You can finalize it now or discard it.
      </div>

      {error && (
        <div className="mt-2" style={{ color: "var(--bad)" }}>
          {error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="rounded px-3 py-1.5 text-[12px] font-medium disabled:opacity-60"
          style={{ background: "var(--green-700)", color: "#fff" }}
        >
          {busy ? "Saving…" : "Save and upload"}
        </button>

        {!confirmDiscard ? (
          <button
            type="button"
            onClick={() => setConfirmDiscard(true)}
            disabled={busy}
            className="rounded px-3 py-1.5 text-[12px] disabled:opacity-60"
            style={{
              background: "var(--surface)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
            }}
          >
            Discard
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Discard?
            </span>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={busy}
              className="rounded px-2 py-1 text-[11px] font-medium disabled:opacity-60"
              style={{ background: "var(--bad)", color: "#fff" }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              disabled={busy}
              className="rounded px-2 py-1 text-[11px] disabled:opacity-60"
              style={{
                background: "var(--surface)",
                color: "var(--text-2)",
                border: "1px solid var(--border)",
              }}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
