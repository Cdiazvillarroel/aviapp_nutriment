import { redirect } from "next/navigation";

export default function Home() {
  // The middleware already redirects unauthenticated users to /login,
  // so we just send everyone to /dashboard from here.
  redirect("/dashboard");
}
