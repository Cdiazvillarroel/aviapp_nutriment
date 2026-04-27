"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayout, IconHome, IconClock, IconCheckSquare,
  IconReport, IconTrendUp, IconSettings, IconLogout,
} from "./icons";
import { signOut } from "@/app/(auth)/login/actions";

interface SidebarProps {
  userName: string;
  userRole: string;
  clientName: string;
  todayVisitCount?: number;
  alertCount?: number;
  highAlertCount?: number;
}

type NavItem = {
  href: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactElement;
  soon?: boolean;
};

function IconMapPin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function IconBell({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  );
}

const NAV_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayout },
  { href: "/farms",     label: "Farms",     icon: IconHome },
  { href: "/map",       label: "Map",       icon: IconMapPin },
  { href: "/flocks",    label: "Flocks",    icon: IconHome },
  { href: "/visits",    label: "Visits",    icon: IconClock },
  { href: "/alerts",    label: "Alerts",    icon: IconBell },
  { href: "/scoring",   label: "Scoring",   icon: IconCheckSquare },
];

const NAV_INSIGHTS: NavItem[] = [
  { href: "/reports",    label: "Reports",    icon: IconReport },
  { href: "/analytics",  label: "Analytics",  icon: IconTrendUp },
  { href: "/benchmarks", label: "Benchmarks", icon: IconTrendUp, soon: true },
];

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const userName = props.userName;
  const userRole = props.userRole;
  const clientName = props.clientName;
  const todayVisitCount = props.todayVisitCount;
  const alertCount = props.alertCount ?? 0;
  const highAlertCount = props.highAlertCount ?? 0;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const initial = userName.charAt(0).toUpperCase();

  return (
    <aside
      className="sticky top-0 flex h-screen flex-col overflow-hidden text-text-inv"
      style={{ background: "var(--green-900)", width: "240px" }}
    >
      <div className="flex items-center gap-2.5 border-b px-5 py-4"
           style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="relative h-7 w-7 flex-shrink-0 rounded-full"
             style={{ background: "var(--surface)" }}>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full"
                style={{ background: "var(--orange-500)" }} />
        </div>
        <div className="font-display text-[17px] font-medium leading-tight">
          Nutriment
          <span className="block text-[10px] uppercase tracking-[0.16em] opacity-65 font-normal">
            Health
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-b px-5 py-3.5"
           style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium"
             style={{ background: "var(--green-700)" }}>
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{userName}</div>
          <div className="text-[11px] uppercase tracking-wider opacity-60">{userRole}</div>
        </div>
      </div>

      <div className="border-b px-5 py-3 text-[11px] uppercase tracking-wider opacity-55"
           style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        Client
        <strong className="mt-1 block text-sm font-medium normal-case tracking-normal opacity-100 text-text-inv">
          {clientName}
        </strong>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_PRIMARY.map(function (item) {
          const Icon = item.icon;
          const href = item.href;
          const label = item.label;
          return (
            <NavLink key={href} href={href} active={isActive(href)}>
              <Icon size={16} />
              <span>{label}</span>
              {label === "Visits" && todayVisitCount && todayVisitCount > 0 ? (
                <span className="ml-auto rounded-full px-1.5 py-px text-[10px] font-medium"
                      style={{ background: "var(--orange-500)", color: "var(--text)" }}>
                  {todayVisitCount}
                </span>
              ) : null}
              {label === "Alerts" && alertCount > 0 ? (
                <span className="ml-auto rounded-full px-1.5 py-px text-[10px] font-medium"
                      style={{
                        background: highAlertCount > 0 ? "#a02020" : "var(--orange-500)",
                        color: "white",
                      }}>
                  {alertCount}
                </span>
              ) : null}
            </NavLink>
          );
        })}

        <div className="px-3 pb-2 pt-3.5 text-[10px] font-medium uppercase tracking-widest opacity-45">
          Insights
        </div>
        {NAV_INSIGHTS.map(function (item) {
          const Icon = item.icon;
          return (
            <NavLink key={item.href} href={item.href} active={isActive(item.href)} disabled={item.soon}>
              <Icon size={16} />
              <span>{item.label}</span>
              {item.soon ? (
                <span className="ml-auto text-[9px] uppercase tracking-wider opacity-50">
                  soon
                </span>
              ) : null}
            </NavLink>
          );
        })}

        <div className="px-3 pb-2 pt-3.5 text-[10px] font-medium uppercase tracking-widest opacity-45">
          Setup
        </div>
        <NavLink href="/settings" active={isActive("/settings")} disabled>
          <IconSettings size={16} />
          <span>Settings</span>
          <span className="ml-auto text-[9px] uppercase tracking-wider opacity-50">soon</span>
        </NavLink>
      </nav>

      <form action={signOut} className="border-t p-3"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button type="submit"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors hover:bg-white/5">
          <IconLogout size={16} />
          <span>Sign out</span>
        </button>
      </form>
    </aside>
  );
}

function NavLink(props: {
  href: string; active: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  const className =
    "my-px flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors " +
    (props.active
      ? "bg-white/10 font-medium text-text-inv shadow-[inset_2px_0_0_var(--orange-500)]"
      : "text-white/75 hover:bg-white/5 hover:text-text-inv") +
    (props.disabled ? " pointer-events-none opacity-50" : "");

  if (props.disabled) return <span className={className}>{props.children}</span>;

  return (
    <Link href={props.href} className={className}>
      {props.children}
    </Link>
  );
}
