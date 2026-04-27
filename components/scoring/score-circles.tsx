"use client";

interface Props {
  scaleMax: number;
  startAt?: number;
  currentScore: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
}

const COLOR_RAMP = [
  { bg: "var(--ok-bg)",   fg: "var(--ok)",   border: "var(--ok)" },
  { bg: "#e8f0d9",        fg: "#5d7a2c",     border: "#7a9c39" },
  { bg: "var(--warn-bg)", fg: "var(--warn)", border: "var(--warn)" },
  { bg: "#f5d2bd",        fg: "#a64d1e",     border: "#c66b1f" },
  { bg: "var(--bad-bg)",  fg: "var(--bad)",  border: "var(--bad)" },
  { bg: "#7a1a14",        fg: "#fafaf6",     border: "#7a1a14" },
  { bg: "#4a0e0a",        fg: "#fafaf6",     border: "#4a0e0a" },
  { bg: "#2c0807",        fg: "#fafaf6",     border: "#2c0807" },
  { bg: "#1a0303",        fg: "#fafaf6",     border: "#1a0303" },
];

export function ScoreCircles({ scaleMax, startAt = 0, currentScore, onChange, disabled }: Props) {
  const buttons: number[] = [];
  for (let n = startAt; n <= scaleMax; n++) buttons.push(n);

  const range = buttons.length - 1;

  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map((n, idx) => {
        const isActive = currentScore === n;
        const rampIdx = range === 0 ? 0 : Math.round((idx / range) * (COLOR_RAMP.length - 1));
        const colors = COLOR_RAMP[Math.min(rampIdx, COLOR_RAMP.length - 1)];

        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(isActive ? null : n)}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium transition-all"
            style={{
              background: isActive ? colors.bg : "var(--surface)",
              color: isActive ? colors.fg : "var(--text-2)",
              border: `1.5px solid ${isActive ? colors.border : "var(--border)"}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
