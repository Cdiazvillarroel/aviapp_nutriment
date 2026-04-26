"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPhoto, deletePhoto } from "@/app/(app)/scoring/actions";

interface ExistingPhoto {
  id: string;
  url: string;
}

interface Props {
  visitId: string;
  visitScoreId: string | null;
  onScoreNeeded: () => Promise<string | null>;
  initialPhotos: ExistingPhoto[];
}

export function PhotoCapture({ visitId, visitScoreId, onScoreNeeded, initialPhotos }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ExistingPhoto[]>(initialPhotos);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    let scoreId = visitScoreId;
    if (!scoreId) {
      scoreId = await onScoreNeeded();
      if (!scoreId) {
        setError("Set a score first before adding a photo.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("visit_score_id", scoreId!);
      fd.append("visit_id", visitId);
      fd.append("file", file);

      const result = await uploadPhoto(fd);
      if (result.ok) {
        setPhotos(prev => [...prev, result.photo]);
      } else {
        setError(result.error);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleDelete(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    startTransition(async () => {
      const result = await deletePhoto({ photoId });
      if (result.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {photos.map(p => (
          <div key={p.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt="Score evidence"
              className="h-14 w-14 rounded-md border object-cover"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              disabled={pending}
              className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full text-text-inv group-hover:flex"
              style={{ background: "var(--bad)", fontSize: 14, lineHeight: 1 }}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}

        <label
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-[18px] transition-colors hover:bg-surface-2"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--text-3)",
            background: pending ? "var(--surface-2)" : "transparent",
          }}
          title="Add photo"
        >
          {pending ? "…" : "+"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={pending}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {error && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
