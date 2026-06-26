"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { PredictionModal } from "@/components/PredictionModal";
import { TeamFlag } from "@/components/TeamFlag";
import { getSession } from "@/lib/auth";
import { fetchMyPredictions, getApiErrorMessage } from "@/lib/api";
import { fetchMatchesFromProxy, getDirectMatchesErrorMessage } from "@/lib/football-data";
import { MY_PREDICTIONS_CACHE_KEY } from "@/lib/predictions-cache";
import type { Match, MemberPrediction } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getMatchStatusPriority(match: Match) {
  if (match.status === "upcoming") return 0;
  if (match.status === "live") return 1;
  return 2;
}

function sortVisibleMatches(matches: Match[]) {
  return [...matches]
    .filter((match) => match.status !== "finished")
    .sort((a, b) => {
      const statusDiff = getMatchStatusPriority(a) - getMatchStatusPriority(b);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt);
    });
}

function mergePredictionsWithMatches(matches: Match[], predictions: MemberPrediction[]) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));

  return matches.map((match) => {
    const prediction = predictionMap.get(match.id);
    if (!prediction) {
      return match;
    }

    return {
      ...match,
      predicted: prediction.predicted,
      pointsEarned: prediction.pointsEarned,
      submitted: true,
    };
  });
}

export function MatchesPageClient({
  initialMatches,
  initialError,
}: {
  initialMatches: Match[];
  initialError?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Match | null>(null);
  const today = getTodayIsoDate();

  const { data: matchesData, error: matchesError } = useSWR(
    `football-data-world-cup-matches:${today}`,
    () => fetchMatchesFromProxy({ dateFrom: today }),
    {
      fallbackData: { matches: initialMatches },
      revalidateOnFocus: false,
    },
  );

  const {
    data: predictionsData,
    error: predictionsError,
    mutate: mutatePredictions,
  } = useSWR(MY_PREDICTIONS_CACHE_KEY, fetchMyPredictions, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  const matches = useMemo(
    () =>
      mergePredictionsWithMatches(
        matchesData?.matches ?? initialMatches,
        predictionsData?.predictions ?? [],
      ),
    [matchesData?.matches, initialMatches, predictionsData?.predictions],
  );

  const errorMessage =
    (matchesError ? getDirectMatchesErrorMessage(matchesError) : "") ||
    (predictionsError ? getApiErrorMessage(predictionsError) : "") ||
    initialError ||
    "";

  const grouped = useMemo(() => {
    const groupedMatches = new Map<string, Match[]>();
    sortVisibleMatches(matches).forEach((match) => {
      const nepalDate = formatMatchDateTimeNepal(match.kickoffAt).date;
      const list = groupedMatches.get(nepalDate) ?? [];
      list.push(match);
      groupedMatches.set(nepalDate, list);
    });
    return Array.from(groupedMatches.entries());
  }, [matches]);

  const handlePredictionSaved = (
    matchId: string,
    home: number,
    away: number,
    winner: "home" | "away" | "draw" | null,
    shootoutWinner: "home" | "away" | null,
  ) => {
    void mutatePredictions((current) => {
      if (!current) {
        return current;
      }

      const nextPrediction = {
        matchId,
        predicted: winner ? { home, away, winner, shootoutWinner } : { home, away, shootoutWinner },
      };
      const existingIndex = current.predictions.findIndex(
        (prediction) => prediction.matchId === matchId,
      );

      if (existingIndex === -1) {
        return {
          ...current,
          predictions: [nextPrediction, ...current.predictions],
        };
      }

      return {
        ...current,
        predictions: current.predictions.map((prediction) =>
          prediction.matchId === matchId ? { ...prediction, ...nextPrediction } : prediction,
        ),
      };
    }, false);

    void mutatePredictions();
    setActive(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-3xl font-semibold tracking-tight">Upcoming matches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit predictions before the deadline. Predictions lock 15 minutes before kickoff.
          </p>
          {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}
        </header>

        <div className="space-y-8">
          {grouped.map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {date}
              </h2>
              <div className="space-y-3">
                {list.map((match) => (
                  <MatchCard key={match.id} match={match} onPredict={() => setActive(match)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {active && (
        <PredictionModal
          match={active}
          onClose={() => setActive(null)}
          onSaved={handlePredictionSaved}
        />
      )}
    </div>
  );
}

function MatchCard({ match, onPredict }: { match: Match; onPredict: () => void }) {
  const submitted = !!match.predicted;
  const finished = match.status === "finished" && !!match.result;
  const live = match.status === "live" && !!match.result;
  const result = match.result;
  const matchTime = formatMatchDateTimeNepal(match.kickoffAt);

  return (
    <div
      onClick={onPredict}
      className="grid cursor-pointer items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-card transition hover:border-ring/30 sm:grid-cols-[1fr_auto]"
    >
      {finished || live ? (
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <div className="text-base font-semibold">{match.home}</div>
            </div>
            <TeamFlag
              team={match.home}
              fallback={match.homeFlag}
              className="h-8 w-10 rounded object-cover"
            />
          </div>
          <div className="text-center">
            <div className="text-4xl font-semibold tabular-nums">
              {result!.home} - {result!.away}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {finished ? "Final" : "Live"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TeamFlag
              team={match.away}
              fallback={match.awayFlag}
              className="h-8 w-10 rounded object-cover"
            />
            <div>
              <div className="text-base font-semibold">{match.away}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <div className="text-base font-semibold">{match.home}</div>
            </div>
            <TeamFlag
              team={match.home}
              fallback={match.homeFlag}
              className="h-8 w-10 rounded object-cover"
            />
          </div>
          <div className="grid place-items-center rounded-xl bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            vs
          </div>
          <div className="flex items-center gap-3">
            <TeamFlag
              team={match.away}
              fallback={match.awayFlag}
              className="h-8 w-10 rounded object-cover"
            />
            <div>
              <div className="text-base font-semibold">{match.away}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 sm:flex-col sm:items-end">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />{" "}
          {finished
            ? `Finished ${matchTime.kickoff}`
            : live
              ? `Live ${matchTime.kickoff}`
              : `Kickoff ${matchTime.kickoff} · Locks ${match.deadline}`}
        </div>
        {finished ? (
          <div className="text-right">
            {submitted && (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-success/20 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
                Predicted score {match.predicted!.home}-{match.predicted!.away}
              </div>
            )}
          </div>
        ) : submitted ? (
          <button
            onClick={onPredict}
            className="inline-flex items-center gap-1.5 rounded-xl border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success"
          >
            <CheckCircle2 className="h-4 w-4" /> Submitted {match.predicted!.home}-
            {match.predicted!.away}
          </button>
        ) : (
          <div className="rounded-xl border border-warning/20 bg-warning/10 px-5 py-2 text-sm font-semibold text-warning">
            Not predicted
          </div>
        )}
      </div>
    </div>
  );
}
