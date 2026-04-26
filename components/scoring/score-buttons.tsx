"use client";

interface Props {
  scaleMax: number;
  currentScore: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
}

const COLOR_RAMP = [
  { bg: "var(--ok-bg)",   fg: "var(--ok)",   border: "var(--ok)" },     // 0 = perfect
  { bg: "#e8f0d9",        fg: "#5d7a2c",     border: "#7a9c39" },        // 1 = mild
  { bg: "var(--warn-bg)", fg: "var(--warn)", border: "var(--warn)" },   // 2 = moderate
  { bg: "#f5d2bd",        fg: "#a64d1e",     border: "#c66b1f" },        // 3 = significant
  { bg: "var(--bad-bg)",  fg: "var(--bad)",  border: "var(--bad)" },    // 4 = severe
  { bg: "#7a1a14",        fg: "#fafaf6",     border: "#7a1a14" },        // 5 = critical
];

export function ScoreButtons({ scaleMax, currentScore, onChange, disabled }: Props) {
  const buttons = Array.from({ length: scaleMax + 1 }, (_, i) => i);

  return (
    <div className="flex gap-1.5">
      {buttons.map(n => {
        const isActive = currentScore === n;
        const colors = COLOR_RAMP[Math.min(n, COLOR_RAMP.length - 1)];

        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(isActive ? null : n)}
            disabled={disabled}
            className="h-9 w-9 rounded-md text-[14px] font-medium transition-all"
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
