"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";

import { AppNavbar } from "@/components/AppNavbar";
import { ApiError, fetchGroupHistory, fetchMe, fetchMyGroups, getApiErrorMessage } from "@/lib/api";
import {
  clearActiveGroup,
  clearSession,
  getActiveGroup,
  getSession,
  setActiveGroup,
  setSession,
} from "@/lib/auth";
import { fetchMatchesFromProxy, getDirectMatchesErrorMessage } from "@/lib/football-data";
import { readGroupHistoryCache, writeGroupHistoryCache } from "@/lib/predictions-cache";
import type { GroupHistoryItem, Match } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

function getPredictionTone(pointsEarned?: number) {
  if (pointsEarned === 3) {
    return "bg-[#b7f17a] text-[#244100]";
  }

  if (pointsEarned === 1) {
    return "bg-[#9ec8ff] text-[#0d356e]";
  }

  if (pointsEarned === 0) {
    return "bg-[#ffb4c1] text-[#6a1020]";
  }

  return "bg-white/10 text-white/70";
}

function getHistoryMatchPriority(item: GroupHistoryItem) {
  if (item.match.status === "live") {
    return 0;
  }

  if (item.match.deadline === "locked") {
    return 1;
  }

  if (item.match.status === "finished") {
    return 2;
  }

  return 3;
}

function getMatchLookupKey(match: Pick<Match, "home" | "away" | "kickoffAt">) {
  return `${match.home}::${match.away}::${match.kickoffAt}`;
}

function getScoredPoints(
  prediction: GroupHistoryItem["predictions"][number],
  result?: Match["result"],
) {
  if (typeof prediction.pointsEarned === "number") {
    return prediction.pointsEarned;
  }

  if (!result) {
    return undefined;
  }

  if (
    prediction.predicted.home === result.home &&
    prediction.predicted.away === result.away
  ) {
    return 3;
  }

  const predictedDiff = prediction.predicted.home - prediction.predicted.away;
  const resultDiff = result.home - result.away;

  if (
    (predictedDiff === 0 && resultDiff === 0) ||
    (predictedDiff > 0 && resultDiff > 0) ||
    (predictedDiff < 0 && resultDiff < 0)
  ) {
    return 1;
  }

  return 0;
}

export function GameHistoryPageClient() {
  const router = useRouter();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const resolveGroup = async () => {
      try {
        if (!getSession()) {
          const me = await fetchMe();
          if (cancelled) return;
          setSession({ token: "cookie-session", user: me.user });
        }

        const currentGroup = getActiveGroup();
        let resolvedGroup = currentGroup;

        if (!resolvedGroup) {
          const groupsResponse = await fetchMyGroups();
          const availableGroups = groupsResponse.groups;
          resolvedGroup = availableGroups[0] ?? null;
        }

        if (!resolvedGroup) {
          clearActiveGroup();
          router.push("/groups");
          return;
        }

        setActiveGroup(resolvedGroup);
        if (!cancelled) {
          setGroupId(resolvedGroup.id);
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
      }
    };

    void resolveGroup();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const historyKey = groupId ? `group-history:${groupId}` : null;
  const cachedHistory = groupId ? readGroupHistoryCache(groupId) : null;
  const { data, error: historyError, isLoading } = useSWR(
    historyKey,
    () => fetchGroupHistory(groupId!),
    {
      fallbackData: cachedHistory ?? undefined,
      revalidateOnFocus: false,
      onSuccess: (response) => {
        setActiveGroup(response.group);
        writeGroupHistoryCache(response.group.id, response);
        setError("");
      },
    },
  );

  useEffect(() => {
    if (!historyError) {
      return;
    }

    setError(getApiErrorMessage(historyError));
    if (historyError instanceof ApiError && historyError.status === 401) {
      clearSession();
      clearActiveGroup();
      router.push("/");
    }
  }, [historyError, router]);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const members = useMemo(() => data?.members ?? [], [data?.members]);

  const historyDateRange = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    let earliestKickoff = items[0].match.kickoffAt;
    let latestKickoff = items[0].match.kickoffAt;

    for (const item of items) {
      if (item.match.kickoffAt < earliestKickoff) {
        earliestKickoff = item.match.kickoffAt;
      }

      if (item.match.kickoffAt > latestKickoff) {
        latestKickoff = item.match.kickoffAt;
      }
    }

    return {
      dateFrom: earliestKickoff.slice(0, 10),
      dateTo: latestKickoff.slice(0, 10),
    };
  }, [items]);

  const { data: matchesData, error: matchesError } = useSWR(
    historyDateRange
      ? `game-history-matches:${historyDateRange.dateFrom}:${historyDateRange.dateTo}`
      : null,
    () => fetchMatchesFromProxy(historyDateRange!),
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (!matchesError) {
      return;
    }

    setError((current) => current || getDirectMatchesErrorMessage(matchesError));
  }, [matchesError]);

  const hydratedItems = useMemo(() => {
    const matches = matchesData?.matches ?? [];
    if (matches.length === 0) {
      return items;
    }

    const matchesById = new Map(matches.map((match) => [match.id, match]));
    const matchesByLookupKey = new Map(matches.map((match) => [getMatchLookupKey(match), match]));

    return items.map((item) => {
      const resolvedMatch =
        matchesById.get(item.match.id) ?? matchesByLookupKey.get(getMatchLookupKey(item.match));

      const resolvedResult = resolvedMatch?.result ?? item.match.result;

      if (!resolvedMatch) {
        return {
          ...item,
          predictions: item.predictions.map((prediction) => ({
            ...prediction,
            pointsEarned: getScoredPoints(prediction, resolvedResult),
          })),
        };
      }

      return {
        ...item,
        match: {
          ...item.match,
          deadline: resolvedMatch.deadline,
          status: resolvedMatch.result && resolvedMatch.status !== "upcoming" ? "finished" : resolvedMatch.status,
          result: resolvedResult,
        },
        predictions: item.predictions.map((prediction) => ({
          ...prediction,
          pointsEarned: getScoredPoints(prediction, resolvedResult),
        })),
      };
    });
  }, [items, matchesData?.matches]);

  const matrix = useMemo(() => {
    const players = new Map<
      number,
      {
        userId: number;
        name: string;
        initials: string;
        isMe: boolean;
        totalPoints: number;
        predictionsByMatch: Record<string, GroupHistoryItem["predictions"][number]>;
      }
    >();

    members.forEach((member) => {
      players.set(member.userId, {
        userId: member.userId,
        name: member.name,
        initials: member.initials,
        isMe: Boolean(member.isMe),
        totalPoints: 0,
        predictionsByMatch: {},
      });
    });

    hydratedItems.forEach((item) => {
      item.predictions.forEach((prediction) => {
        const existing = players.get(prediction.userId) ?? {
          userId: prediction.userId,
          name: prediction.name,
          initials: prediction.initials,
          isMe: Boolean(prediction.isMe),
          totalPoints: 0,
          predictionsByMatch: {},
        };

        existing.predictionsByMatch[item.match.id] = prediction;
        existing.isMe = existing.isMe || Boolean(prediction.isMe);
        existing.totalPoints += prediction.pointsEarned ?? 0;
        players.set(prediction.userId, existing);
      });
    });

    return Array.from(players.values()).sort(
      (left, right) =>
        right.totalPoints - left.totalPoints ||
        Number(right.isMe) - Number(left.isMe) ||
        left.name.localeCompare(right.name),
    );
  }, [hydratedItems, members]);

  const orderedItems = useMemo(
    () =>
      [...hydratedItems].sort((left, right) => {
        const priorityDiff = getHistoryMatchPriority(left) - getHistoryMatchPriority(right);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const leftKickoff = Date.parse(left.match.kickoffAt);
        const rightKickoff = Date.parse(right.match.kickoffAt);

        if (left.match.status === "finished" && right.match.status === "finished") {
          return rightKickoff - leftKickoff;
        }

        return leftKickoff - rightKickoff;
      }),
    [hydratedItems],
  );

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AppNavbar />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
            <LegendPill label="3 pts exact score" tone="bg-[#b7f17a] text-[#244100]" />
            <LegendPill label="1 pt correct outcome" tone="bg-[#9ec8ff] text-[#0d356e]" />
            <LegendPill label="0 pts wrong" tone="bg-[#ffb4c1] text-[#6a1020]" />
          </div>
        </header>

        {isLoading && !data ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Loading game history...
          </div>
        ) : null}

        {!isLoading && hydratedItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-white/60">
            No visible match history yet.
          </div>
        ) : null}
        
        {hydratedItems.length > 0 ? (
          <MatrixBoard
            items={orderedItems}
            players={matrix}
            playedMatches={data?.playedMatches}
            totalMatches={data?.totalMatches}
          />
        ) : null}
      </main>
    </div>
  );
}

function LegendPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full px-3 py-2 ${tone}`}>{label}</span>;
}

function MatrixBoard({
  items,
  players,
  playedMatches,
  totalMatches,
}: {
  items: GroupHistoryItem[];
  players: Array<{
    userId: number;
    name: string;
    initials: string;
    isMe: boolean;
    totalPoints: number;
    predictionsByMatch: Record<string, GroupHistoryItem["predictions"][number]>;
  }>;
  playedMatches?: number;
  totalMatches?: number;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1a1a] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 bg-[#222222] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Leaderboard</div>
            <h2 className="mt-1 text-lg font-semibold text-white">Game History</h2>
          </div>
          {typeof playedMatches === "number" && typeof totalMatches === "number" ? (
            <div className="text-right">
              <div className="text-lg font-semibold text-white">
                {playedMatches}/{totalMatches}
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Matches played</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-separate border-spacing-0 text-sm text-white">
          <thead>
            <tr className="bg-[#262626] text-left text-xs uppercase tracking-wide text-white/55">
              <th className="sticky left-0 z-20 border-b border-white/10 bg-[#262626] px-4 py-3">Player</th>
              {items.map((item) => {
                const matchTime = formatMatchDateTimeNepal(item.match.kickoffAt);
                return (
                  <th key={item.match.id} className="min-w-[110px] border-b border-l border-white/10 bg-[#262626] px-2 py-3 text-center align-top">
                    <div className="text-[10px] text-white/35">{matchTime.date}</div>
                    <div className="mt-1 text-[11px] font-semibold text-white/80">
                      {item.match.home} vs {item.match.away}
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">
                      {item.match.result ? `${item.match.result.home}-${item.match.result.away}` : "-----"}
                    </div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-20 border-b border-l border-white/10 bg-[#1f1f1f] px-4 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {players.length > 0 ? (
              players.map((player, index) => (
                <tr key={player.userId} className="bg-[#1a1a1a] even:bg-[#181818]">
                  <td className="sticky left-0 z-10 border-b border-white/10 bg-inherit px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-5 text-xs font-semibold text-white/40">{index + 1}</div>
                      <div className="font-semibold text-white">
                        {player.name}
                        {player.isMe ? (
                          <span className="ml-2 rounded-full bg-[#f3c742] px-2 py-0.5 text-[10px] font-bold uppercase text-[#3d2b00]">
                            You
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {items.map((item) => {
                    const prediction = player.predictionsByMatch[item.match.id];
                    const showPoints = item.match.status === "finished";

                    return (
                      <td key={`${player.userId}-${item.match.id}`} className="border-b border-l border-white/10 px-2 py-3 align-middle text-center">
                        {prediction ? (
                          <div className="inline-flex min-w-[66px] flex-col items-center gap-1 rounded-xl bg-white/[0.03] px-2 py-2">
                            <div className="text-base font-semibold text-white">
                              {prediction.predicted.home}-{prediction.predicted.away}
                            </div>
                            {showPoints && typeof prediction.pointsEarned === "number" ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getPredictionTone(prediction.pointsEarned)}`}
                              >
                                {prediction.pointsEarned} pts
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="inline-flex min-w-[66px] items-center justify-center rounded-xl bg-white/[0.03] px-2 py-2 text-sm font-semibold text-white/25">
                            -----
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 border-b border-l border-white/10 bg-inherit px-4 py-3 text-right text-xl font-semibold text-white">
                    {player.totalPoints}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={items.length + 2} className="px-4 py-8 text-center text-sm text-white/55">
                  No visible predictions for this match yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
