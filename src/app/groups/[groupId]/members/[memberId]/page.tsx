"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { TeamFlag } from "@/components/TeamFlag";
import { ApiError, fetchGroupMemberPredictions, fetchMe, getApiErrorMessage } from "@/lib/api";
import { clearActiveGroup, clearSession, getSession, setSession } from "@/lib/auth";
import type { AuthUser, Match } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

type MemberPredictionsCache = {
  member: AuthUser;
  predictions: Match[];
};

function getMemberPredictionsCacheKey(groupId: number, memberId: number) {
  return `wow_member_predictions_${groupId}_${memberId}`;
}

function readMemberPredictionsCache(groupId: number, memberId: number) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getMemberPredictionsCacheKey(groupId, memberId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as MemberPredictionsCache;
  } catch {
    window.sessionStorage.removeItem(getMemberPredictionsCacheKey(groupId, memberId));
    return null;
  }
}

function writeMemberPredictionsCache(
  groupId: number,
  memberId: number,
  value: MemberPredictionsCache,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    getMemberPredictionsCacheKey(groupId, memberId),
    JSON.stringify(value),
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
  const [member, setMember] = useState<AuthUser | null>(null);
  const [predictions, setPredictions] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const cachedResponse = readMemberPredictionsCache(groupId, memberId);
    if (cachedResponse) {
      setMember(cachedResponse.member);
      setPredictions(cachedResponse.predictions);
      setLoading(false);
    }

    const loadPredictions = async () => {
      if (!getSession()) {
        fetchMe()
          .then((me) => {
            if (!cancelled) {
              setSession({ token: "cookie-session", user: me.user });
            }
          })
          .catch(() => {
            // The predictions request below is cookie-authenticated already.
          });
      }

      const response = await fetchGroupMemberPredictions(groupId, memberId);
      if (cancelled) return;

      setMember(response.member);
      setPredictions(response.predictions);
      writeMemberPredictionsCache(groupId, memberId, {
        member: response.member,
        predictions: response.predictions,
      });
      setError("");
    };

    loadPredictions()
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
          if (err instanceof ApiError && err.status === 401) {
            clearSession();
            clearActiveGroup();
            router.push("/");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, memberId, router]);

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
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </header>

        {loading ? (
          <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            Loading predictions...
          </div>
        ) : null}

        {!loading && !error && predictions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">
            {isCurrentUser ? "No predicted matches yet." : "No locked predictions to show yet."}
          </div>
        ) : null}

        {!loading && !error && predictions.length > 0 ? (
          <div className="space-y-3">
            {predictions.map((match) => {
              const matchTime = formatMatchDateTimeNepal(match.kickoffAt);

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
                          label={isCurrentUser ? "Predicted score" : "Prediction"}
                          value={
                            isCurrentUser && match.predicted
                              ? `${match.predicted.home}-${match.predicted.away}`
                              : match.submitted
                                ? "Submitted"
                                : "Not predicted"
                          }
                        />
                        <InfoTile
                          label={isCurrentUser ? "Predicted winner" : "Visibility"}
                          value={
                            isCurrentUser && match.predicted
                              ? getWinnerLabel(match.home, match.away, match.predicted.winner)
                              : "Hidden until review"
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
