"use client";

import { useState } from "react";

interface Props {
  visitId: string;
  hasActivePhoto: boolean;
  activeBird: number;
  activeModule: string;
  // Pass current item context if available
  currentDefinitionId?: string;
  currentScoreId?: string;
}

export function AIFab(props: Props) {
  const [open, setOpen] = useState(false);

  // FAB is only fully active when current item has a photo
  const isActive = props.hasActivePhoto && !!props.currentScoreId;

  return (
    <>
      <button
        type="button"
        onClick={function () { if (isActive) setOpen(true); }}
        disabled={!isActive}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all"
        style={{
          background: isActive ? "var(--orange-500)" : "var(--surface-2)",
          color: isActive ? "#ffffff" : "var(--text-3)",
          opacity: isActive ? 1 : 0.5,
          border: `2px solid ${isActive ? "var(--orange-500)" : "var(--border)"}`,
        }}
        aria-label="AI Assist"
      >
        <span style={{ fontSize: "22px" }}>✨</span>
      </button>

      {/* Bottom sheet */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={function () { setOpen(false); }}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-5 pb-8 pt-5"
            style={{
              background: "var(--surface)",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full" style={{ background: "var(--border)" }} />

            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-medium" style={{ color: "var(--text-1)" }}>
                AI Assist · Bird {props.activeBird}
              </h3>
              <button
                type="button"
                onClick={function () { setOpen(false); }}
                className="text-[13px]"
                style={{ color: "var(--text-3)" }}
              >
                Close
              </button>
            </div>

            <div className="mt-2 text-[12px]" style={{ color: "var(--text-3)" }}>
              {props.activeModule}
            </div>

            {/* AI Assist content placeholder - will integrate full AIAssistPanel here */}
            <div
              className="mt-4 rounded-md px-4 py-6 text-center text-[13px]"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-2)",
              }}
            >
              AI Assist will analyze the photo for the current scoring item.
              <br />
              <br />
              <em style={{ color: "var(--text-3)" }}>
                (Integration pending — sesión 1 layout only)
              </em>
            </div>
          </div>
        </>
      )}
    </>
  );
}
