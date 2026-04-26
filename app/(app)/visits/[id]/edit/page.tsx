import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { updateVisit } from "../../actions";
import { FlockSelector } from "@/components/visits/flock-selector";

export default async function EditVisitPage({
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

  const { data: visit } = await supabase
    .from("visits")
    .select(`
      id, scheduled_at, type, notes, farm_id, status,
      farms(name),
      visit_flocks(flock_id)
    `)
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!visit) notFound();

  const farm = Array.isArray(visit.farms) ? visit.farms[0] : visit.farms;

  const { data: housesData } = await supabase
    .from("houses")
    .select(`
      name,
      flocks(id, reference, active, placement_date)
    `)
    .eq("farm_id", visit.farm_id)
    .is("archived_at", null)
    .order("name");

  const activeFlocks: { id: string; reference: string | null; house_name: string }[] = [];
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

  const currentFlockIds = (Array.isArray(visit.visit_flocks) ? visit.visit_flocks : [])
    .map(vf => vf.flock_id);

  const scheduled = new Date(visit.scheduled_at);
  const yyyy = scheduled.getFullYear();
  const mm = String(scheduled.getMonth() + 1).padStart(2, "0");
  const dd = String(scheduled.getDate()).padStart(2, "0");
  const hh = String(scheduled.getHours()).padStart(2, "0");
  const min = String(scheduled.getMinutes()).padStart(2, "0");
  const dateValue = `${yyyy}-${mm}-${dd}`;
  const timeValue = `${hh}:${min}`;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Visits", href: "/visits" },
          { label: farm?.name ?? "Visit", href: `/visits/${id}` },
          { label: "Edit" },
        ]}
      />

      <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
              <Link href={`/visits/${id}`} style={{ color: "var(--text-2)" }}>← Back to visit</Link>
            </div>
            <h1>Edit visit</h1>
            <div className="page-header__sub">{farm?.name ?? "Unknown farm"}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={updateVisit} className="card">
          <input type="hidden" name="visit_id" value={id} />

          <div className="card__body flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Date" required>
                <input className="input" type="date" name="date" required defaultValue={dateValue} />
              </Field>
              <Field label="Time">
                <input className="input" type="time" name="time" defaultValue={timeValue} />
              </Field>
            </div>

            <Field label="Visit type" required>
              <select className="select" name="type" required defaultValue={visit.type}>
                <option value="routine">Routine</option>
                <option value="sanitary">Sanitary</option>
                <option value="post_mortem">Post-mortem</option>
                <option value="audit">Audit</option>
              </select>
            </Field>

            {activeFlocks.length > 0 ? (
              <Field label="Flocks to inspect" hint="Tick the flocks you want included in this visit.">
                <FlockSelector flocks={activeFlocks} initiallySelected={currentFlockIds} />
              </Field>
            ) : (
              <div className="rounded-md border px-3 py-2 text-xs"
                   style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-2)" }}>
                This farm has no active flocks. The visit will be saved without any flocks attached.
              </div>
            )}

            <Field label="Notes">
              <textarea className="textarea" name="notes" rows={3} maxLength={500}
                        defaultValue={visit.notes ?? ""} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3"
               style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Link href={`/visits/${id}`} className="btn btn--ghost">Cancel</Link>
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
