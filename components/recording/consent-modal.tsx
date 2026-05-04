"use client";

// components/recording/consent-modal.tsx
//
// Modal that appears the first time a vet wants to record on a farm.
// Vet confirms verbally with the farmer, then taps "Farmer has consented".
//
// Design choice: modal is intentionally explicit and a bit slow to dismiss
// (no swipe-to-dismiss, no overlay tap-to-close) so the vet is forced to
// read the disclosure before confirming. Privacy Act 1988 (AU) compliance.

interface Props {
  open: boolean;
  loading: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConsentModal({
  open,
  loading,
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div
        className="w-full max-w-md rounded-lg p-5"
        style={{ background: "var(--surface)" }}
      >
        <h2
          id="consent-modal-title"
          className="m-0 mb-3 text-[16px] font-semibold leading-tight"
          style={{ color: "var(--text-1)" }}
        >
          Farmer recording consent
        </h2>

        <p
          className="m-0 mb-3 text-[13px] leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          To record this visit, the farmer must consent to audio recording for
          veterinary documentation and AI-assisted analysis.
        </p>

        <div
          className="m-0 mb-4 rounded-md p-3 text-[12px] leading-relaxed"
          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
        >
          <ul className="m-0 list-disc pl-4 space-y-1.5">
            <li>Recordings are stored securely and accessible only by your team.</li>
            <li>Audio is retained for 30 days; transcripts are kept longer for record-keeping.</li>
            <li>The farmer may request deletion at any time.</li>
            <li>Consent applies to all future visits to this farm until revoked.</li>
          </ul>
        </div>

        {errorMessage && (
          <div
            className="mb-3 rounded-md px-3 py-2 text-[12px]"
            style={{ background: "var(--surface-2)", color: "var(--bad)", border: "1px solid var(--bad)" }}
          >
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md px-3 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md px-3 py-2 text-[13px] font-medium disabled:opacity-60"
            style={{ background: "var(--green-700)", color: "#fff" }}
          >
            {loading ? "Saving…" : "Farmer has consented"}
          </button>
        </div>
      </div>
    </div>
  );
}
