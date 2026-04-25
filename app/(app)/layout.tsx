import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the user's primary client membership.
  const { data: memberships } = await supabase
    .from("client_members")
    .select("role, display_name, clients(id, name, slug)")
    .eq("user_id", user.id);

  const membership = memberships?.[0];
  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm text-text-2">
        Your account isn&apos;t linked to a client yet. Ask an admin to add you to{" "}
        <code className="font-mono">client_members</code>.
      </div>
    );
  }

  // The Supabase nested select can return either an object or an array depending
  // on the relationship; coerce to a single object for our needs.
  const client = Array.isArray(membership.clients)
    ? membership.clients[0]
    : membership.clients;

  if (!client) redirect("/login");

  // Count today's visits for this client (for the sidebar badge).
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);

  const { count: todayVisitCount } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .eq("client_id", client.id)
    .gte("scheduled_at", startOfDay.toISOString())
    .lte("scheduled_at", endOfDay.toISOString());

  const userName =
    membership.display_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "User";

  return (
    <div className="grid min-h-screen" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Sidebar
        userName={userName}
        userRole={membership.role.toUpperCase()}
        clientName={client.name}
        todayVisitCount={todayVisitCount ?? 0}
      />
      <main className="flex min-w-0 flex-col">{children}</main>
    </div>
  );
}
