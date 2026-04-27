import Link from "next/link";
import { Topbar } from "@/components/ui/topbar";
import { HousesEditor } from "@/components/farms/houses-editor";
import { ContactsEditor } from "@/components/farms/contacts-editor";
import { FarmFormClient } from "@/components/farms/farm-form-client";
import { createFarm } from "@/app/(app)/farms/actions";

export default function NewFarmPage() {
  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Farms", href: "/farms" },
          { label: "New" },
        ]}
      />
      <div className="w-full max-w-[920px] px-8 pb-14 pt-7">
        <div className="page-header">
          <div>
            <h1>New farm</h1>
            <div className="page-header__sub">
              Set the basic details, drop a pin on the map, add houses and contacts.
            </div>
          </div>
          <Link href="/farms" className="btn">Cancel</Link>
        </div>

        <form action={createFarm} className="space-y-6">
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
                  <input name="name" required className="input w-full" placeholder="Hazeldenes Farm" />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider"
                       style={{ color: "var(--text-3)" }}>
                    Region
                  </div>
                  <input name="region" className="input w-full" placeholder="Bendigo, VIC" />
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider"
                       style={{ color: "var(--text-3)" }}>
                    Address
                  </div>
                  <input name="address" className="input w-full" placeholder="Street, suburb" />
                </label>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Location</h2>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                Click on the map to drop a pin
              </span>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <FarmFormClient initialLat={null} initialLng={null} />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Houses (sheds)</h2>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <HousesEditor initial={[]} />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title text-[13px] font-medium">Contacts</h2>
            </div>
            <div className="card__body" style={{ padding: 20 }}>
              <ContactsEditor initial={[]} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/farms" className="btn">Cancel</Link>
            <button type="submit" className="btn btn--primary">Create farm</button>
          </div>
        </form>
      </div>
    </>
  );
}
