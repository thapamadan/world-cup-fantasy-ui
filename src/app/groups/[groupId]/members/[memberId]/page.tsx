"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import useSWR from "swr";

import { AppNavbar } from "@/components/AppNavbar";
import { TeamFlag } from "@/components/TeamFlag";
import {
  ApiError,
  fetchGroupMemberPredictions,
  fetchMatches,
  fetchMe,
  getApiErrorMessage,
} from "@/lib/api";
import { clearActiveGroup, clearSession, getSession, setSession } from "@/lib/auth";
import {
  getGroupMemberPredictionsCacheKey,
  readMemberPredictionsCache,
  writeMemberPredictionsCache,
} from "@/lib/predictions-cache";
import type { AuthUser, Match, MemberPrediction } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

function sortPredictions(matches: Match[]) {
  return [...matches].sort((left, right) => {
    const leftKickoffAt = new Date(left.kickoffAt).getTime();
    const rightKickoffAt = new Date(right.kickoffAt).getTime();

    if (left.status === "finished" && right.status !== "finished") {
      return 1;
    }
    if (left.status !== "finished" && right.status === "finished") {
      return -1;
    }
    if (left.status === "finished" && right.status === "finished") {
      return rightKickoffAt - leftKickoffAt;
    }
    return leftKickoffAt - rightKickoffAt;
  });
}

function mergePredictionsWithMatches(matches: Match[], predictions: MemberPrediction[]) {
  const predictionMap = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));

  return sortPredictions(
    matches
      .filter((match) => predictionMap.has(match.id))
      .map((match) => {
        const prediction = predictionMap.get(match.id)!;
        return {
          ...match,
          predicted: prediction.predicted,
          pointsEarned: prediction.pointsEarned,
          submitted: true,
        };
      }),
  );
}

function getWinnerLabel(home: string, away: string, winner?: "home" | "away" | "draw") {
  if (winner === "home") return home;
  if (winner === "away") return away;
  if (winner === "draw") return "Draw";
  return "-";
}

export default function MemberPredictionsPage() {
  const params = useParams<{ groupId: string; memberId: string }>();
  const router = useRouter();
  const groupId = Number(params.groupId);
  const memberId = Number(params.memberId);
  const cachedResponse = readMemberPredictionsCache(groupId, memberId);

  useEffect(() => {
    if (!getSession()) {
      fetchMe()
        .then((me) => {
          setSession({ token: "cookie-session", user: me.user });
        })
        .catch(() => {
          // The predictions request below is cookie-authenticated already.
        });
    }
  }, []);

  const { data, error, isLoading } = useSWR(
    getGroupMemberPredictionsCacheKey(groupId, memberId),
    async () => {
      const [response, matchesResponse] = await Promise.all([
        fetchGroupMemberPredictions(groupId, memberId),
        fetchMatches(),
      ]);

      const mergedPredictions = mergePredictionsWithMatches(
        matchesResponse.matches,
        response.predictions,
      );
      const nextData = {
        member: response.member,
        predictions: mergedPredictions,
      };

      writeMemberPredictionsCache(groupId, memberId, nextData);
      return nextData;
    },
    {
      fallbackData: cachedResponse ?? undefined,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  );

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      clearActiveGroup();
      router.push("/");
    }
  }, [error, router]);

  const member: AuthUser | null = data?.member ?? null;
  const predictions = data?.predictions ?? [];
  const errorMessage = error ? getApiErrorMessage(error) : "";

  const isCurrentUser = getSession()?.user.id === memberId;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {isCurrentUser ? "Your predicted matches" : "Locked predictions"}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {member
              ? isCurrentUser
                ? "Your submitted scores"
                : `${member.name}'s submitted scores`
              : "Player predictions"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCurrentUser
              ? "Upcoming and live predictions stay at the top. Finished games move below them automatically."
              : "Only matches predicted by this player are shown here, and only after the prediction locks 15 minutes before kickoff."}
          </p>
          {errorMessage ? <p className="mt-3 text-sm text-destructive">{errorMessage}</p> : null}
        </header>

        {isLoading ? (
          <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            Loading predictions...
          </div>
        ) : null}

        {!isLoading && !errorMessage && predictions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">
            {isCurrentUser ? "No predicted matches yet." : "No locked predictions to show yet."}
          </div>
        ) : null}

        {!isLoading && !errorMessage && predictions.length > 0 ? (
          <div className="space-y-3">
            {predictions.map((match) => {
              const matchTime = formatMatchDateTimeNepal(match.kickoffAt);
              const showPredictionDetails = Boolean(match.predicted);

              return (
                <div
                  key={match.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {matchTime.date} · {matchTime.kickoff}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {match.status === "finished"
                        ? "Final"
                        : match.status === "live"
                          ? "Live"
                          : "Locked"}
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div>
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <TeamFlag
                            team={match.home}
                            fallback={match.homeFlag}
                            className="h-4 w-6 rounded-sm object-cover"
                          />
                          {match.home}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">vs</span>
                        <span className="inline-flex items-center gap-2">
                          {match.away}
                          <TeamFlag
                            team={match.away}
                            fallback={match.awayFlag}
                            className="h-4 w-6 rounded-sm object-cover"
                          />
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <InfoTile
                          label="Predicted score"
                          value={
                            showPredictionDetails && match.predicted
                              ? `${match.predicted.home}-${match.predicted.away}`
                              : match.submitted
                                ? "Submitted"
                                : "Not predicted"
                          }
                        />
                        <InfoTile
                          label="Predicted winner"
                          value={
                            showPredictionDetails && match.predicted
                              ? getWinnerLabel(match.home, match.away, match.predicted.winner)
                              : "Pending"
                          }
                        />
                        <InfoTile
                          label="Points earned"
                          value={
                            typeof match.pointsEarned === "number"
                              ? `${match.pointsEarned}`
                              : "Pending"
                          }
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Match result
                      </div>
                      <div className="mt-1 font-semibold">
                        {match.result
                          ? `${match.result.home}-${match.result.away}`
                          : match.status === "finished"
                            ? "Final score pending"
                            : match.status === "live"
                              ? "Match in progress"
                              : "Locked, waiting for kickoff"}
                      </div>
                      {match.submitted || match.predicted ? (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Submitted before lock
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                          <Lock className="h-3.5 w-3.5" /> No prediction submitted
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
