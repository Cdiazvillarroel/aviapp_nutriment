import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isMobileUserAgent(ua: string): boolean {
  if (!ua) return false;
  // Detect iPad, iPhone, Android phones/tablets
  // Note: iPad on iOS 13+ reports as Mac in user agent — we check for touch/mobile hints too
  return /iPad|iPhone|iPod|Android/i.test(ua) ||
    (/Macintosh/i.test(ua) && /Mobile|Touch/i.test(ua));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Mobile redirect: detect iPad/iPhone/Android landing on /dashboard → push to /scoring/mobile
  // Skip if user manually navigated by passing ?desktop=1
  if (user && path === "/dashboard") {
    const ua = request.headers.get("user-agent") ?? "";
    const wantsDesktop = request.nextUrl.searchParams.get("desktop") === "1";
    if (!wantsDesktop && isMobileUserAgent(ua)) {
      const url = request.nextUrl.clone();
      url.pathname = "/scoring/mobile";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
