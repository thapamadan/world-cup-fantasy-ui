"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
import { readGroupHistoryCache, writeGroupHistoryCache } from "@/lib/predictions-cache";
import type { GroupHistoryItem, Match } from "@/lib/types";

const PALETTE = [
  "#534AB7",
  "#0F6E56",
  "#D85A30",
  "#185FA5",
  "#639922",
  "#D4537E",
  "#BA7517",
  "#A32D2D",
  "#2E7D9A",
  "#7B4FA0",
  "#496BD8",
  "#9C4221",
];

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
  if (prediction.predicted.home === result.home && prediction.predicted.away === result.away) {
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

type Player = { userId: number; name: string; isMe: boolean; color: string; total: number };

export function PointsChartPageClient() {
  const router = useRouter();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const resolveGroup = async () => {
      try {
        if (!getSession()) {
          const me = await fetchMe();
          if (cancelled) return;
          setSession({ token: "cookie-session", user: me.user });
        }
        let resolvedGroup = getActiveGroup();
        if (!resolvedGroup) {
          const groupsResponse = await fetchMyGroups();
          resolvedGroup = groupsResponse.groups[0] ?? null;
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
        if (cancelled) return;
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

  const cachedHistory = groupId ? readGroupHistoryCache(groupId) : null;
  const { data, isLoading } = useSWR(
    groupId ? `group-history:${groupId}` : null,
    () => fetchGroupHistory(groupId!),
    {
      fallbackData: cachedHistory ?? undefined,
      revalidateOnFocus: false,
      onSuccess: (response) => {
        setActiveGroup(response.group);
        writeGroupHistoryCache(response.group.id, response);
      },
    },
  );

  const { players, chartData } = useMemo(() => {
    const members = data?.members ?? [];
    const items = data?.items ?? [];

    // Only finished matches contribute points, in chronological order.
    const finishedItems = items
      .filter((item) => item.match.status === "finished")
      .sort((left, right) => Date.parse(left.match.kickoffAt) - Date.parse(right.match.kickoffAt));

    const playerList: Player[] = members.map((member, index) => ({
      userId: member.userId,
      name: member.isMe ? `${member.name} (You)` : member.name,
      isMe: Boolean(member.isMe),
      color: PALETTE[index % PALETTE.length],
      total: 0,
    }));

    const cumulative = new Map<number, number>(playerList.map((p) => [p.userId, 0]));
    const rows = finishedItems.map((item, index) => {
      const byUser = new Map(item.predictions.map((p) => [p.userId, p]));
      const row: Record<string, number> = { match: index + 1 };
      for (const player of playerList) {
        const prediction = byUser.get(player.userId);
        if (prediction) {
          const earned = getScoredPoints(prediction, item.match.result);
          if (typeof earned === "number") {
            cumulative.set(player.userId, (cumulative.get(player.userId) ?? 0) + earned);
          }
        }
        row[String(player.userId)] = cumulative.get(player.userId) ?? 0;
      }
      return row;
    });

    playerList.forEach((player) => {
      player.total = cumulative.get(player.userId) ?? 0;
    });
    playerList.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return { players: playerList, chartData: rows };
  }, [data]);

  const toggle = (userId: number) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const hasData = chartData.length > 0 && players.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Points growth</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cumulative match points for each player across finished matches. Tap a name to show or
            hide a line.
          </p>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </header>

        {isLoading && !hasData ? (
          <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            Loading chart…
          </div>
        ) : null}

        {!isLoading && !hasData ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">
            No finished matches to chart yet.
          </div>
        ) : null}

        {hasData ? (
          <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex flex-wrap gap-2">
              {players.map((player) => {
                const isHidden = hidden.has(player.userId);
                return (
                  <button
                    key={player.userId}
                    type="button"
                    onClick={() => toggle(player.userId)}
                    style={{ borderColor: player.isMe ? player.color : undefined }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                      player.isMe ? "border bg-muted/40" : "border-border"
                    } ${isHidden ? "opacity-40" : ""}`}
                  >
                    <span
                      className="inline-block h-0.5 w-4 shrink-0"
                      style={{ backgroundColor: player.color }}
                    />
                    {player.name}
                    <strong style={{ color: player.color }}>{player.total}</strong>
                  </button>
                );
              })}
            </div>

            <div className="h-[440px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="rgba(136,135,128,0.14)" vertical={false} />
                  <XAxis
                    dataKey="match"
                    tick={{ fill: "#888780", fontSize: 11 }}
                    tickFormatter={(value) => `M${value}`}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: "#888780", fontSize: 11 }}
                    width={36}
                    allowDecimals={false}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    itemSorter={(item) => -(item.value as number)}
                    labelFormatter={(label) => `Match ${label}`}
                    formatter={(value, name) => [`${value} pts`, name]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border, #e5e5e5)",
                      fontSize: 12,
                    }}
                  />
                  {players.map((player) => (
                    <Line
                      key={player.userId}
                      type="monotone"
                      dataKey={String(player.userId)}
                      name={player.name}
                      stroke={player.color}
                      strokeWidth={player.isMe ? 2.75 : 1.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                      hide={hidden.has(player.userId)}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Match number (chronological) → cumulative points
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
