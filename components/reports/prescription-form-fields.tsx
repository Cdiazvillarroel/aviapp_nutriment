"use client";

import { useState } from "react";

interface Flock {
  id: string;
  reference: string | null;
  house_name: string;
  farm_name: string;
  active: boolean;
}

interface Props {
  flocks: Flock[];
  defaultFlockId?: string | null;
  defaults?: {
    drug_name?: string;
    active_ingredient?: string;
    dose?: string;
    administration?: string;
    start_date?: string;
    end_date?: string;
    withdrawal_days?: number;
    indication?: string;
    vet_name_override?: string;
    vet_license?: string;
  };
}

export function PrescriptionFormFields({ flocks, defaultFlockId, defaults }: Props) {
  const [administration, setAdministration] = useState(defaults?.administration ?? "");

  return (
    <div className="flex flex-col gap-4">
      <Field label="Flock" required hint="Active flocks are listed first.">
        <select className="select" name="flock_id" required defaultValue={defaultFlockId ?? ""}>
          <option value="">— Select flock —</option>
          {flocks.map(fl => (
            <option key={fl.id} value={fl.id}>
              {fl.reference ?? "—"} · {fl.farm_name} ({fl.house_name})
              {!fl.active ? " — past" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Drug brand name" required hint="As printed on the label.">
          <input className="input" name="drug_name" required maxLength={120}
                 placeholder="e.g. Amoxinsol 500" defaultValue={defaults?.drug_name ?? ""} />
        </Field>
        <Field label="Active ingredient" hint="e.g. Amoxicillin trihydrate.">
          <input className="input" name="active_ingredient" maxLength={120}
                 defaultValue={defaults?.active_ingredient ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Dose" hint="e.g. 15 mg/kg BW twice daily.">
          <input className="input" name="dose" maxLength={120}
                 defaultValue={defaults?.dose ?? ""} />
        </Field>
        <Field label="Administration">
          <select
            className="select"
            name="administration"
            value={administration}
            onChange={(e) => setAdministration(e.target.value)}
          >
            <option value="">— None —</option>
            <option value="water">In drinking water</option>
            <option value="feed">In feed</option>
            <option value="injection">Injection</option>
            <option value="spray">Spray / nebulisation</option>
            <option value="topical">Topical</option>
          </select>
        </Field>
      </div>

      <Field label="Indication" required hint="Diagnosis or clinical reason. Required for APVMA reporting.">
        <textarea
          className="textarea"
          name="indication"
          required
          rows={2}
          maxLength={500}
          placeholder="e.g. Necrotic enteritis confirmed by post-mortem; gut score 3+"
          defaultValue={defaults?.indication ?? ""}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Start date" required>
          <input className="input" type="date" name="start_date" required
                 defaultValue={defaults?.start_date ?? new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="End date" required>
          <input className="input" type="date" name="end_date" required
                 defaultValue={defaults?.end_date ?? ""} />
        </Field>
        <Field label="Withdrawal (days)" hint="Days after end before slaughter.">
          <input className="input" type="number" name="withdrawal_days" min={0} max={90}
                 defaultValue={defaults?.withdrawal_days?.toString() ?? "0"} />
        </Field>
      </div>

      <div className="border-t pt-4" style={{ borderColor: "var(--divider)" }}>
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          Veterinarian
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vet name" hint="Use this if the vet is external (not a portal user).">
            <input className="input" name="vet_name_override" maxLength={120}
                   placeholder="Dr. Sarah Mitchell BVSc"
                   defaultValue={defaults?.vet_name_override ?? ""} />
          </Field>
          <Field label="License number" hint="Veterinarian registration / license.">
            <input className="input" name="vet_license" maxLength={40}
                   placeholder="VIC-VET-08214"
                   defaultValue={defaults?.vet_license ?? ""} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-2)" }}>
        {label}
        {required && <span style={{ color: "var(--bad)" }}>*</span>}
      </div>
      {children}
      {hint && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>{hint}</div>
      )}
    </label>
  );
}
