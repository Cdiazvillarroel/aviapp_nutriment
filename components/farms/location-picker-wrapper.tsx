"use client";

import dynamic from "next/dynamic";

interface Props {
  initialLat: number | null;
  initialLng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

const LocationPicker = dynamic(
  function () { return import("./location-picker").then(function (m) { return m.LocationPicker; }); },
  {
    ssr: false,
    loading: function () {
      return (
        <div
          className="flex items-center justify-center rounded-lg border"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            height: 380,
          }}
        >
          <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
            Loading map...
          </span>
        </div>
      );
    },
  }
);

export function LocationPickerWrapper(props: Props) {
  return <LocationPicker {...props} />;
}
