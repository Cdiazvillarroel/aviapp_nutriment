import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { createFarm } from "../actions";
import { HousesEditor } from "@/components/farms/houses-editor";

export default async function NewFarmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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

  const [regionsRes, complexesRes] = await Promise.all([
    supabase.from("regions").select("id, name").eq("client_id", clientId).order("name"),
    supabase.from("complexes").select("id, name").eq("client_id", clientId).order("name"),
  ]);

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Farms", href: "/farms" },
          { label: "New farm" },
        ]}
      />

      <div className="w-full max-w-[960px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Add a farm</h1>
            <div className="page-header__sub">Set up the farm and its houses. Flocks are added separately as they cycle through.</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeFriendlyError(error)}
          </div>
        )}

        <form action={createFarm} className="card">
          <div className="card__body flex flex-col gap-4">
            <Field label="Name" required hint="The name technicians will see in the field. e.g. Forest Edge.">
              <input className="input" name="name" required maxLength={120} autoFocus />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Reference ID" hint="Optional internal code. e.g. FE-001.">
                <input className="input" name="reference_id" maxLength={40} />
              </Field>
              <Field label="Address">
                <input className="input" name="address" maxLength={240} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Region">
                <select className="select" name="region_id" defaultValue="">
                  <option value="">— None —</option>
                  {(regionsRes.data ?? []).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Complex">
                <select className="select" name="complex_id" defaultValue="">
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
              <HousesEditor />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3"
               style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Link href="/farms" className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary">Create farm</button>
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
