import L from "leaflet";

export type FarmStatus = "ok" | "warn" | "alert";

export const STATUS_COLORS: Record<FarmStatus, { fill: string; label: string }> = {
  ok:    { fill: "#3a6b48", label: "All clear" },
  warn:  { fill: "#c66b1f", label: "Withdrawal active" },
  alert: { fill: "#a02020", label: "Visit overdue" },
};

interface IconOpts {
  status: FarmStatus;
  isToday: boolean;
}

export function createFarmIcon({ status, isToday }: IconOpts): L.DivIcon {
  const color = STATUS_COLORS[status].fill;

  const svg = `
    <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg" style="display:block">
      ${isToday ? `<circle cx="18" cy="18" r="20" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3 2" opacity="0.55"/>` : ""}
      <path
        d="M 18 0 C 28 0 36 8 36 18 C 36 30 18 47 18 47 C 18 47 0 30 0 18 C 0 8 8 0 18 0 Z"
        fill="${color}"
        stroke="white"
        stroke-width="2"
      />
      <g fill="white">
        <ellipse cx="13" cy="23" rx="9" ry="6"/>
        <ellipse cx="22" cy="14" rx="5" ry="4.5"/>
        <path d="M 19 9 L 20 6 L 21.5 8 L 23 5 L 24.5 8 L 26 6 L 27 9" fill="#e8514a"/>
        <polygon points="27,14 30,15 27,16" fill="#f9a825"/>
        <circle cx="23" cy="13" r="0.9" fill="#222"/>
        <path d="M 8 21 Q 13 17 18 24" stroke="${color}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: "nh-farm-marker",
    iconSize: [36, 48],
    iconAnchor: [18, 47],
    popupAnchor: [0, -48],
  });
}
