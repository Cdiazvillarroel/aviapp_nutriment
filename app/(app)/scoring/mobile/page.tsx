import { createClient } from "@/lib/supabase/server";
import { MobileHome, type VisitListItem } from "@/components/scoring/mobile/mobile-home";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? "";
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? userEmail.split("@")[0];

  const { data: membership } = await supabase
    .from("client_members")
    .select("client_id, clients(name)")
    .eq("user_id", user!.id)
    .limit(1)
    .single();

  const clientId = membership!.client_id;
  const clientName = (Array.isArray(membership!.clients) ? membership!.clients[0]?.name : (membership!.clients as any)?.name) ?? "—";

  // Compute date ranges
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  const startOfWeek = new Date(now);
  const dayOfWeek = startOfWeek.getDay(); // 0 sunday, 1 monday, ...
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  // Fetch all relevant visits
  const { data: visits } = await supabase
    .from("visits")
    .select(`
      id, scheduled_at, status, type, bird_count,
      farms(name),
      visit_flocks(flocks(reference, placement_date))
    `)
    .eq("client_id", clientId)
    .or(`status.eq.in_progress,status.eq.planned,and(scheduled_at.gte.${startOfToday.toISOString()},scheduled_at.lte.${endOfWeek.toISOString()})`)
    .order("scheduled_at", { ascending: true });

  // Categorize
  const today: VisitListItem[] = [];
  const thisWeek: VisitListItem[] = [];
  const active: VisitListItem[] = [];

  for (const v of visits ?? []) {
    const farm = Array.isArray(v.farms) ? v.farms[0] : v.farms;
    const visitDate = new Date(v.scheduled_at);
    const flockData = Array.isArray(v.visit_flocks) ? v.visit_flocks : [];
    const firstFlock = flockData[0]?.flocks;
    const flock = Array.isArray(firstFlock) ? firstFlock[0] : firstFlock;

    const ageDays = flock ? Math.round((Date.now() - new Date(flock.placement_date).getTime()) / 86_400_000) : null;

    const item: VisitListItem = {
      id: v.id,
      farmName: farm?.name ?? "Unknown",
      flockRef: flock?.reference ?? null,
      scheduledAt: v.scheduled_at,
      status: v.status as "planned" | "in_progress" | "completed",
      type: v.type as string,
      ageDays,
    };

    if (v.status === "in_progress") {
      active.push(item);
    } else if (v.status === "planned") {
      if (visitDate >= startOfToday && visitDate <= endOfToday) {
        today.push(item);
      } else if (visitDate >= startOfWeek && visitDate <= endOfWeek) {
        thisWeek.push(item);
      }
    }
  }

  return (
    <MobileHome
      userName={userName}
      clientName={clientName}
      today={today}
      thisWeek={thisWeek}
      active={active}
    />
  );
}
