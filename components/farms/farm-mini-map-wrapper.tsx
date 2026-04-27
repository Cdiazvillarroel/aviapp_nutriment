"use client";

import dynamic from "next/dynamic";
import type { FarmStatus } from "@/components/map/map-icons";

interface Props {
  latitude: number;
  longitude: number;
  status?: FarmStatus;
  height?: number;
}

const FarmMiniMap = dynamic(
  function () { return import("./farm-mini-map").then(function (m) { return m.FarmMiniMap; }); },
  {
    ssr: false,
    loading: function () {
      return (
        <div
          className="flex items-center justify-center rounded-md"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            height: 240,
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
            Loading map...
          </span>
        </div>
      );
    },
  }
);

export function FarmMiniMapWrapper(props: Props) {
  return <FarmMiniMap {...props} />;
}
