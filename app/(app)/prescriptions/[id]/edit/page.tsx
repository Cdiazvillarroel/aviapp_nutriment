import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { updatePrescription } from "../../actions";
import { PrescriptionFormFields } from "@/components/reports/prescription-form-fields";

export default async function EditPrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const [prescriptionRes, flocksRes] = await Promise.all([
    supabase
      .from("prescriptions")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle(),

    supabase
      .from("flocks")
      .select(`
        id, reference, active,
        houses!inner(name, farms!inner(name, client_id))
      `)
      .eq("houses.farms.client_id", clientId)
      .order("active", { ascending: false })
      .order("placement_date", { ascending: false }),
  ]);

  if (!prescriptionRes.data) notFound();
  const presc = prescriptionRes.data;

  const flocks = (flocksRes.data ?? []).map(fl => {
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
          { label: "Edit prescription" },
        ]}
      />

      <div className="w-full max-w-[820px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Edit prescription</h1>
            <div className="page-header__sub">{presc.drug_name}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={updatePrescription} className="card">
          <input type="hidden" name="id" value={id} />
          <div className="card__body">
            <PrescriptionFormFields
              flocks={flocks}
              defaultFlockId={presc.flock_id}
              defaults={{
                drug_name: presc.drug_name,
                active_ingredient: presc.active_ingredient ?? "",
                dose: presc.dose ?? "",
                administration: presc.administration ?? "",
                start_date: presc.start_date,
                end_date: presc.end_date,
                withdrawal_days: presc.withdrawal_days ?? 0,
                indication: presc.indication ?? presc.reason ?? "",
                vet_name_override: presc.vet_name_override ?? "",
                vet_license: presc.vet_license ?? "",
              }}
            />
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3"
               style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Link href="/reports" className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary">Save changes</button>
          </div>
        </form>
      </div>
    </>
  );
}
