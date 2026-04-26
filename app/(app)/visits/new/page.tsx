import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { createVisit } from "../actions";
import { FlockSelector } from "@/components/visits/flock-selector";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ farm?: string; error?: string }>;
}) {
  const { farm: preselectedFarmId, error } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;

  const farmsRes = await supabase
    .from("farms")
    .select("id, name, regions(name)")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("name");

  const activeFlocks: { id: string; reference: string | null; house_name: string }[] = [];
  if (preselectedFarmId) {
    const { data: housesData } = await supabase
      .from("houses")
      .select(`
        name,
        flocks(id, reference, active, placement_date)
      `)
      .eq("farm_id", preselectedFarmId)
      .is("archived_at", null)
      .order("name");

    for (const h of housesData ?? []) {
      const flocks = Array.isArray(h.flocks) ? h.flocks : [];
      for (const fl of flocks) {
        if (fl.active) {
          activeFlocks.push({
            id: fl.id,
            reference: fl.reference,
            house_name: h.name,
          });
        }
      }
    }
  }

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);

  const farms = farmsRes.data ?? [];

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Visits", href: "/visits" },
          { label: "Schedule visit" },
        ]}
      />

      <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Schedule a visit</h1>
            <div className="page-header__sub">Pick the farm, the date, and the flocks you intend to score.</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeFriendlyError(error)}
          </div>
        )}

        <form action={createVisit} className="card">
          <div className="card__body flex flex-col gap-4">
            <Field label="Farm" required>
              <select className="select" name="farm_id" required defaultValue={preselectedFarmId ?? ""}>
                <option value="">— Select farm —</option>
                {farms.map(f => {
                  const region = Array.isArray(f.regions) ? f.regions[0] : f.regions;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.name}{region?.name ? ` — ${region.name}` : ""}
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Date" required>
                <input className="input" type="date" name="date" required defaultValue={defaultDate} />
              </Field>
              <Field label="Time" hint="24h format. Defaults to 09:00.">
                <input className="input" type="time" name="time" defaultValue="09:00" />
              </Field>
            </div>

            <Field label="Visit type" required>
              <select className="select" name="type" required defaultValue="routine">
                <option value="routine">Routine</option>
                <option value="sanitary">Sanitary</option>
                <option value="post_mortem">Post-mortem</option>
                <option value="audit">Audit</option>
              </select>
            </Field>

            {preselectedFarmId && activeFlocks.length > 0 && (
              <Field label="Flocks to inspect" hint="Pick one or more. You can also leave empty and choose during the visit.">
                <FlockSelector flocks={activeFlocks} />
              </Field>
            )}

            {preselectedFarmId && activeFlocks.length === 0 && (
              <div className="rounded-md border px-3 py-2 text-xs"
                   style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-2)" }}>
                This farm has no active flocks. The visit will still be scheduled but no scoring sheets will be prepared.
              </div>
            )}

            {!preselectedFarmId && (
              <div className="text-xs" style={{ color: "var(--text-3)" }}>
                Pick a farm above to choose specific flocks. You can also assign flocks later when starting the visit.
              </div>
            )}

            <Field label="Notes" hint="Optional context for the technician.">
              <textarea className="textarea" name="notes" rows={3} maxLength={500} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3"
               style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Link href="/visits" className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary">Schedule visit</button>
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
  if (decoded === "farm-required") return "Please select a farm.";
  if (decoded === "date-required") return "Please pick a date.";
  return decoded;
}
