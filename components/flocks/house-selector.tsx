"use client";

import { useState } from "react";

interface House {
  id: string;
  name: string;
  occupied: boolean;
  currentFlockReference: string | null;
}

interface FarmWithHouses {
  id: string;
  name: string;
  houses: House[];
}

interface Props {
  farms: FarmWithHouses[];
  preselectedHouseId?: string;
  preselectedFarmId?: string;
}

export function HouseSelector({ farms, preselectedHouseId, preselectedFarmId }: Props) {
  const initialFarm = preselectedFarmId ?? (
    preselectedHouseId
      ? farms.find(f => f.houses.some(h => h.id === preselectedHouseId))?.id ?? ""
      : ""
  );

  const [farmId, setFarmId] = useState<string>(initialFarm);
  const [houseId, setHouseId] = useState<string>(preselectedHouseId ?? "");

  const currentFarm = farms.find(f => f.id === farmId);
  const houses = currentFarm?.houses ?? [];

  function onFarmChange(newFarm: string) {
    setFarmId(newFarm);
    setHouseId("");
  }

  return (
    <div>
      <input type="hidden" name="house_id" value={houseId} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <select
          className="select"
          value={farmId}
          onChange={(e) => onFarmChange(e.target.value)}
        >
          <option value="">— Select farm —</option>
          {farms.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <select
          className="select"
          value={houseId}
          onChange={(e) => setHouseId(e.target.value)}
          disabled={!farmId || houses.length === 0}
        >
          <option value="">— Select house —</option>
          {houses.map(h => (
            <option key={h.id} value={h.id} disabled={h.occupied}>
              {h.name}{h.occupied ? ` (occupied — ${h.currentFlockReference ?? "active"})` : ""}
            </option>
          ))}
        </select>
      </div>

      {farmId && houses.length === 0 && (
        <div className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>
          This farm has no houses yet. Add houses first from the farm edit page.
        </div>
      )}

      {farmId && houses.length > 0 && houses.every(h => h.occupied) && (
        <div className="mt-2 text-[11px]" style={{ color: "var(--warn)" }}>
          All houses on this farm currently have active flocks. Clear an existing flock before placing a new one.
        </div>
      )}
    </div>
  );
}
