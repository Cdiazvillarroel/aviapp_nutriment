"use client";

import { useState } from "react";
import { LocationPickerWrapper } from "./location-picker-wrapper";

interface Props {
  initialLat: number | null;
  initialLng: number | null;
}

export function FarmFormClient(props: Props) {
  const [lat, setLat] = useState<number | null>(props.initialLat);
  const [lng, setLng] = useState<number | null>(props.initialLng);

  function handleChange(newLat: number | null, newLng: number | null) {
    setLat(newLat);
    setLng(newLng);
  }

  return (
    <>
      <input type="hidden" name="latitude" value={lat !== null ? lat.toString() : ""} />
      <input type="hidden" name="longitude" value={lng !== null ? lng.toString() : ""} />

      <LocationPickerWrapper
        initialLat={props.initialLat}
        initialLng={props.initialLng}
        onChange={handleChange}
      />
    </>
  );
}
