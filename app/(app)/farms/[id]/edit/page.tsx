import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { updateFarm } from "../../actions";
import { HousesEditor, type HouseRow } from "@/components/farms/houses-editor";

export default async function EditFarmPage({
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

  const [farmRes, housesRes, regionsRes, complexesRes] = await Promise.all([
    supabase
      .from("farms")
      .select("id, name, reference_id, address, region_id, complex_id")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle(),

    supabase
      .from("houses")
      .select("id, name, custom_id, dimensions, drink_system, feed_system, housing_system, capacity")
      .eq("farm_id", id)
      .is("archived_at", null)
      .order("name"),

    supabase.from("regions").select("id, name").eq("client_id", clientId).order("name"),
    supabase.from("complexes").select("id, name").eq("client_id", clientId).order("name"),
  ]);

  if (!farmRes.data) notFound();

  const farm = farmRes.data;

  const initialHouses: HouseRow[] = (housesRes.data ?? []).map(h => ({
    id: h.id,
    name: h.name ?? "",
    custom_id: h.custom_id ?? "",
    dimensions: h.dimensions ?? "",
    drink_system: h.drink_system ?? "",
    feed_system: h.feed_system ?? "",
    housing_system: h.housing_system ?? "",
    capacity: h.capacity?.toString() ?? "",
  }));

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Farms", href: "/farms" },
          { label: farm.name, href: `/farms/${id}` },
          { label: "Edit" },
        ]}
      />

      <div className="w-full max-w-[960px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
              <Link href={`/farms/${id}`} style={{ color: "var(--text-2)" }}>← Back to farm</Link>
            </div>
            <h1>Edit farm</h1>
            <div className="page-header__sub">{farm.name}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeFriendlyError(error)}
          </div>
        )}

        <form action={updateFarm} className="card">
          <input type="hidden" name="farm_id" value={id} />

          <div className="card__body flex flex-col gap-4">
            <Field label="Name" required>
              <input className="input" name="name" required maxLength={120} defaultValue={farm.name} />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Reference ID">
                <input className="input" name="reference_id" maxLength={40} defaultValue={farm.reference_id ?? ""} />
              </Field>
              <Field label="Address">
                <input className="input" name="address" maxLength={240} defaultValue={farm.address ?? ""} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Region">
                <select className="select" name="region_id" defaultValue={farm.region_id ?? ""}>
                  <option value="">— None —</option>
                  {(regionsRes.data ?? []).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Complex">
                <select className="select" name="complex_id" defaultValue={farm.complex_id ?? ""}>
                  <option value="">— None —</option>
                  {(complexesRes.data ?? []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-2)" }}>
                Houses
              </div>
              <HousesEditor initial={initialHouses} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3"
               style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Link href={`/farms/${id}`} className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary">Save changes</button>
          </div>
        </form>
      </div>
    </>
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

function decodeFriendlyError(raw: string): string {
  const decoded = decodeURIComponent(raw);
  if (decoded === "name-required") return "Name is required.";
  return decoded;
}
