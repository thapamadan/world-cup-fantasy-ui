"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
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
import type { Group, GroupHistoryItem } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

function getWinnerLabel(home: string, away: string, winner?: "home" | "away" | "draw") {
  if (winner === "home") return home;
  if (winner === "away") return away;
  if (winner === "draw") return "Draw";
  return "-";
}

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

export function GameHistoryPageClient() {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
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
          setGroup(resolvedGroup);
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
  const { data, error: historyError, isLoading } = useSWR(
    historyKey,
    () => fetchGroupHistory(groupId!),
    {
      revalidateOnFocus: false,
      onSuccess: (response) => {
        setGroup(response.group);
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

  const items = data?.items ?? [];
  const members = data?.members ?? [];

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

    items.forEach((item) => {
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
  }, [items, members]);

  const pageLabel = useMemo(() => {
    if (items.length === 0) {
      return "Match history";
    }
    return `${items.length} matches`;
  }, [items.length]);

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
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
    [items],
  );

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AppNavbar />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
              <History className="h-3.5 w-3.5" /> {group?.name ?? "Group"} history
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              FIFA 2026 · Predictions
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Locked, live, and finished matches with visible group predictions and earned points.
            </p>
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

        {!isLoading && items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-white/60">
            No visible match history yet.
          </div>
        ) : null}

        {items.length > 0 ? (
          <MatrixBoard items={orderedItems} players={matrix} pageLabel={pageLabel} />
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
  pageLabel,
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
  pageLabel: string;
}) {
  
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1a1a] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 bg-[#222222] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Leaderboard</div>
            <h2 className="mt-1 text-lg font-semibold text-white">{pageLabel}</h2>
          </div>
          <div className="text-sm text-white/45">Player totals across visible matches</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0 text-sm text-white">
          <thead>
            <tr className="bg-[#262626] text-left text-xs uppercase tracking-wide text-white/55">
              <th className="sticky left-0 z-20 border-b border-white/10 bg-[#262626] px-4 py-4">Player</th>
              {items.map((item) => {
                const matchTime = formatMatchDateTimeNepal(item.match.kickoffAt);
                return (
                  <th key={item.match.id} className="min-w-[140px] border-b border-l border-white/10 bg-[#262626] px-3 py-4 text-center align-top">
                    <div className="text-[10px] text-white/35">{matchTime.date}</div>
                    <div className="mt-1 font-semibold text-white/80">
                      {item.match.home} vs {item.match.away}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {item.match.result ? `${item.match.result.home}-${item.match.result.away}` : "-----"}
                    </div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-20 border-b border-l border-white/10 bg-[#1f1f1f] px-4 py-4 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {players.length > 0 ? (
              players.map((player, index) => (
                <tr key={player.userId} className="bg-[#1a1a1a] even:bg-[#181818]">
                  <td className="sticky left-0 z-10 border-b border-white/10 bg-inherit px-4 py-4">
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
                      <td key={`${player.userId}-${item.match.id}`} className="border-b border-l border-white/10 px-3 py-4 align-top text-center">
                        {prediction ? (
                          <div className="space-y-1">
                            <div className="text-lg font-semibold text-white">
                              {prediction.predicted.home}-{prediction.predicted.away}
                            </div>
                            <div className="text-[11px] text-white/45">
                              {getWinnerLabel(item.match.home, item.match.away, prediction.predicted.winner)}
                            </div>
                            {showPoints && typeof prediction.pointsEarned === "number" ? (
                              <div className="flex justify-center">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getPredictionTone(prediction.pointsEarned)}`}
                                >
                                  {prediction.pointsEarned} pts
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1 text-white/25">
                            <div className="text-lg font-semibold">-----</div>
                            <div className="text-[11px]">-----</div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 border-b border-l border-white/10 bg-inherit px-4 py-4 text-right text-2xl font-semibold text-white">
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
