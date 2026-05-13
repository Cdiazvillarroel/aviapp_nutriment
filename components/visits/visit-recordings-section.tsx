"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Recording {
  id: string;
  recorded_at: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  storage_path: string;
  audio_deleted_at: string | null;
  processing_status: "pending" | "processing" | "succeeded" | "failed";
  processing_error: string | null;
  transcript: string | null;
  ai_summary: {
    summary?: string;
    key_findings?: string[];
    concerns?: string[];
    language?: string;
    validation?: {
      valid_count: number;
      rejected_count: number;
      inserted_suggestion_ids: string[];
    };
  } | null;
}

interface Props {
  visitId: string;
  initialRecordings: Recording[];
}

export function VisitRecordingsSection({ visitId, initialRecordings }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>(initialRecordings);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());

  // Generate signed URLs for all recordings that still have audio
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = supabaseRef.current;
      const urls: Record<string, string> = {};
      for (const r of recordings) {
        if (r.audio_deleted_at) continue;
        const { data } = await supabase.storage
          .from("visit-recordings")
          .createSignedUrl(r.storage_path, 3600);
        if (data?.signedUrl) urls[r.id] = data.signedUrl;
      }
      if (!cancelled) setSignedUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [recordings.map(r => r.id).join(",")]);

  // Polling: only when there are recordings still processing
  useEffect(() => {
    const hasPending = recordings.some(
      r => r.processing_status === "pending" || r.processing_status === "processing"
    );
    if (!hasPending) return;

    const interval = setInterval(async () => {
      const supabase = supabaseRef.current;
      const { data } = await supabase
        .from("visit_recordings")
        .select("id, recorded_at, duration_seconds, file_size_bytes, storage_path, audio_deleted_at, processing_status, processing_error, transcript, ai_summary")
        .eq("visit_id", visitId)
        .order("recorded_at", { ascending: false });

      if (data) setRecordings(data as Recording[]);
    }, 5000);

    return () => clearInterval(interval);
  }, [visitId, recordings.map(r => `${r.id}:${r.processing_status}`).join(",")]);

  if (recordings.length === 0) {
    return (
      <div className="card">
        <div className="card__body" style={{ padding: 24, textAlign: "center" }}>
          <p className="m-0 text-[12px]" style={{ color: "var(--text-3)" }}>
            No recordings for this visit yet.
          </p>
        </div>
      </div>
    );
  }

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {recordings.map(r => {
        const dur = r.duration_seconds ?? 0;
        const mm = Math.floor(dur / 60);
        const ss = String(dur % 60).padStart(2, "0");
        const sizeMB = r.file_size_bytes
          ? (r.file_size_bytes / 1024 / 1024).toFixed(2)
          : "—";
        const recordedDate = new Date(r.recorded_at).toLocaleString("en-AU", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false,
        });

        const statusBadge = (() => {
          switch (r.processing_status) {
            case "pending":
              return { label: "Queued", color: "var(--text-3)", bg: "var(--surface-2)" };
            case "processing":
              return { label: "Processing…", color: "var(--text-1)", bg: "var(--surface-2)" };
            case "succeeded":
              return { label: "✓ Processed", color: "var(--green-700)", bg: "transparent" };
            case "failed":
              return { label: "✗ Failed", color: "var(--bad)", bg: "transparent" };
          }
        })();

        const isExpanded = expandedTranscripts.has(r.id);
        const validation = r.ai_summary?.validation;
        const suggestionCount = validation?.inserted_suggestion_ids?.length ?? 0;

        return (
          <div key={r.id} className="card">
            <div className="card__header">
              <div className="flex items-center justify-between gap-2 w-full">
                <h3 className="card__title text-[13px] font-medium m-0">
                  🎤 Recording · {recordedDate}
                </h3>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded"
                  style={{ color: statusBadge.color, background: statusBadge.bg }}
                >
                  {statusBadge.label}
                </span>
              </div>
            </div>

            <div className="card__body" style={{ padding: 16 }}>
              {/* Duration + size */}
              <div className="mb-3 text-[11px]" style={{ color: "var(--text-3)" }}>
                {mm}:{ss} · {sizeMB} MB
                {r.audio_deleted_at ? " · audio deleted (>30 days)" : ""}
              </div>

              {/* Audio player */}
              {!r.audio_deleted_at && signedUrls[r.id] ? (
                <audio
                  controls
                  src={signedUrls[r.id]}
                  style={{ width: "100%", marginBottom: 12 }}
                />
              ) : null}

              {/* Error */}
              {r.processing_status === "failed" && r.processing_error ? (
                <div
                  className="text-[12px] mb-3 px-3 py-2 rounded"
                  style={{ background: "var(--surface-2)", color: "var(--bad)" }}
                >
                  <strong>Error:</strong> {r.processing_error}
                </div>
              ) : null}

              {/* AI Summary */}
              {r.ai_summary?.summary ? (
                <div className="mb-3">
                  <div className="text-[10px] font-medium uppercase tracking-widest mb-1"
                       style={{ color: "var(--text-3)" }}>
                    Summary
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {r.ai_summary.summary}
                  </div>
                </div>
              ) : null}

              {/* Key findings */}
              {r.ai_summary?.key_findings && r.ai_summary.key_findings.length > 0 ? (
                <div className="mb-3">
                  <div className="text-[10px] font-medium uppercase tracking-widest mb-1"
                       style={{ color: "var(--text-3)" }}>
                    Key findings
                  </div>
                  <ul className="m-0 pl-4 text-[12px]" style={{ color: "var(--text-2)" }}>
                    {r.ai_summary.key_findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Concerns */}
              {r.ai_summary?.concerns && r.ai_summary.concerns.length > 0 ? (
                <div className="mb-3">
                  <div className="text-[10px] font-medium uppercase tracking-widest mb-1"
                       style={{ color: "var(--bad)" }}>
                    Concerns
                  </div>
                  <ul className="m-0 pl-4 text-[12px]" style={{ color: "var(--text-2)" }}>
                    {r.ai_summary.concerns.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Suggestions badge */}
              {suggestionCount > 0 ? (
                <div
                  className="text-[11px] mb-3 px-3 py-2 rounded inline-block"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-2)",
                  }}
                >
                  🎯 {suggestionCount} score suggestions extracted — see below
                </div>
              ) : null}

              {/* Transcript expandable */}
              {r.transcript ? (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleTranscript(r.id)}
                    className="text-[11px]"
                    style={{
                      color: "var(--green-700)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {isExpanded ? "▾ Hide transcript" : "▸ Show transcript"}
                  </button>
                  {isExpanded ? (
                    <div
                      className="mt-2 text-[12px] px-3 py-2 rounded"
                      style={{
                        background: "var(--surface-2)",
                        color: "var(--text-2)",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {r.transcript}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
