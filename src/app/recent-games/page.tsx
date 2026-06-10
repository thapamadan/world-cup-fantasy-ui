"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { PredictionModal } from "@/components/PredictionModal";
import { TeamFlag } from "@/components/TeamFlag";
import { fetchMatches, fetchMe, getApiErrorMessage } from "@/lib/api";
import { clearActiveGroup, clearSession, getSession, setSession } from "@/lib/auth";
import type { Match } from "@/lib/types";

const DEFAULT_REFRESH_INTERVAL_MS = 8_000;
const LIVE_REFRESH_INTERVAL_MS = 5_000;

export default function RecentGamesPage() {
  const router = useRouter();
  const [active, setActive] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;

    const scheduleRefresh = (matches: Match[]) => {
      if (cancelled) {
        return;
      }

      const refreshInterval = matches.some((match) => match.status === "live") ? LIVE_REFRESH_INTERVAL_MS : DEFAULT_REFRESH_INTERVAL_MS;
      refreshTimer = window.setTimeout(() => {
        loadMatches().catch((err) => {
          if (!cancelled) {
            clearSession();
            clearActiveGroup();
            setError(getApiErrorMessage(err));
            router.push("/");
          }
        });
      }, refreshInterval);
    };

    const loadMatches = async () => {
      if (!getSession()) {
        const me = await fetchMe();
        if (cancelled) return;
        setSession({ token: "cookie-session", user: me.user });
      }

      const response = await fetchMatches();
      if (!cancelled) {
        setMatches(response.matches);
        setError("");
        scheduleRefresh(response.matches);
      }
    };

    loadMatches().catch((err) => {
      if (!cancelled) {
        clearSession();
        clearActiveGroup();
        setError(getApiErrorMessage(err));
        router.push("/");
      }
    });

    return () => {
      cancelled = true;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [router]);

  const finishedMatches = useMemo(() => [...matches].filter((match) => match.status === "finished").sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt)), [matches]);

  const handlePredictionSaved = (matchId: string, home: number, away: number, winner: "home" | "away" | "draw" | null) => {
    setMatches((current) => current.map((match) => (match.id === matchId ? { ...match, predicted: winner ? { home, away, winner } : { home, away } } : match)));
    setActive(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-8">
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <h1 className="text-3xl font-semibold tracking-tight">Recent games</h1>
          <p className="mt-1 text-sm text-muted-foreground">Finished matches sorted by latest first.</p>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </header>

        {finishedMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No finished games yet.</div>
        ) : (
          <div className="space-y-3">
            {finishedMatches.map((match) => (
              <button key={match.id} type="button" onClick={() => setActive(match)} className="w-full rounded-3xl border border-border bg-card p-5 text-left shadow-card transition hover:border-ring/30">
                <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-semibold">
                    <div className="flex items-center justify-end gap-2"><span>{match.home}</span><TeamFlag team={match.home} fallback={match.homeFlag} className="h-5 w-7 rounded-sm object-cover" /></div>
                    <div className="text-center"><div className="text-4xl font-semibold tabular-nums">{match.result?.home} - {match.result?.away}</div><div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final</div></div>
                    <div className="flex items-center gap-2"><TeamFlag team={match.away} fallback={match.awayFlag} className="h-5 w-7 rounded-sm object-cover" /><span>{match.away}</span></div>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <div className="text-xs text-muted-foreground">{match.date} · {match.kickoff}</div>
                    {match.predicted ? <div className="inline-flex items-center gap-1.5 rounded-xl border border-success/20 bg-success/10 px-4 py-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Predicted score {match.predicted.home}-{match.predicted.away}</div> : <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">Not predicted</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
      {active && <PredictionModal match={active} onClose={() => setActive(null)} onSaved={handlePredictionSaved} />}
    </div>
  );
}
