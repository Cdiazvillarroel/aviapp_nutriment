"use client";

import { useState } from "react";

export interface HouseRow {
  id?: string;
  name: string;
  custom_id: string;
  dimensions: string;
  drink_system: string;
  feed_system: string;
  housing_system: string;
  capacity: string;
  _markedForDelete?: boolean;
}

interface Props {
  initial?: HouseRow[];
}

export function HousesEditor({ initial = [] }: Props) {
  const [rows, setRows] = useState<HouseRow[]>(initial);

  function addRow() {
    setRows(prev => [...prev, {
      name: "",
      custom_id: "",
      dimensions: "",
      drink_system: "",
      feed_system: "",
      housing_system: "",
      capacity: "",
    }]);
  }

  function updateField(index: number, field: keyof HouseRow, value: string) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function removeRow(index: number) {
    setRows(prev => {
      const row = prev[index];
      if (row.id) {
        return prev.map((r, i) => i === index ? { ...r, _markedForDelete: true } : r);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function undoRemove(index: number) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, _markedForDelete: false } : r));
  }

  const visibleCount = rows.filter(r => !r._markedForDelete).length;

  return (
    <div>
      <input type="hidden" name="houses_json" value={JSON.stringify(rows)} />

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
          {visibleCount} house{visibleCount === 1 ? "" : "s"}
        </span>
        <button type="button" onClick={addRow} className="btn btn--primary btn--sm">
          + Add house
        </button>
      </div>

      {visibleCount === 0 ? (
        <div
          className="rounded-md border px-4 py-6 text-center text-[12px]"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}
        >
          No houses yet. Click <strong>+ Add house</strong> to add the first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                <Th>Name *</Th>
                <Th>Custom ID</Th>
                <Th>Capacity</Th>
                <Th>Dimensions</Th>
                <Th>Drink</Th>
                <Th>Feed</Th>
                <Th>Housing</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <HouseRowEditor
                  key={row.id ?? `new-${i}`}
                  row={row}
                  onChange={(field, value) => updateField(i, field, value)}
                  onRemove={() => removeRow(i)}
                  onUndoRemove={() => undoRemove(i)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="border-b px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider"
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </th>
  );
}

function HouseRowEditor({
  row, onChange, onRemove, onUndoRemove,
}: {
  row: HouseRow;
  onChange: (field: keyof HouseRow, value: string) => void;
  onRemove: () => void;
  onUndoRemove: () => void;
}) {
  if (row._markedForDelete) {
    return (
      <tr style={{ background: "var(--bad-bg)" }}>
        <td colSpan={8} className="px-3 py-2 text-[12px]" style={{ color: "var(--bad)" }}>
          <span className="font-medium">{row.name || "(unnamed)"}</span> will be removed when you save.{" "}
          <button type="button" onClick={onUndoRemove} className="ml-2 underline" style={{ color: "var(--info)" }}>
            Undo
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t" style={{ borderColor: "var(--divider)" }}>
      <Td><InlineInput value={row.name} onChange={v => onChange("name", v)} placeholder="House 1" required /></Td>
      <Td><InlineInput value={row.custom_id} onChange={v => onChange("custom_id", v)} placeholder="—" /></Td>
      <Td><InlineInput value={row.capacity} onChange={v => onChange("capacity", v)} placeholder="0" type="number" /></Td>
      <Td><InlineInput value={row.dimensions} onChange={v => onChange("dimensions", v)} placeholder="—" /></Td>
      <Td><InlineInput value={row.drink_system} onChange={v => onChange("drink_system", v)} placeholder="—" /></Td>
      <Td><InlineInput value={row.feed_system} onChange={v => onChange("feed_system", v)} placeholder="—" /></Td>
      <Td><InlineInput value={row.housing_system} onChange={v => onChange("housing_system", v)} placeholder="—" /></Td>
      <Td>
        <button type="button" onClick={onRemove} className="px-2 py-1" style={{ color: "var(--bad)" }} title="Remove house">
          ×
        </button>
      </Td>
    </tr>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1 py-1 align-middle">{children}</td>;
}

function InlineInput({
  value, onChange, placeholder, required, type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded px-2 py-1.5 text-[12px]"
      style={{
        background: "transparent",
        border: "1px solid transparent",
        color: "var(--text)",
        outline: "none",
      }}
      onFocus={(e) => {
        e.currentTarget.style.background = "var(--surface)";
        e.currentTarget.style.borderColor = "var(--green-600)";
        e.currentTarget.style.boxShadow = "0 0 0 2px rgba(51,109,75,0.12)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}
