"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Crown,
  KeyRound,
  Medal,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
const DashboardUpcomingPreview = dynamic(
  () => import("@/components/DashboardUpcomingPreview").then((mod) => mod.DashboardUpcomingPreview),
  { ssr: false },
);
import { WinnerPredictionCard } from "@/components/WinnerPredictionCard";
import { TeamFlag } from "@/components/TeamFlag";
import {
  ApiError,
  fetchGroupLeaderboard,
  fetchMe,
  fetchMyGroups,
  fetchMyPredictions,
  getApiErrorMessage,
} from "@/lib/api";
import {
  clearActiveGroup,
  clearSession,
  getActiveGroup,
  getSession,
  setActiveGroup,
  setSession,
} from "@/lib/auth";
import { fetchMatchesFromProxy, getDirectMatchesErrorMessage } from "@/lib/football-data";
import { prefetchGroupHistory } from "@/lib/group-history-prefetch";
import {
  getDashboardLeaderboardCacheKey,
  MY_PREDICTIONS_CACHE_KEY,
  readDashboardLeaderboardCache,
  writeDashboardLeaderboardCache,
} from "@/lib/predictions-cache";
import type { Group, LeaderboardRow, Match, MemberPrediction } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

export default function DashboardPage() {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [resolvedGroupId, setResolvedGroupId] = useState<number | null>(null);
  const [groupResolved, setGroupResolved] = useState(false);
  const [groupResolutionAttempt, setGroupResolutionAttempt] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentName, setCurrentName] = useState("Player");
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [error, setError] = useState("");
  const cachedLeaderboard = resolvedGroupId ? readDashboardLeaderboardCache(resolvedGroupId) : null;
  const { data: predictionsData } = useSWR(MY_PREDICTIONS_CACHE_KEY, fetchMyPredictions, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
  const {
    data: leaderboardData,
    error: leaderboardError,
    isLoading: leaderboardLoading,
  } = useSWR(
    resolvedGroupId ? getDashboardLeaderboardCacheKey(resolvedGroupId) : null,
    () => fetchGroupLeaderboard(resolvedGroupId!),
    {
      fallbackData: cachedLeaderboard ?? undefined,
      revalidateOnFocus: false,
      onSuccess: (response) => {
        setActiveGroup(response.group);
        setGroup(response.group);
        writeDashboardLeaderboardCache(response.group.id, response);
        setError("");
      },
    },
  );
  const leaderboard = leaderboardData?.leaderboard ?? cachedLeaderboard?.leaderboard ?? [];
  const loading = !groupResolved || (resolvedGroupId !== null && !leaderboardData && leaderboardLoading);

  const previewMatches = useMemo(
    () => mergePredictionsWithMatches(matches, predictionsData?.predictions ?? []),
    [matches, predictionsData?.predictions],
  );

  useEffect(() => {
    setCurrentName(getSession()?.user.name ?? "Player");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMatchesPreview = async () => {
      const matchesResponse = await fetchMatchesFromProxy({ dateFrom: getTodayIsoDate() });
      if (cancelled) return;
      setMatches(matchesResponse.matches);
      setMatchesLoading(false);
    };

    loadMatchesPreview().catch((err) => {
      if (!cancelled) {
        setMatchesLoading(false);
        setError(getDirectMatchesErrorMessage(err));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveGroup = async () => {
      try {
        if (!getSession()) {
          const me = await fetchMe();
          if (cancelled) return;
          setSession({ token: "cookie-session", user: me.user });
          setCurrentName(me.user.name);
        }

        const currentGroup = getActiveGroup();
        let resolvedGroup = currentGroup;

        if (!resolvedGroup) {
          const groupsResponse = await fetchMyGroups();
          const availableGroups = groupsResponse.groups;
          resolvedGroup = availableGroups[0] ?? null;
        }

        if (resolvedGroup) {
          setActiveGroup(resolvedGroup);
          void prefetchGroupHistory(resolvedGroup.id);
        } else {
          clearActiveGroup();
        }

        if (!resolvedGroup) {
          setGroupResolved(true);
          router.push("/groups");
          return;
        }

        if (!cancelled) {
          setGroup(resolvedGroup);
          setResolvedGroupId(resolvedGroup.id);
          setGroupResolved(true);
          setError("");
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(getApiErrorMessage(err));
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          clearActiveGroup();
          router.push("/");
        }

        setGroupResolved(true);
      }
    };

    void resolveGroup();

    return () => {
      cancelled = true;
    };
  }, [groupResolutionAttempt, router]);

  useEffect(() => {
    if (!leaderboardError) {
      return;
    }

    if (leaderboardError instanceof ApiError && leaderboardError.status === 404) {
      clearActiveGroup();
      setGroup(null);
      setResolvedGroupId(null);
      setGroupResolved(false);
      setError("");
      setGroupResolutionAttempt((value) => value + 1);
      return;
    }

    setError(getApiErrorMessage(leaderboardError));
    if (leaderboardError instanceof ApiError && leaderboardError.status === 401) {
      clearSession();
      clearActiveGroup();
      router.push("/");
    }
  }, [leaderboardError, router]);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <HeroCard
          group={group}
          leaderboard={leaderboard}
          loading={loading}
          currentName={currentName}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <LeaderboardCard
              group={group}
              leaderboard={leaderboard}
              loading={loading}
              onSelectMember={(member) => {
                if (!group) {
                  return null;
                }
                return `/groups/${group.id}/members/${member.userId}`;
              }}
            />
          </div>
          <div className="space-y-8">
            <DashboardUpcomingPreview matches={previewMatches} loading={matchesLoading} />
            <WinnerPredictionCard />
            <GroupInfoCard group={group} />
          </div>
        </div>
      </main>
    </div>
  );
}

function HeroCard({
  group,
  leaderboard,
  loading,
  currentName,
}: {
  group: Group | null;
  leaderboard: LeaderboardRow[];
  loading: boolean;
  currentName: string;
}) {
  const me = leaderboard.find((row) => row.isMe);
  const isLeading = me?.rank === 1;
  const targetRow = me && me.rank > 1 ? leaderboard[me.rank - 2] : null;
  const pointsBehind = me && targetRow ? Math.max(targetRow.points - me.points, 0) : 0;
  const progress = me
    ? Math.min(100, (me.points / Math.max(me.points + pointsBehind, 1)) * 100)
    : 0;

  return (
    <section className="overflow-hidden rounded-3xl bg-hero-gradient p-8 text-primary-foreground shadow-elevated">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur">
            <Trophy className="h-3.5 w-3.5 text-gold" /> {group?.name ?? "Group leaderboard"}
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Hey {currentName.split(" ")[0]}
            {me ? (
              <>
                {" "}
                - you&apos;re <span className="text-gold">#{me.rank}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-2 text-primary-foreground/70">
            {loading
              ? "Loading your group standings..."
              : group
                ? `You are competing inside the ${group.name} group. Predict every game and top the leaderboard.`
                : "Join or create a group to start competing."}
          </p>

          {me && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-primary-foreground/60">
                <span>
                  {isLeading ? "You are leading this group" : `Progress to #${me.rank - 1}`}
                </span>
                <span>{me.points} pts</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gold-gradient shadow-gold"
                  style={{ width: `${isLeading ? 100 : progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/matches"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-primary shadow-gold transition hover:brightness-105"
            >
              Predict next match <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/game-history"
              onMouseEnter={() => {
                if (group) {
                  void prefetchGroupHistory(group.id);
                }
              }}
              onTouchStart={() => {
                if (group) {
                  void prefetchGroupHistory(group.id);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-primary-foreground backdrop-blur transition hover:bg-white/10"
            >
              Game history <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Current rank"
            value={me ? `#${me.rank}` : "-"}
            hint={group ? group.name : "Group"}
          />
          <Stat label="Total points" value={me ? `${me.points}` : "0"} hint="pts" />
          <Stat label="My predictions" value={me ? `${me.predictionCount}` : "0"} hint="matches" />
          <Stat
            label="Group members"
            value={group ? `${group.memberCount}` : "0"}
            hint="players"
            accent
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur ${accent ? "border-gold/30 bg-gold/10" : "border-white/10 bg-white/5"}`}
    >
      <div className="text-2xl font-semibold tracking-tight">
        {value}
        {hint && (
          <span className="ml-1 text-sm font-normal text-primary-foreground/60">{hint}</span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-primary-foreground/60">{label}</div>
    </div>
  );
}

function LeaderboardCard({
  group,
  leaderboard,
  loading,
  onSelectMember,
}: {
  group: Group | null;
  leaderboard: LeaderboardRow[];
  loading: boolean;
  onSelectMember: (member: LeaderboardRow) => string | null;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {group ? `${group.name} leaderboard` : "Group leaderboard"}
          </h2>
          <p className="text-sm text-muted-foreground">Only members of this group appear here</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
          Loading leaderboard...
        </div>
      ) : (
        <div className="space-y-1">
          {leaderboard.map((row) => (
            <LeaderboardEntry
              key={`${row.rank}-${row.name}`}
              row={row}
              href={onSelectMember(row)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LeaderboardEntry({ row, href }: { row: LeaderboardRow; href: string | null }) {
  const podium = row.rank <= 3;
  const podiumIcon = row.rank === 1 ? Crown : row.rank === 2 ? Medal : Award;
  const PodiumIcon = podiumIcon;
  const podiumColor =
    row.rank === 1 ? "text-gold" : row.rank === 2 ? "text-muted-foreground" : "text-warning";

  const content = (
    <>
      <div className="flex w-10 items-center justify-center">
        {podium ? (
          <PodiumIcon className={`h-5 w-5 ${podiumColor}`} strokeWidth={2.5} />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">{row.rank}</span>
        )}
      </div>
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {row.initials}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">
          {row.name}{" "}
          {row.isMe && (
            <span className="ml-1.5 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold-foreground">
              You
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {row.predictionCount} predictions submitted - Click to view predictions
        </div>
      </div>
      <Movement value={row.movement} />
      <div className="w-16 text-right text-base font-semibold tabular-nums">
        {row.points} <span className="text-xs font-normal text-muted-foreground">pts</span>
      </div>
    </>
  );

  if (!href) {
    return (
      <div
        className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left ${row.isMe ? "bg-gold/10 ring-1 ring-gold/40" : "bg-card"}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition ${row.isMe ? "bg-gold/10 ring-1 ring-gold/40" : "hover:bg-muted/60"}`}
    >
      {content}
    </Link>
  );
}

function Movement({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
      </span>
    );
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value)}
    </span>
  );
}

function GroupInfoCard({ group }: { group: Group | null }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-lg font-semibold tracking-tight">Current group</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share these details with other players so they can join your private leaderboard.
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-card text-primary shadow-card">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Group name</div>
            <div className="text-sm font-semibold">{group?.name ?? "No group selected"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-card text-gold shadow-card">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Join details</div>
            <div className="text-sm font-semibold">Code {group?.joinCode ?? "-"}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
