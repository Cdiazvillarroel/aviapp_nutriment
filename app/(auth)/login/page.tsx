import { signIn, signInWithGoogle } from "./actions";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[1fr_480px]">
      {/* ----- Brand panel ----- */}
      <aside className="relative hidden flex-col overflow-hidden p-14 text-text-inv md:flex"
             style={{ background: "var(--green-900)" }}>
        <div className="pointer-events-none absolute inset-0"
             style={{
               background:
                 "radial-gradient(ellipse 600px 400px at 80% 20%, rgba(226,125,46,0.08), transparent 60%)," +
                 "radial-gradient(ellipse 800px 600px at 20% 90%, rgba(74,138,100,0.12), transparent 60%)",
             }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-full" style={{ background: "var(--surface)" }}>
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full"
                  style={{ background: "var(--orange-500)" }} />
          </div>
          <div className="font-display text-lg font-medium leading-tight">
            Nutriment
            <span className="block text-[10px] uppercase tracking-[0.16em] opacity-60">Health</span>
          </div>
        </div>

        <div className="relative z-10 mt-auto">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em]"
               style={{ color: "var(--orange-500)" }}>
            Field operations portal
          </div>
          <h2 className="m-0 max-w-[480px] font-display text-[32px] font-normal leading-[1.25] tracking-tight"
              style={{ fontVariationSettings: "'opsz' 96" }}>
            Built for poultry health teams who&apos;d rather be in the{" "}
            <em className="not-italic" style={{ color: "var(--orange-500)" }}>shed</em> than in spreadsheets.
          </h2>
          <div className="mt-7 border-t pt-4 text-xs leading-relaxed opacity-60"
               style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            Australian-licensed feed additives · APVMA-aligned reporting · designed for VIC broiler operations.
            <br />Nutriment Health Pty Ltd · Bendigo, Victoria
          </div>
        </div>
      </aside>

      {/* ----- Form panel ----- */}
      <main className="flex flex-col justify-center bg-surface p-8 md:p-14">
        <div className="mb-8">
          <h1 className="m-0 font-display text-[28px] font-normal tracking-tight"
              style={{ fontVariationSettings: "'opsz' 60" }}>
            Welcome back
          </h1>
          <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-2)" }}>
            Sign in to continue to your client workspace.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border px-3 py-2 text-xs"
               style={{ background: "var(--bad-bg)", borderColor: "var(--bad-bg)", color: "var(--bad)" }}>
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-2)" }}>
              Work email
            </span>
            <input className="input" name="email" type="email" required
                   placeholder="diaz@nutriment.com.au" autoComplete="email" />
          </label>

          <label className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-2)" }}>Password</span>
              <Link href="#" className="text-[11px] font-medium" style={{ color: "var(--green-700)" }}>
                Forgot password?
              </Link>
            </div>
            <input className="input" name="password" type="password" required
                   autoComplete="current-password" />
          </label>

          <button type="submit"
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md py-3 text-sm font-medium text-text-inv transition-colors hover:opacity-95"
                  style={{ background: "var(--green-800)" }}>
            Sign in →
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider"
             style={{ color: "var(--text-3)" }}>
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          or continue with
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        <form action={signInWithGoogle}>
          <button type="submit" className="btn w-full justify-center py-2.5">
            Continue with Google Workspace
          </button>
        </form>

        <div className="mt-10 flex items-center justify-between border-t pt-6 text-[11px]"
             style={{ borderColor: "var(--divider)", color: "var(--text-3)" }}>
          <span>v0.1.0 · Nutriment Portal</span>
          <span className="space-x-2">
            <Link href="#">Privacy</Link>·<Link href="#">Terms</Link>
          </span>
        </div>
      </main>
    </div>
  );
}
