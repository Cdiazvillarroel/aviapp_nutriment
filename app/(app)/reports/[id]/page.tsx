import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { PrintButton } from "@/components/reports/print-button";

const QUARTERS: Record<string, { label: string; start: number; end: number }> = {
  q1: { label: "Q1 (Jan–Mar)", start: 0,  end: 2  },
  q2: { label: "Q2 (Apr–Jun)", start: 3,  end: 5  },
  q3: { label: "Q3 (Jul–Sep)", start: 6,  end: 8  },
  q4: { label: "Q4 (Oct–Dec)", start: 9,  end: 11 },
};

export default async function QuarterlyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [yearStr, qKey] = id.split("-");
  const year = parseInt(yearStr, 10);
  const quarter = QUARTERS[qKey];
  if (!year || !quarter) {
    return (
      <>
        <Topbar crumbs={[{ label: "Reports", href: "/reports" }, { label: "Invalid report" }]} />
        <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Invalid report identifier. Use format YYYY-q1, YYYY-q2, etc.
          </p>
          <Link href="/reports" className="btn btn--primary mt-4">Back to reports</Link>
        </div>
      </>
    );
  }

  const start = new Date(year, quarter.start, 1);
  const end = new Date(year, quarter.end + 1, 0, 23, 59, 59);

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id, clients(name, slug)")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;
  const client = Array.isArray(membership?.clients) ? membership?.clients[0] : membership?.clients;

  const { data: prescriptionsData } = await supabase
    .from("prescriptions")
    .select(`
      id, drug_name, active_ingredient, dose, administration,
      start_date, end_date, withdrawal_days,
      indication, reason,
      vet_name_override, vet_license,
      flocks(reference, initial_count, breeds(name), houses(name, farms(name)))
    `)
    .eq("client_id", clientId)
    .gte("start_date", start.toISOString().slice(0, 10))
    .lte("start_date", end.toISOString().slice(0, 10))
    .order("start_date", { ascending: true });

  const prescriptions = (prescriptionsData ?? []).map(p => {
    const flock = Array.isArray(p.flocks) ? p.flocks[0] : p.flocks;
    const breed = flock ? (Array.isArray(flock.breeds) ? flock.breeds[0] : flock.breeds) : null;
    const house = flock ? (Array.isArray(flock.houses) ? flock.houses[0] : flock.houses) : null;
    const farm = house ? (Array.isArray(house.farms) ? house.farms[0] : house.farms) : null;

    const days = Math.max(1, Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86_400_000) + 1);

    return {
      id: p.id,
      drug_name: p.drug_name,
      active_ingredient: p.active_ingredient,
      dose: p.dose,
      administration: p.administration,
      start_date: p.start_date,
      end_date: p.end_date,
      withdrawal_days: p.withdrawal_days ?? 0,
      indication: (p.indication as string | null) ?? (p.reason as string | null) ?? "",
      vet_name: p.vet_name_override ?? "Portal user",
      vet_license: p.vet_license,
      flock_reference: flock?.reference ?? "—",
      flock_count: flock?.initial_count ?? null,
      breed_name: breed?.name ?? "—",
      farm_name: farm?.name ?? "—",
      house_name: house?.name ?? "—",
      treatment_days: days,
    };
  });

  const drugMap = new Map<string, { activeIngredient: string | null; count: number; days: number }>();
  for (const p of prescriptions) {
    const existing = drugMap.get(p.drug_name);
    if (existing) {
      existing.count += 1;
      existing.days += p.treatment_days;
    } else {
      drugMap.set(p.drug_name, {
        activeIngredient: p.active_ingredient,
        count: 1,
        days: p.treatment_days,
      });
    }
  }
  const drugSummary = Array.from(drugMap.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.count - a.count);

  const flocksAffected = new Set(prescriptions.map(p => p.flock_reference)).size;
  const farmsAffected = new Set(prescriptions.map(p => p.farm_name)).size;
  const generatedAt = new Date().toLocaleDateString("en-AU", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const reportTitle = `${quarter.label} ${year}`;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: reportTitle },
        ]}
      />

      <style>{`
        @media print {
          aside, .topbar, .no-print { display: none !important; }
          main { display: block !important; }
          body { background: white !important; }
          .report-page { max-width: none !important; padding: 0 !important; }
          .report-card { border: none !important; box-shadow: none !important; }
        }
        @page { margin: 1.5cm; }
      `}</style>

      <div className="report-page w-full max-w-[920px] px-8 pb-14 pt-7">
        <div className="no-print mb-6 flex items-center justify-between">
          <div>
            <Link href="/reports" className="text-xs" style={{ color: "var(--text-2)" }}>
              ← All reports
            </Link>
          </div>
          <PrintButton />
        </div>

        <div className="report-card card" style={{ background: "var(--surface)" }}>
          <div className="card__body" style={{ padding: 32 }}>
            <div className="mb-6 flex items-start justify-between border-b pb-5"
                 style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start gap-3">
                <div className="relative h-10 w-10 flex-shrink-0 rounded-full"
                     style={{ background: "var(--green-900)" }}>
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full"
                        style={{ background: "var(--orange-500)" }} />
                </div>
                <div>
                  <div className="font-display text-lg font-medium leading-tight">
                    Nutriment Health Pty Ltd
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-2)" }}>
                    Bendigo, Victoria · APVMA-aligned report
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px]" style={{ color: "var(--text-3)" }}>
                Generated {generatedAt}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] font-medium uppercase tracking-widest"
                   style={{ color: "var(--text-3)" }}>
                Quarterly antimicrobial use report
              </div>
              <h1 className="m-0 font-display text-[34px] font-normal tracking-tight"
                  style={{ fontVariationSettings: "'opsz' 72" }}>
                {reportTitle}
              </h1>
              <div className="mt-1 text-[13px]" style={{ color: "var(--text-2)" }}>
                Client: <strong>{client?.name ?? "—"}</strong>
                <span style={{ color: "var(--text-3)" }}> · </span>
                Period: {start.toLocaleDateString("en-AU")} to {end.toLocaleDateString("en-AU")}
              </div>
            </div>

            <div className="mb-7 grid grid-cols-4 gap-4">
              <SummaryStat label="Prescriptions" value={prescriptions.length.toString()} />
              <SummaryStat label="Unique drugs" value={drugSummary.length.toString()} />
              <SummaryStat label="Flocks treated" value={flocksAffected.toString()} />
              <SummaryStat label="Farms involved" value={farmsAffected.toString()} />
            </div>

            <div className="mb-7">
              <h2 className="mb-3 text-[14px] font-medium">Drug summary</h2>
              {drugSummary.length === 0 ? (
                <p className="m-0 text-[13px]" style={{ color: "var(--text-2)" }}>
                  No antimicrobial use recorded in this period.
                </p>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                      <Th>Drug brand</Th>
                      <Th>Active ingredient</Th>
                      <Th align="right">Prescriptions</Th>
                      <Th align="right">Treatment days</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {drugSummary.map(d => (
                      <tr key={d.name} className="border-t" style={{ borderColor: "var(--divider)" }}>
                        <Td>{d.name}</Td>
                        <Td><span style={{ color: "var(--text-2)" }}>{d.activeIngredient ?? "—"}</span></Td>
                        <Td align="right" mono>{d.count}</Td>
                        <Td align="right" mono>{d.days}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-[14px] font-medium">Detailed records</h2>
              {prescriptions.length === 0 ? (
                <p className="m-0 text-[13px]" style={{ color: "var(--text-2)" }}>
                  No records to list.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {prescriptions.map(p => (
                    <PrescriptionDetailCard key={p.id} p={p} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 border-t pt-5 text-[11px] leading-relaxed"
                 style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
              <p className="m-0">
                This report summarises antimicrobial use as recorded in the Nutriment Portal for the period above.
                Prescribing veterinarians are listed per record. This document is intended as a draft to support
                APVMA and contractual reporting; before submission, please verify completeness and have the
                attending veterinarian sign off.
              </p>
              <p className="m-0 mt-2">
                Report ID: <code className="font-mono">{client?.slug ?? "—"}-{id}</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider"
           style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      <div className="font-display text-[26px] font-normal tracking-tight"
           style={{ fontVariationSettings: "'opsz' 60" }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-wider"
      style={{ borderColor: "var(--border)", textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({
  children, align = "left", mono,
}: {
  children: React.ReactNode; align?: "left" | "right"; mono?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 ${mono ? "font-mono" : ""}`}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}

function PrescriptionDetailCard({
  p,
}: {
  p: {
    id: string;
    drug_name: string;
    active_ingredient: string | null;
    dose: string | null;
    administration: string | null;
    start_date: string;
    end_date: string;
    withdrawal_days: number;
    indication: string;
    vet_name: string;
    vet_license: string | null;
    flock_reference: string;
    flock_count: number | null;
    breed_name: string;
    farm_name: string;
    house_name: string;
    treatment_days: number;
  };
}) {
  function fmt(d: string) {
    return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div
      className="rounded-md border p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[14px] font-medium">{p.drug_name}</div>
          <div className="text-[11px]" style={{ color: "var(--text-2)" }}>
            {p.active_ingredient ?? "—"}
          </div>
        </div>
        <div className="text-right text-[11px]" style={{ color: "var(--text-2)" }}>
          {fmt(p.start_date)} → {fmt(p.end_date)}
          <div style={{ color: "var(--text-3)" }}>
            {p.treatment_days} day{p.treatment_days === 1 ? "" : "s"} · withdrawal {p.withdrawal_days}d
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-[11px]"
           style={{ borderColor: "var(--divider)", color: "var(--text-2)" }}>
        <div>
          <div style={{ color: "var(--text-3)" }}>Flock</div>
          <div className="font-medium" style={{ color: "var(--text)" }}>
            {p.flock_reference}
          </div>
          <div>{p.breed_name}{p.flock_count ? ` · ${p.flock_count.toLocaleString()} birds` : ""}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-3)" }}>Location</div>
          <div className="font-medium" style={{ color: "var(--text)" }}>{p.farm_name}</div>
          <div>{p.house_name}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-3)" }}>Administration</div>
          <div className="font-medium" style={{ color: "var(--text)" }}>
            {p.administration ?? "—"}{p.dose ? ` · ${p.dose}` : ""}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t pt-3 text-[12px]" style={{ borderColor: "var(--divider)" }}>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          Indication
        </div>
        <div className="mt-0.5 italic" style={{ color: "var(--text)" }}>
          {p.indication || "Not recorded"}
        </div>
      </div>

      <div className="mt-3 border-t pt-2 text-[11px]"
           style={{ borderColor: "var(--divider)", color: "var(--text-3)" }}>
        Prescribed by <strong style={{ color: "var(--text-2)" }}>{p.vet_name}</strong>
        {p.vet_license && <span> · License {p.vet_license}</span>}
      </div>
    </div>
  );
}
