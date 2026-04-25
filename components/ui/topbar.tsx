import { IconSearch, IconBell } from "./icons";

interface TopbarProps {
  crumbs: { label: string; href?: string }[];
  hasNotifications?: boolean;
}

export function Topbar({ crumbs, hasNotifications }: TopbarProps) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-surface px-7"
         style={{ borderColor: "var(--border)" }}>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span style={{ color: "var(--text-3)" }}>/</span>}
              {isLast ? (
                <strong className="font-medium" style={{ color: "var(--text)" }}>
                  {c.label}
                </strong>
              ) : c.href ? (
                <a href={c.href}>{c.label}</a>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <button className="topbar-icon-btn">
          <IconSearch size={15} />
        </button>
        <button className="topbar-icon-btn relative">
          <IconBell size={15} />
          {hasNotifications && (
            <span className="absolute right-[7px] top-[6px] h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--bad)", border: "2px solid var(--surface)" }} />
          )}
        </button>
      </div>

      <style>{`
        .topbar-icon-btn {
          width: 32px; height: 32px; border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-2);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .topbar-icon-btn:hover { background: var(--surface-2); color: var(--text); }
      `}</style>
    </div>
  );
}
