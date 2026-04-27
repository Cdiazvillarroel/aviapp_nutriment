"use client";

import dynamic from "next/dynamic";
import type { MapFarm } from "@/lib/map-queries";

const MapClient = dynamic(
  () => import("./map-client").then(m => m.MapClient),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[calc(100vh-90px)] w-full items-center justify-center"
        style={{ background: "var(--surface-2)" }}
      >
        <div className="text-center">
          <div className="font-display text-[16px]"
               style={{ color: "var(--text-2)" }}>
            Loading map…
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
            One moment
          </div>
        </div>
      </div>
    ),
  }
);

export function MapClientWrapper({ farms }: { farms: MapFarm[] }) {
  return <MapClient farms={farms} />;
}
