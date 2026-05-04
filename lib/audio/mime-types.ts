// lib/audio/mime-types.ts
//
// MediaRecorder format detection.
//
// Different browsers/devices support different audio container formats:
//   - Chrome/Edge desktop: webm + opus (best compression)
//   - Firefox desktop: webm + opus (similar)
//   - iOS Safari 14.5+: mp4 (AAC) only
//   - iOS Safari 17+: also supports webm
//   - Android Chrome: webm + opus
//
// For Whisper/AI processing later, all of these formats are supported,
// so we just pick whatever the device handles best.

const PREFERRED_TYPES = [
  // Best for compression and quality, supported on most modern browsers
  "audio/webm;codecs=opus",
  "audio/webm",
  // iOS Safari fallback (most iPads will land here)
  "audio/mp4;codecs=mp4a.40.2",  // AAC-LC
  "audio/mp4",
  // Other fallbacks
  "audio/ogg;codecs=opus",
  "audio/mpeg",
];

/**
 * Pick the best supported audio MIME type for MediaRecorder.
 * Returns null if the browser doesn't support any audio recording at all.
 */
export function pickBestAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of PREFERRED_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported can throw on some old browsers
      continue;
    }
  }
  return null;
}

/**
 * Returns true if this browser can record audio at all.
 */
export function isAudioRecordingSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof MediaRecorder === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return pickBestAudioMimeType() !== null;
}

/**
 * Map a MIME type to a sensible file extension.
 */
export function mimeTypeToExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("mp4")) return "mp4";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  return "webm";
}
