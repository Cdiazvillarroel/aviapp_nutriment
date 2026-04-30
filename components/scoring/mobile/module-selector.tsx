"use client";

interface Props {
  modules: string[];
  activeModule: string;
  onSelectModule: (m: string) => void;
}

export function ModuleSelector(props: Props) {
  return (
    <div
      className="sticky top-[105px] z-20 overflow-x-auto px-3 py-2"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      <div className="flex items-center gap-2 whitespace-nowrap">
        {props.modules.map(function (m) {
          const isActive = props.activeModule === m;
          return (
            <button
              key={m}
              type="button"
              onClick={function () { props.onSelectModule(m); }}
              className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
              style={{
                background: isActive ? "var(--green-700)" : "var(--surface-2)",
                color: isActive ? "#ffffff" : "var(--text-2)",
                border: `1px solid ${isActive ? "var(--green-700)" : "var(--border)"}`,
              }}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
