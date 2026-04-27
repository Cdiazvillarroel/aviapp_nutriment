import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { createPrescription } from "../actions";
import { PrescriptionFormFields } from "@/components/reports/prescription-form-fields";

export default async function NewPrescriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ flock?: string; error?: string }>;
}) {
  const params = await searchParams;
  const flockParam = params.flock;
  const error = params.error;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const { data: flocksData } = await supabase
    .from("flocks")
    .select(`
      id, reference, active,
      houses!inner(name, farms!inner(name, client_id))
    `)
    .eq("houses.farms.client_id", clientId)
    .order("active", { ascending: false })
    .order("placement_date", { ascending: false });

  const flocks = (flocksData ?? []).map(fl => {
    const house = Array.isArray(fl.houses) ? fl.houses[0] : fl.houses;
    const farm = house ? (Array.isArray(house.farms) ? house.farms[0] : house.farms) : null;
    return {
      id: fl.id,
      reference: fl.reference,
      house_name: house?.name ?? "—",
      farm_name: farm?.name ?? "—",
      active: fl.active,
    };
  });

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Record prescription" },
        ]}
      />

      <div className="w-full max-w-[820px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Record prescription</h1>
            <div className="page-header__sub">
              All fields marked * are required for APVMA-compliant records.
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeFriendlyError(error)}
          </div>
        )}

        <form action={createPrescription} className="card">
          <div className="card__body">
            <PrescriptionFormFields flocks={flocks} defaultFlockId={flockParam ?? null} />
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3"
               style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Link href="/reports" className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary">Save prescription</button>
          </div>
        </form>
      </div>
    </>
  );
}

function decodeFriendlyError(raw: string): string {
  const decoded = decodeURIComponent(raw);
  if (decoded === "flock-required") return "Please select a flock.";
  if (decoded === "drug-required") return "Drug name is required.";
  if (decoded === "start-date-required") return "Start date is required.";
  if (decoded === "end-date-required") return "End date is required.";
  if (decoded === "indication-required") return "Indication / reason is required for APVMA records.";
  return decoded;
}
