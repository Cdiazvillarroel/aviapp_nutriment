"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { createFarmIcon, type FarmStatus } from "@/components/map/map-icons";

interface Props {
  latitude: number;
  longitude: number;
  status?: FarmStatus;
  height?: number;
}

export function FarmMiniMap(props: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const status = props.status || "ok";
  const height = props.height || 240;

  useEffect(function () {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [props.latitude, props.longitude],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    mapRef.current = map;

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles \u00a9 Esri",
        maxZoom: 19,
      }
    ).addTo(map);

    const icon = createFarmIcon({ status: status, isToday: false });
    L.marker([props.latitude, props.longitude], { icon: icon }).addTo(map);

    return function () {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mapDivRef}
      className="overflow-hidden rounded-md"
      style={{
        height: height,
        background: "#1a2126",
        border: "1px solid var(--border)",
      }}
    />
  );
}
