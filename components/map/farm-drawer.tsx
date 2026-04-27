"use client";

import Link from "next/link";
import { IconHome, IconClock, IconReport } from "@/components/ui/icons";
import { STATUS_COLORS } from "./map-icons";
import type { MapFarm } from "@/lib/map-queries";

interface Props {
  farm: MapFarm;
  onClose: () => void;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function FarmDrawer({ farm, onClose }: Props) {
  const lastVisitText = farm.last_visit_at
    ? daysSince(farm.last_visit_at) + " day" + (daysSince(farm.last_visit_at) === 1 ? "" : "s") + " ago"
    : "Never visited";

  const status = STATUS_COLORS[farm.status];
  const statusBg = status.fill + "20";
  const directionsUrl = "https://www.google.com/maps/dir/?api=1&destination=" + farm.latitude + "," + farm.longitude;

  return (
    <div
      className="absolute right-0 top-0 z-[1100] flex h-full w-[360px] flex-col overflow-hidden border-l shadow-2xl"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-start justify-between border-b px-5 py-3.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="font-display text-[18px] font-medium leading-tight m-0">
            {farm.name}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ background: statusBg, color: status.fill }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: status.fill }}
              />
              {status.label}
            </span>
            {farm.scheduled_today ? (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ background: "var(--green-100)", color: "var(--green-700)" }}
              >
                Visit today
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-2 py-1 text-[20px] leading-none"
          style={{ color: "var(--text-3)" }}
          aria-label="Close"
          type="button"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {farm.address ? (
          <div className="mb-4">
            <Label>Address</Label>
            <div className="text-[13px]">{farm.address}</div>
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-2 gap-2">
          <StatBox
            label="Active flocks"
            value={farm.active_flocks_count.toString()}
            sub={farm.occupied_houses + "/" + farm.total_houses + " houses"}
          />
          <StatBox
            label="Last visit"
            value={lastVisitText}
            sub={farm.last_visit_type || "n/a"}
          />
        </div>

        {farm.active_withdrawals.length > 0 ? (
          <div
            className="mb-5 rounded-md border p-3"
            style={{ borderColor: STATUS_COLORS.warn.fill, background: "#fdf3ea" }}
          >
            <Label>Active withdrawals</Label>
            <div className="mt-1.5 space-y-1.5">
              {farm.active_withdrawals.map(function (w, i) {
                return (
                  <div
                    key={i}
                    className="flex items-baseline justify-between text-[12px]"
                  >
                    <span>
                      <strong>{w.drug}</strong>
                      {w.flock_ref ? (
                        <span
                          className="ml-1 text-[10px]"
                          style={{ color: "var(--text-3)" }}
                        >
                          ({w.flock_ref})
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: STATUS_COLORS.warn.fill }}
                    >
                      {w.days_remaining}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <Label>Actions</Label>
        <div className="mt-2 space-y-2">
          <Link
            href={"/visits/new?farm=" + farm.id}
            className="btn btn--primary w-full justify-center"
          >
            <IconClock size={14} />
            Schedule visit
          </Link>
          <Link
            href={"/farms/" + farm.id}
            className="btn w-full justify-center"
          >
            <IconHome size={14} />
            Farm details
          </Link>
          <Link
            href={"/visits?farm=" + farm.id}
            className="btn w-full justify-center"
          >
            All visits
          </Link>
          <Link
            href={"/reports?farm=" + farm.id}
            className="btn w-full justify-center"
          >
            <IconReport size={14} />
            Reports
          </Link>
          
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn w-full justify-center"
          >
            Get directions
          </a>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-medium uppercase tracking-widest"
      style={{ color: "var(--text-3)" }}
    >
      {children}
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--divider)", background: "var(--surface-2)" }}
    >
      <div
        className="text-[9px] font-medium uppercase tracking-widest"
        style={{ color: "var(--text-3)" }}
      >
        {label}
      </div>
      <div className="mt-0.5 font-display text-[16px] leading-tight">{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-3)" }}>
        {sub}
      </div>
    </div>
  );
}
