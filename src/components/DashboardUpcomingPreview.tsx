"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { TeamFlag } from "@/components/TeamFlag";
import type { Match } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

function getMatchStatusPriority(match: Match) {
  if (match.status === "upcoming") return 0;
  if (match.status === "live") return 1;
  return 2;
}

export function DashboardUpcomingPreview({
  matches,
  loading,
}: {
  matches: Match[];
  loading: boolean;
}) {
  const visibleMatches = [...matches]
    .filter((match) => match.status !== "finished")
    .sort((a, b) => {
      const statusDiff = getMatchStatusPriority(a) - getMatchStatusPriority(b);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt);
    })
    .slice(0, 3);

  const shouldShowLoading = loading && visibleMatches.length === 0;

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Upcoming matches</h2>
        <Link
          href="/matches"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          All →
        </Link>
      </div>
      <div className="space-y-3">
        {shouldShowLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">
            Loading upcoming matches...
          </div>
        ) : null}
        {visibleMatches.map((m) => {
          const matchTime = formatMatchDateTimeNepal(m.kickoffAt);

          return (
            <div
              key={m.id}
              className="rounded-2xl border border-border bg-background/40 p-4 transition hover:border-ring/40"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {matchTime.date} · {matchTime.kickoff}
                </span>
                {m.status === "finished" ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Final
                  </span>
                ) : m.predicted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                    <CheckCircle2 className="h-3 w-3" /> Submitted
                  </span>
                ) : (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
                    Not predicted
                  </span>
                )}
              </div>
              {m.result && m.status !== "upcoming" ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <TeamFlag
                      team={m.home}
                      fallback={m.homeFlag}
                      className="h-5 w-7 rounded-sm object-cover"
                    />
                    <span>{m.home}</span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold tabular-nums">
                      {m.result.home} - {m.result.away}
                    </div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {m.status === "finished" ? "Final" : "Live"}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span>{m.away}</span>
                    <TeamFlag
                      team={m.away}
                      fallback={m.awayFlag}
                      className="h-5 w-7 rounded-sm object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <TeamFlag
                      team={m.home}
                      fallback={m.homeFlag}
                      className="h-4 w-6 rounded-sm object-cover"
                    />{" "}
                    {m.home}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">vs</span>
                  <span className="inline-flex items-center gap-2">
                    {m.away}{" "}
                    <TeamFlag
                      team={m.away}
                      fallback={m.awayFlag}
                      className="h-4 w-6 rounded-sm object-cover"
                    />
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {!shouldShowLoading && visibleMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">
            No upcoming matches yet.
          </div>
        ) : null}
      </div>
      <Link
        href="/matches"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
      >
        View all matches <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
