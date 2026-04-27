import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { placeFlock } from "../actions";
import { HouseSelector } from "@/components/flocks/house-selector";

export default async function NewFlockPage({
  searchParams,
}: {
  searchParams: Promise<{ farm?: string; house?: string; error?: string }>;
}) {
  const params = await searchParams;
  const preselectedFarm = params.farm;
  const preselectedHouse = params.house;
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

  const [farmsRes, breedsRes] = await Promise.all([
    supabase
      .from("farms")
      .select(`
        id, name,
        houses(
          id, name, archived_at,
          flocks(id, reference, active)
        )
      `)
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("name"),

    supabase
      .from("breeds")
      .select("id, name")
      .eq("client_id", clientId)
      .order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const defaultClearout = new Date();
  defaultClearout.setDate(defaultClearout.getDate() + 42);
  const expectedClearoutDefault = defaultClearout.toISOString().slice(0, 10);

  const farmsForSelector = (farmsRes.data ?? []).map(f => {
    const houses = Array.isArray(f.houses) ? f.houses : [];
    return {
      id: f.id,
      name: f.name,
      houses: houses
        .filter(h => h.archived_at === null)
        .map(h => {
          const flocks = Array.isArray(h.flocks) ? h.flocks : [];
          const activeFlock = flocks.find(fl => fl.active);
          return {
            id: h.id,
            name: h.name,
            currentFlockReference: activeFlock?.reference ?? null,
            occupied: !!activeFlock,
          };
        }),
    };
  });

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Flocks", href: "/flocks" },
          { label: "Place flock" },
        ]}
      />

      <div className="w-full max-w-[720px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Place a new flock</h1>
            <div className="page-header__sub">
              Choose an empty house and record the placement details.
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeFriendlyError(error)}
          </div>
        )}

        <form action={placeFlock} className="card">
          {preselectedFarm && <input type="hidden" name="farm_id" value={preselectedFarm} />}

          <div className="card__body flex flex-col gap-4">
            <Field label="House" required hint="Houses with a flock already placed are disabled.">
              <HouseSelector
                farms={farmsForSelector}
                preselectedHouseId={preselectedHouse}
                preselectedFarmId={preselectedFarm}
              />
            </Field>

            <Field label="Flock reference" hint="Optional. Common patterns: #24-04, F2024-12.">
              <input className="input" name="reference" maxLength={40} placeholder="#24-04" />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Breed">
                <select className="select" name="breed_id" defaultValue="">
                  <option value="">— None —</option>
                  {(breedsRes.data ?? []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Initial bird count">
                <input
                  className="input"
                  type="number"
                  name="initial_count"
                  min={0}
                  step={100}
                  placeholder="24000"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Placement date" required>
                <input className="input" type="date" name="placement_date" required defaultValue={today} />
              </Field>
              <Field label="Expected clearout" hint="Defaults to placement + 42 days.">
                <input
                  className="input"
                  type="date"
                  name="expected_clearout"
                  defaultValue={expectedClearoutDefault}
                />
              </Field>
            </div>
          </div>

          <div
            className="flex justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <Link href="/flocks" className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary">Place flock</button>
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
  if (decoded === "house-required") return "Please select a house.";
  if (decoded === "date-required") return "Please pick a placement date.";
  return decoded;
}
