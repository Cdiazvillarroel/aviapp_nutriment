"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { MapControls, type FilterKey } from "./map-controls";
import { FarmDrawer } from "./farm-drawer";
import { createFarmIcon } from "./map-icons";
import type { MapFarm } from "@/lib/map-queries";

interface Props {
  farms: MapFarm[];
}

const BENDIGO: [number, number] = [-36.7570, 144.2794];

export function MapClient({ farms }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [selectedFarm, setSelectedFarm] = useState<MapFarm | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [tileLayer, setTileLayer] = useState<"satellite" | "street">("satellite");

  const filteredFarms = useMemo(() => {
    return farms.filter(f => {
      if (filter === "today" && !f.scheduled_today) return false;
      if (filter !== "all" && filter !== "today" && f.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!f.name.toLowerCase().includes(q) &&
            !(f.address?.toLowerCase().includes(q) ?? false)) {
          return false;
        }
      }
      return true;
    });
  }, [farms, filter, search]);

  const counts = useMemo(() => {
    return {
      all:   farms.length,
      ok:    farms.filter(f => f.status === "ok").length,
      warn:  farms.filter(f => f.status === "warn").length,
      alert: farms.filter(f => f.status === "alert").length,
      today: farms.filter(f => f.scheduled_today).length,
    };
  }, [farms]);

  // Initialise map once
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: BENDIGO,
      zoom: 11,
      zoomControl: true,
      preferCanvas: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Tile layer (toggleable)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const newLayer =
      tileLayer === "satellite"
        ? L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
              maxZoom: 19,
            }
          )
        : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
          });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [tileLayer]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    if (filteredFarms.length === 0) return;

    for (const farm of filteredFarms) {
      const icon = createFarmIcon({
        status: farm.status,
        isToday: farm.scheduled_today,
      });
      const marker = L.marker([farm.latitude, farm.longitude], {
        icon,
        title: farm.name,
      });
      marker.on("click", () => setSelectedFarm(farm));
      marker.addTo(map);
      markersRef.current.set(farm.id, marker);
    }

    if (!selectedFarm) {
      const bounds = L.latLngBounds(
        filteredFarms.map(f => [f.latitude, f.longitude])
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFarms]);

  // Centre map on selected farm
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFarm) return;
    const targetZoom = Math.max(map.getZoom(), 13);
    const point = map.project([selectedFarm.latitude, selectedFarm.longitude], targetZoom);
    point.x += 180;
    const targetLatLng = map.unproject(point, targetZoom);
    map.flyTo(targetLatLng, targetZoom, { duration: 0.6 });
  }, [selectedFarm]);

  if (farms.length === 0) {
    return (
      <div
        className="flex h-[calc(100vh-90px)] w-full items-center justify-center"
        style={{ background: "var(--surface-2)" }}
      >
        <div className="card max-w-[420px] text-center">
          <div className="card__body" style={{ padding: 32 }}>
            <h2 className="font-display text-[18px] font-medium m-0 mb-2">
              No farms with coordinates yet
            </h2>
            <p className="m-0 mb-4 text-[13px]" style={{ color: "var(--text-2)" }}>
              Edit a farm to set its location, or run the seed migration to
              populate the demo farms with coordinates around Bendigo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: "calc(100vh - 90px)" }}>
      <div ref={mapDivRef} className="h-full w-full" style={{ background: "#1a2126" }} />

      <MapControls
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        tileLayer={tileLayer}
        onTileLayerChange={setTileLayer}
      />

      {filteredFarms.length === 0 && (
        <div
          className="absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 rounded-md px-4 py-3 text-[13px] shadow-lg"
          style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          No farms match the current filter.
        </div>
      )}

      {selectedFarm && (
        <FarmDrawer
          farm={selectedFarm}
          onClose={() => setSelectedFarm(null)}
        />
      )}
    </div>
  );
}
