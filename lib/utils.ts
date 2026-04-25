/** Format a date as a relative phrase: "Today", "2d ago", "11d ago". */
export function relativeDay(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfToday.getTime() - startOfThat.getTime()) / 86_400_000);

  if (days === 0)  return "Today";
  if (days === 1)  return "Yesterday";
  if (days > 0)    return `${days}d ago`;
  if (days === -1) return "Tomorrow";
  return `in ${-days}d`;
}

/** Format a date as e.g. "08:30". */
export function timeOf(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Capitalise first letter. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format relative time-ago in hours/days, for short labels like "2h ago". */
export function relativeTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Pretty visit type label. */
export function visitTypeLabel(t: string): string {
  return ({
    routine: "Routine",
    sanitary: "Sanitary",
    post_mortem: "Post-mortem",
    audit: "Audit",
  } as Record<string, string>)[t] ?? t;
}
