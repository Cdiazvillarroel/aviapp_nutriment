"use client";

interface Props {
  current: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function SexToggle({ current, onChange, disabled }: Props) {
  return (
    <div className="flex gap-1.5">
      {["M", "F"].map(v => {
        const isActive = current === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(isActive ? null : v)}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium transition-all"
            style={{
              background: isActive ? "var(--green-100)" : "var(--surface)",
              color: isActive ? "var(--green-700)" : "var(--text-2)",
              border: `1.5px solid ${isActive ? "var(--green-700)" : "var(--border)"}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
