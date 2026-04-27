import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { HousesEditor } from "@/components/farms/houses-editor";
import { ContactsEditor } from "@/components/farms/contacts-editor";
import { FarmFormClient } from "@/components/farms/farm-form-client";
import { updateFarm } from "@/app/(app)/farms/actions";

export default async function EditFarmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const [farmRes, housesRes, contactsRes] = await Promise.all([
    supabase
      .from("farms")
      .select("id, name, address, region, latitude, longitude")
      .eq("id", id)
      .eq("client_id", membership!.client_id)
      .maybeSingle(),
    supabase
      .from("houses")
      .select("id, name, custom_id, length_m, width_m, drink_system, feed_system, housing_system, capacity, archived_at")
      .eq("farm_id", id)
      .order("created_at"),
    supabase
      .from("farm_contacts")
      .select("id, role, name, phone, email, notes")
      .eq("farm_id", id)
      .order("display_order"),
  ]);

  if (!farmRes.data) notFound();

  const farm = farmRes.data;
  const housesInitial = (housesRes.data ?? []).map(function (h) {
    return {
      id: h.id,
      name: h.name,
      custom_id: h.custom_id ?? "",
      length_m: h.length_m,
      width_m: h.width_m,
      drink_system: h.drink_system,
      feed_system: h.feed_system,
      housing_system: h.housing_system,
      capacity: h.capacity,
      archived: h.archived_at !== null,
    };
  });
  const contactsInitial = (contactsRes.data ?? []).map(function (c) {
    return {
      id: c.id,
      role: c.role ?? "",
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
      archived: false,
    };
  });

  async function action(formData: FormData) {
    "use server";
    return updateFarm(id, formData);
  }

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Farms", href: "/farms" },
          { label: farm.name, href: `/farms/${farm.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="w-full max-w-[920px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>Edit farm</h1>
            <div className="page-header__sub">{farm.name}</div>
          </div>
          <Link href={`/farms/${farm.id}`} className="btn">Cancel</Link>
        </div>

        <form action={action} className="space-y-6">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Details</h2>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider"
                       style={{ color: "var(--text-3)" }}>
                    Name <span style={{ color: "var(--bad)" }}>*</span>
                  </div>
                  <input
                    name="name"
                    defaultValue={farm.name}
                    required
                    className="input w-full"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider"
                       style={{ color: "var(--text-3)" }}>
                    Region
                  </div>
                  <input
                    name="region"
                    defaultValue={farm.region ?? ""}
                    className="input w-full"
                    placeholder="Bendigo, VIC"
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider"
                       style={{ color: "var(--text-3)" }}>
                    Address
                  </div>
                  <input
                    name="address"
                    defaultValue={farm.address ?? ""}
                    className="input w-full"
                    placeholder="Street, suburb"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Location</h2>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                Click on the map to set the pin
              </span>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <FarmFormClient
                initialLat={farm.latitude}
                initialLng={farm.longitude}
              />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Houses (sheds)</h2>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <HousesEditor initial={housesInitial} />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Contacts</h2>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                People associated with this farm
              </span>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <ContactsEditor initial={contactsInitial} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link href={`/farms/${farm.id}`} className="btn">Cancel</Link>
            <button type="submit" className="btn btn--primary">Save changes</button>
          </div>
        </form>
      </div>
    </>
  );
}
