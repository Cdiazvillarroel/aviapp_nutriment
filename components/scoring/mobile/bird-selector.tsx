"use client";

interface Props {
  birdCount: number;
  activeBird: number;
  onSelectBird: (n: number) => void;
  totalDone: number;
  totalCells: number;
}

export function BirdSelector(props: Props) {
  return (
    <div
      className="sticky top-[44px] z-20 flex items-center gap-2 overflow-x-auto px-3 py-2.5"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      <span
        className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-3)" }}
      >
        Bird
      </span>
      {Array.from({ length: props.birdCount }, function (_, i) { return i + 1; }).map(function (n) {
        const isActive = props.activeBird === n;
        return (
          <button
            key={n}
            type="button"
            onClick={function () { props.onSelectBird(n); }}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-medium transition-colors"
            style={{
              background: isActive ? "var(--green-700)" : "var(--surface-2)",
              color: isActive ? "#ffffff" : "var(--text-2)",
              border: `1px solid ${isActive ? "var(--green-700)" : "var(--border)"}`,
            }}
          >
            {n}
          </button>
        );
      })}
      <div
        className="ml-auto flex-shrink-0 text-[11px] font-mono tabular-nums"
        style={{ color: "var(--text-3)" }}
      >
        {props.totalDone}/{props.totalCells}
      </div>
    </div>
  );
}
