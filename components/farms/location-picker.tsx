"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { createFarmIcon } from "@/components/map/map-icons";

interface Props {
  initialLat: number | null;
  initialLng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

const BENDIGO: [number, number] = [-36.7570, 144.2794];

export function LocationPicker({ initialLat, initialLng, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [lat, setLat] = useState<string>(initialLat !== null ? initialLat.toString() : "");
  const [lng, setLng] = useState<string>(initialLng !== null ? initialLng.toString() : "");
  const [tileLayer, setTileLayer] = useState<"satellite" | "street">("satellite");

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const startCenter: [number, number] =
      initialLat !== null && initialLng !== null
        ? [initialLat, initialLng]
        : BENDIGO;
    const startZoom = initialLat !== null ? 14 : 11;

    const map = L.map(mapDivRef.current, {
      center: startCenter,
      zoom: startZoom,
      zoomControl: true,
    });

    mapRef.current = map;

    map.on("click", function (e: L.LeafletMouseEvent) {
      placePin(e.latlng.lat, e.latlng.lng);
    });

    if (initialLat !== null && initialLng !== null) {
      placeMarkerAt(map, initialLat, initialLng);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              attribution: "Tiles \u00a9 Esri",
              maxZoom: 19,
            }
          )
        : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "\u00a9 OpenStreetMap contributors",
            maxZoom: 19,
          });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [tileLayer]);

  function placeMarkerAt(map: L.Map, latVal: number, lngVal: number) {
    if (markerRef.current) {
      markerRef.current.setLatLng([latVal, lngVal]);
    } else {
      const icon = createFarmIcon({ status: "ok", isToday: false });
      const marker = L.marker([latVal, lngVal], {
        icon,
        draggable: true,
      });
      marker.on("dragend", function () {
        const pos = marker.getLatLng();
        commit(pos.lat, pos.lng);
      });
      marker.addTo(map);
      markerRef.current = marker;
    }
  }

  function placePin(latVal: number, lngVal: number) {
    const map = mapRef.current;
    if (!map) return;
    placeMarkerAt(map, latVal, lngVal);
    commit(latVal, lngVal);
  }

  function commit(latVal: number, lngVal: number) {
    const roundedLat = Math.round(latVal * 1000000) / 1000000;
    const roundedLng = Math.round(lngVal * 1000000) / 1000000;
    setLat(roundedLat.toString());
    setLng(roundedLng.toString());
    onChange(roundedLat, roundedLng);
  }

  function commitFromInputs() {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      onChange(null, null);
      return;
    }
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      onChange(null, null);
      return;
    }
    const map = mapRef.current;
    if (map) {
      placeMarkerAt(map, parsedLat, parsedLng);
      map.setView([parsedLat, parsedLng], Math.max(map.getZoom(), 13));
    }
    onChange(parsedLat, parsedLng);
  }

  function clearPin() {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    setLat("");
    setLng("");
    onChange(null, null);
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const map = mapRef.current;
        if (map) {
          placeMarkerAt(map, pos.coords.latitude, pos.coords.longitude);
          map.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
        commit(pos.coords.latitude, pos.coords.longitude);
      },
      function (err) {
        alert("Could not get your location: " + err.message);
      }
    );
  }

  const hasPin = lat !== "" && lng !== "";

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--border)", height: 380 }}
      >
        <div ref={mapDivRef} className="h-full w-full" style={{ background: "#1a2126" }} />

        <div
          className="absolute left-3 top-3 z-[1000] flex overflow-hidden rounded-md shadow-md"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={function () { setTileLayer("satellite"); }}
            className="px-3 py-1.5 text-[11px] capitalize transition-colors"
            style={{
              background: tileLayer === "satellite" ? "var(--green-700)" : "transparent",
              color: tileLayer === "satellite" ? "var(--text-inv)" : "var(--text)",
              fontWeight: tileLayer === "satellite" ? 500 : 400,
            }}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={function () { setTileLayer("street"); }}
            className="px-3 py-1.5 text-[11px] capitalize transition-colors"
            style={{
              background: tileLayer === "street" ? "var(--green-700)" : "transparent",
              color: tileLayer === "street" ? "var(--text-inv)" : "var(--text)",
              fontWeight: tileLayer === "street" ? 500 : 400,
            }}
          >
            Street
          </button>
        </div>

        {!hasPin ? (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-md px-3 py-1.5 text-[11px] shadow-md"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            Click on the map to drop a pin
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider"
                 style={{ color: "var(--text-3)" }}>
            Latitude
          </label>
          <input
            type="text"
            className="input w-full"
            value={lat}
            onChange={function (e) { setLat(e.target.value); }}
            onBlur={commitFromInputs}
            placeholder="-36.757"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider"
                 style={{ color: "var(--text-3)" }}>
            Longitude
          </label>
          <input
            type="text"
            className="input w-full"
            value={lng}
            onChange={function (e) { setLng(e.target.value); }}
            onBlur={commitFromInputs}
            placeholder="144.279"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            className="btn flex-1"
            style={{ fontSize: 11 }}
          >
            Use my location
          </button>
          {hasPin ? (
            <button
              type="button"
              onClick={clearPin}
              className="btn"
              style={{ fontSize: 11 }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <p className="m-0 text-[11px]" style={{ color: "var(--text-3)" }}>
        Click on the map, drag the pin to fine-tune, paste coordinates manually, or use your current location.
      </p>
    </div>
  );
}
