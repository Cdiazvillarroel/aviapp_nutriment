// lib/audio/use-audio-recorder.ts
//
// React hook wrapping the MediaRecorder API for offline-first audio recording.
//
// Lifecycle:
//   idle → requesting_mic → recording ⇄ paused → stopping → idle
//                                   ↓
//                                error
//
// Features:
//   - Persists snapshots to IndexedDB every 60s (configurable)
//   - Triggers a snapshot when the page goes to background (best-effort
//     before iOS Safari may unload the tab)
//   - Pause/resume preserve duration accurately
//   - Cancel discards the recording (no upload queued)
//   - Stop commits the recording (upload mutation queued for sync)
//   - Cleans up the mic stream on unmount and on stop

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initRecordingLocal,
  updateRecordingLocal,
  commitRecordingLocal,
  discardRecordingLocal,
} from "@/lib/offline/repository";
import { pickBestAudioMimeType, isAudioRecordingSupported } from "./mime-types";

export type RecorderState =
  | "idle"
  | "unsupported"        // device cannot record audio
  | "requesting_mic"     // waiting for getUserMedia permission
  | "recording"
  | "paused"
  | "stopping"           // finalizing and persisting blob
  | "error";

export interface UseAudioRecorderOptions {
  /** ID of the visit this recording belongs to (used for storage path/RLS). */
  visitId: string;
  /** Snapshot interval in ms. Default 60000 (1 minute). */
  snapshotIntervalMs?: number;
  /** Audio bitrate in bits/sec. Default 24000 (good for voice + small files). */
  audioBitsPerSecond?: number;
}

export interface UseAudioRecorderReturn {
  state: RecorderState;
  /** Recording duration in seconds (excludes paused time). */
  durationSeconds: number;
  /** Last error message, or null. */
  errorMessage: string | null;
  /** Whether this device supports audio recording at all. */
  isSupported: boolean;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** Stop and commit (queues upload). Resolves once persisted to IndexedDB. */
  stop: () => Promise<void>;
  /** Stop and discard (no upload). Resolves once cleaned up. */
  cancel: () => Promise<void>;
}

export function useAudioRecorder({
  visitId,
  snapshotIntervalMs = 60_000,
  audioBitsPerSecond = 24_000,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>(
    isAudioRecordingSupported() ? "idle" : "unsupported"
  );
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs survive re-renders without triggering them
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string | null>(null);
  const blobIdRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  // Time tracking
  const startTimeRef = useRef<number>(0);
  const pausedTotalMsRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);

  // Timers
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute current effective duration (accounting for paused time)
  const computeDuration = useCallback((): number => {
    if (startTimeRef.current === 0) return 0;
    const now = Date.now();
    let pausedMs = pausedTotalMsRef.current;
    if (pauseStartRef.current !== null) {
      pausedMs += now - pauseStartRef.current;
    }
    const elapsed = (now - startTimeRef.current - pausedMs) / 1000;
    return Math.max(0, Math.floor(elapsed));
  }, []);

  // Snapshot: build current Blob from accumulated chunks and persist to IndexedDB.
  const persistSnapshot = useCallback(async (): Promise<void> => {
    const recordingId = recordingIdRef.current;
    const blobId = blobIdRef.current;
    if (!recordingId || !blobId) return;
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    const dur = computeDuration();

    try {
      await updateRecordingLocal({ recordingId, blobId, blob, durationSeconds: dur });
      console.log(
        `[recorder] Snapshot persisted: ${dur}s, ` +
        `${(blob.size / 1024 / 1024).toFixed(2)}MB`
      );
    } catch (e) {
      // Don't let snapshot errors kill the recording
      console.error("[recorder] Snapshot persist failed:", e);
    }
  }, [computeDuration]);

  // Tear down all timers and stream/recorder. Idempotent.
  const cleanup = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    recordingIdRef.current = null;
    blobIdRef.current = null;
    startTimeRef.current = 0;
    pausedTotalMsRef.current = 0;
    pauseStartRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (state !== "idle") {
      console.warn(`[recorder] Cannot start from state '${state}'`);
      return;
    }

    setErrorMessage(null);
    setState("requesting_mic");

    try {
      const mimeType = pickBestAudioMimeType();
      if (!mimeType) {
        throw new Error("This device does not support audio recording");
      }
      mimeTypeRef.current = mimeType;

      // Request mic. Apply voice-friendly constraints.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Build recorder
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond });
      } catch (err) {
        // Some iOS Safari versions reject explicit mimeType — retry without it
        recorder = new MediaRecorder(stream);
        mimeTypeRef.current = recorder.mimeType || mimeType;
      }
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = (e) => {
        const err = (e as any).error;
        const msg = err?.message ?? "MediaRecorder error";
        console.error("[recorder] MediaRecorder fired onerror:", err);
        setErrorMessage(msg);
        setState("error");
        cleanup();
      };

      // Init local recording row in IndexedDB
      const { recordingId, blobId } = await initRecordingLocal({
        visitId,
        mimeType: mimeTypeRef.current,
      });
      recordingIdRef.current = recordingId;
      blobIdRef.current = blobId;

      // Start. timeslice=1000 means MediaRecorder emits data every 1s,
      // giving us frequent enough chunks for the 60s snapshot to be near-current.
      recorder.start(1000);
      startTimeRef.current = Date.now();
      pausedTotalMsRef.current = 0;
      pauseStartRef.current = null;
      setDurationSeconds(0);

      // UI tick (1s) to update displayed duration
      tickIntervalRef.current = setInterval(() => {
        setDurationSeconds(computeDuration());
      }, 1000);

      // Snapshot timer
      snapshotIntervalRef.current = setInterval(() => {
        persistSnapshot();
      }, snapshotIntervalMs);

      setState("recording");
    } catch (e: any) {
      console.error("[recorder] start() failed:", e);
      const msg =
        e?.name === "NotAllowedError"
          ? "Microphone permission denied"
          : e?.name === "NotFoundError"
          ? "No microphone found on this device"
          : e?.message ?? "Could not start recording";
      setErrorMessage(msg);
      setState("error");
      cleanup();
    }
  }, [
    state,
    visitId,
    audioBitsPerSecond,
    snapshotIntervalMs,
    computeDuration,
    persistSnapshot,
    cleanup,
  ]);

  const pause = useCallback((): void => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    try {
      recorder.pause();
    } catch (e) {
      console.error("[recorder] pause failed:", e);
      return;
    }
    pauseStartRef.current = Date.now();
    setState("paused");
  }, []);

  const resume = useCallback((): void => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    try {
      recorder.resume();
    } catch (e) {
      console.error("[recorder] resume failed:", e);
      return;
    }
    if (pauseStartRef.current !== null) {
      pausedTotalMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setState("recording");
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    const recordingId = recordingIdRef.current;
    const blobId = blobIdRef.current;
    if (!recorder || !recordingId || !blobId) {
      console.warn("[recorder] stop() called without active recording");
      return;
    }

    setState("stopping");

    // If we were paused, account for that gap one final time
    if (pauseStartRef.current !== null) {
      pausedTotalMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }

    // Wait for the recorder to flush its final chunk
    await new Promise<void>((resolve) => {
      const finalize = () => resolve();
      if (recorder.state === "inactive") {
        finalize();
        return;
      }
      recorder.onstop = finalize;
      try {
        recorder.stop();
      } catch (e) {
        console.error("[recorder] stop() failed:", e);
        finalize();
      }
    });

    // Stop timers immediately so duration freezes
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }

    // Stop mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Final commit
    const finalBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    const finalDuration = computeDuration();

    try {
      await commitRecordingLocal({
        recordingId,
        blobId,
        visitId,
        blob: finalBlob,
        durationSeconds: finalDuration,
      });
      console.log(
        `[recorder] Committed: ${finalDuration}s, ` +
        `${(finalBlob.size / 1024 / 1024).toFixed(2)}MB ` +
        `(queued for upload when online)`
      );
    } catch (e: any) {
      console.error("[recorder] commit failed:", e);
      setErrorMessage(`Failed to save recording: ${e?.message ?? "unknown"}`);
      setState("error");
      cleanup();
      return;
    }

    setDurationSeconds(finalDuration);
    cleanup();
    setState("idle");
  }, [visitId, computeDuration, cleanup]);

  const cancel = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    const recordingId = recordingIdRef.current;
    const blobId = blobIdRef.current;

    // Stop the recorder if active
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }

    // Stop mic + timers
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    // Discard from IndexedDB
    if (recordingId && blobId) {
      try {
        await discardRecordingLocal({ recordingId, blobId });
      } catch (e) {
        console.error("[recorder] discard failed:", e);
      }
    }

    setDurationSeconds(0);
    cleanup();
    setState("idle");
  }, [cleanup]);

  // Persist when the page goes to background — best-effort save before
  // iOS Safari potentially unloads the tab. Cannot await async work here
  // because visibility events don't honor returned promises, but the
  // IndexedDB write is fast and usually completes.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden" && state === "recording") {
        persistSnapshot();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state, persistSnapshot]);

  // Cleanup on unmount: stop the mic stream so the red dot in the OS goes away
  useEffect(() => {
    return () => {
      // Best-effort: stop tracks and timers. Don't try to commit here because
      // the component might be unmounting due to navigation away — we just
      // free resources. The latest snapshot from setInterval is already in IDB.
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    state,
    durationSeconds,
    errorMessage,
    isSupported: state !== "unsupported",
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}
