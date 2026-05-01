"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import {
  useOnlineStatus,
  usePendingMutations,
  emitPendingChanged,
} from "@/lib/offline/use-online-status";
import { syncPendingMutations } from "@/lib/offline/sync";

export interface VisitListItem {
  id: string;
  farmName: string;
  flockRef: string | null;
  scheduledAt: string;
  status: "planned" | "in_progress" | "completed";
  type: string;
  ageDays: number | null;
}

interface Props {
  userName: string;
  clientName: string;
  today: VisitListItem[];
  thisWeek: VisitListItem[];
  active: VisitListItem[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", { weekday: "long" });
}

function VisitCard({ visit }: { visit: VisitListItem }) {
  const isInProgress = visit.status === "in_progress";

  return (
    <Link
      href={`/scoring/mobile/${visit.id}`}
      className="flex items-center gap-3 border-b px-4 py-4 last:border-b-0 active:bg-surface-2"
      style={{ background: "var(--surface)", borderColor: "var(--divider)" }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: isInProgress ? "var(--orange-50)" : "var(--green-50)",
          color: isInProgress ? "var(--orange-500)" : "var(--green-700)",
        }}
      >
        <span style={{ fontSize: "16px" }}>{isInProgress ? "▶" : "→"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium leading-tight"
             style={{ color: "var(--text-1)" }}>
          {visit.farmName}
          {visit.flockRef && (
            <span className="ml-1.5 font-mono text-[12px] font-normal"
                  style={{ color: "var(--text-3)" }}>
              {visit.flockRef}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px]"
             style={{ color: "var(--text-3)" }}>
          {visit.ageDays !== null && (
            <>
              <span>Day {visit.ageDays}</span>
              <span>·</span>
            </>
          )}
          {visit.status === "planned" && (
            <>
              <span>{formatTime(visit.scheduledAt)}</span>
              <span>·</span>
              <span>{formatDay(visit.scheduledAt)}</span>
            </>
          )}
          {visit.status === "in_progress" && (
            <span style={{ color: "var(--orange-500)" }}>In progress</span>
          )}
        </div>
      </div>
      <span style={{ color: "var(--text-3)", fontSize: "20px" }}>›</span>
    </Link>
  );
}

function Section({
  label, visits, emptyText,
}: { label: string; visits: VisitListItem[]; emptyText?: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.14em]"
           style={{ color: "var(--text-3)" }}>
        {label} {visits.length > 0 && `(${visits.length})`}
      </div>
      {visits.length === 0 ? (
        <div className="px-4 py-3 text-[13px]" style={{ color: "var(--text-3)" }}>
          {emptyText ?? "Nothing scheduled."}
        </div>
      ) : (
        <div className="border-y"
             style={{ background: "var(--surface)", borderColor: "var(--divider)" }}>
          {visits.map((v) => <VisitCard key={v.id} visit={v} />)}
        </div>
      )}
    </div>
  );
}

// Sync banner - shown when there are pending changes
function SyncBanner() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingMutations();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastResult, setLastResult] = useState<{ ok: number; failed: number } | null>(null);

  if (pendingCount === 0 && !lastResult) return null;

  async function handleSync() {
    if (!isOnline) {
      alert("Connect to WiFi or mobile data to sync.");
      return;
    }
    setSyncing(true);
    setProgress({ current: 0, total: pendingCount });
    try {
      const result = await syncPendingMutations((current, total) => {
        setProgress({ current, total });
      });
      setLastResult({ ok: result.succeeded, failed: result.failed });
      emitPendingChanged();
      // Auto-clear "all synced" message after 3s
      if (result.failed === 0) {
        setTimeout(() => setLastResult(null), 3000);
      }
      // Refresh page data to show fresh server state
      router.refresh();
    } catch (e: any) {
      alert(`Sync failed: ${e?.message ?? "unknown"}`);
    } finally {
      setSyncing(false);
    }
  }

  // After successful sync, show success briefly
  if (lastResult && pendingCount === 0) {
    return (
      <div className="mx-4 mb-4 rounded-lg border px-4 py-3"
           style={{
             background: lastResult.failed > 0 ? "var(--bad-bg)" : "var(--green-50)",
             borderColor: lastResult.failed > 0 ? "var(--bad)" : "var(--green-700)",
           }}>
        <div className="text-[13px] font-medium"
             style={{ color: lastResult.failed > 0 ? "var(--bad)" : "var(--green-700)" }}>
          {lastResult.failed > 0
            ? `Synced ${lastResult.ok}, ${lastResult.failed} failed`
            : `✓ All synced (${lastResult.ok} changes)`}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 rounded-lg border px-4 py-3"
         style={{
           background: isOnline ? "var(--orange-50)" : "var(--surface-2)",
           borderColor: isOnline ? "var(--orange-500)" : "var(--border)",
         }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium"
               style={{ color: "var(--text-1)" }}>
            {syncing
              ? `Syncing... ${progress.current}/${progress.total}`
              : `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending`}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-2)" }}>
            {!isOnline
              ? "Offline. Connect to sync."
              : syncing
              ? "Sending to server..."
              : "Tap Sync now to send changes to the server."}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={!isOnline || syncing}
          className="flex-shrink-0 rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
          style={{
            background: isOnline && !syncing ? "var(--green-700)" : "var(--surface-2)",
            color: isOnline && !syncing ? "#fff" : "var(--text-3)",
            opacity: !isOnline || syncing ? 0.6 : 1,
          }}
        >
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      </div>
    </div>
  );
}

export function MobileHome(props: Props) {
  const isOnline = useOnlineStatus();
  const todayLabel = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="min-h-screen pb-20" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="border-b px-5 py-4"
              style={{ background: "var(--green-900)", borderColor: "transparent" }}>
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 flex-shrink-0">
            <img src="/logo.png" alt="Nutriflock" className="h-9 w-9 object-contain" />
          </div>
          <div className="font-display text-[15px] font-medium leading-tight"
               style={{ color: "#ffffff" }}>
            Nutriflock
            <span className="block text-[8px] uppercase tracking-[0.16em] opacity-65 font-normal mt-0.5">
              Poultry Health Monitor
            </span>
          </div>
          {!isOnline && (
            <span className="ml-auto text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--orange-500)" }}>
              ● Offline
            </span>
          )}
        </div>
      </header>

      {/* Welcome */}
      <div className="px-5 py-5">
        <div className="text-[20px] font-medium leading-tight"
             style={{ color: "var(--text-1)" }}>
          Hi {props.userName}
        </div>
        <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>
          {todayLabel} · {props.clientName}
        </div>
      </div>

      <SyncBanner />

      {props.active.length > 0 && (
        <Section label="In progress" visits={props.active} />
      )}
      <Section label="Today" visits={props.today}
               emptyText="No visits scheduled for today." />
      <Section label="This week" visits={props.thisWeek}
               emptyText="No upcoming visits this week." />

      {/* Footer */}
      <div className="mx-5 mt-8 flex flex-col items-center gap-3 border-t pt-6 text-[12px]"
           style={{ borderColor: "var(--divider)", color: "var(--text-3)" }}>
        <Link href="/dashboard?desktop=1" className="text-[13px] font-medium"
              style={{ color: "var(--green-700)" }}>
          Use desktop version →
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-[13px]"
                  style={{ color: "var(--text-3)" }}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
