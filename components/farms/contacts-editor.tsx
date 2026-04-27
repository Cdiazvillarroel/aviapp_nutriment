"use client";

import { useState } from "react";

export interface ContactRow {
  id: string | null;
  role: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  archived: boolean;
}

interface Props {
  initial: ContactRow[];
}

const ROLE_SUGGESTIONS = [
  "Farm Manager",
  "Owner",
  "Producer",
  "Vet",
  "Feed Supplier",
  "Integrator Rep",
  "Other",
];

function emptyRow(): ContactRow {
  return {
    id: null,
    role: "",
    name: "",
    phone: "",
    email: "",
    notes: "",
    archived: false,
  };
}

export function ContactsEditor(props: Props) {
  const [rows, setRows] = useState<ContactRow[]>(props.initial.length > 0 ? props.initial : [emptyRow()]);

  function update(index: number, patch: Partial<ContactRow>) {
    setRows(function (prev) {
      const next = prev.slice();
      next[index] = Object.assign({}, next[index], patch);
      return next;
    });
  }

  function addRow() {
    setRows(function (prev) { return prev.concat([emptyRow()]); });
  }

  function archiveRow(index: number) {
    const row = rows[index];
    if (row.id) {
      update(index, { archived: true });
    } else {
      setRows(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
    }
  }

  function unarchiveRow(index: number) {
    update(index, { archived: false });
  }

  const visibleRows = rows.filter(function (r) {
    return !r.archived || r.id !== null;
  });

  return (
    <div>
      <input
        type="hidden"
        name="contacts_json"
        value={JSON.stringify(rows)}
      />

      <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--divider)" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <Th>Role</Th>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Email</Th>
              <Th>Notes</Th>
              <Th width="60px" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[12px]"
                    style={{ color: "var(--text-3)" }}>
                  No contacts yet. Click &quot;+ Add contact&quot; to add one.
                </td>
              </tr>
            ) : null}

            {rows.map(function (row, idx) {
              if (row.archived && row.id !== null) {
                return (
                  <tr key={"row-" + idx} style={{ background: "#fdf3ea" }}>
                    <td colSpan={5} className="px-3 py-2 text-[11px]" style={{ color: "var(--text-2)" }}>
                      Will be removed: <strong>{row.name || "(unnamed)"}</strong>
                      {row.role ? " - " + row.role : ""}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={function () { unarchiveRow(idx); }}
                        className="text-[11px]"
                        style={{ color: "var(--green-700)" }}
                      >
                        Undo
                      </button>
                    </td>
                  </tr>
                );
              }

              if (row.archived) {
                return null;
              }

              return (
                <tr key={"row-" + idx} className="border-t" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-2 py-1.5">
                    <input
                      list="role-suggestions"
                      className="input w-full"
                      style={{ fontSize: 12 }}
                      value={row.role}
                      onChange={function (e) { update(idx, { role: e.target.value }); }}
                      placeholder="Manager, Vet..."
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="input w-full"
                      style={{ fontSize: 12 }}
                      value={row.name}
                      onChange={function (e) { update(idx, { name: e.target.value }); }}
                      placeholder="Full name"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="tel"
                      className="input w-full"
                      style={{ fontSize: 12 }}
                      value={row.phone}
                      onChange={function (e) { update(idx, { phone: e.target.value }); }}
                      placeholder="+61 ..."
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="email"
                      className="input w-full"
                      style={{ fontSize: 12 }}
                      value={row.email}
                      onChange={function (e) { update(idx, { email: e.target.value }); }}
                      placeholder="email@..."
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="input w-full"
                      style={{ fontSize: 12 }}
                      value={row.notes}
                      onChange={function (e) { update(idx, { notes: e.target.value }); }}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={function () { archiveRow(idx); }}
                      className="text-[14px] leading-none"
                      title="Remove contact"
                      style={{ color: "var(--text-3)" }}
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <datalist id="role-suggestions">
        {ROLE_SUGGESTIONS.map(function (r) {
          return <option key={r} value={r} />;
        })}
      </datalist>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 rounded-md px-3 py-1.5 text-[12px] font-medium"
        style={{
          color: "var(--green-700)",
          border: "1px dashed var(--green-700)",
          background: "transparent",
        }}
      >
        + Add contact
      </button>
    </div>
  );
}

function Th(props: { children?: React.ReactNode; width?: string }) {
  return (
    <th
      className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider"
      style={{ color: "var(--text-3)", width: props.width }}
    >
      {props.children}
    </th>
  );
}
