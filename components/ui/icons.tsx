// Inline SVG icons in the Lucide style. When you're ready, swap for
// `import { Home, Bell, ... } from "lucide-react"` — same names, same look.

import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function makeIcon(d: string) {
  return function Icon({ size = 16, ...props }: IconProps) {
    return (
      <svg {...base} {...props} width={size} height={size}>
        <path d={d} />
      </svg>
    );
  };
}

// Layout / nav
export const IconLayout = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export const IconHome = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M3 21V10l9-7 9 7v11" />
    <path d="M9 21v-7h6v7" />
  </svg>
);

export const IconClock = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconCheckSquare = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

export const IconReport = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8M8 17h6" />
  </svg>
);

export const IconTrendUp = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M3 3v18h18" />
    <polyline points="7 14 12 9 16 13 21 8" />
  </svg>
);

export const IconSettings = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconLogout = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const IconSearch = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const IconBell = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

export const IconAlert = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconAlertCircle = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconDroplet = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

export const IconCalendar = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const IconSparkles = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size} fill="currentColor" stroke="none">
    <path d="M12 2l2.4 5 5.4.5-4 3.7 1.2 5.3L12 14l-5 2.5 1.2-5.3-4-3.7L9.6 7z" />
  </svg>
);

export const IconArrowRight = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export const IconChevronRight = ({ size = 16, ...p }: IconProps) => (
  <svg {...base} {...p} width={size} height={size}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
