import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/ui/topbar";
import { fetchFarmsForMap } from "@/lib/map-queries";
import { MapClientWrapper } from "@/components/map/map-client-wrapper";

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const farms = await fetchFarmsForMap(membership!.client_id);

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Map" },
        ]}
      />
      <MapClientWrapper farms={farms} />
    </>
  );
}
