"use client";

import Link from "next/link";
import { ArrowRight, Lock, Trophy } from "lucide-react";
import useSWR from "swr";

import { fetchKnockoutPrediction } from "@/lib/api";
import { KNOCKOUT_PREDICTION_CACHE_KEY } from "@/lib/predictions-cache";
import { cn, formatMatchDateTimeNepal } from "@/lib/utils";

export function KnockoutBracketCard({ className }: { className?: string }) {
  const { data } = useSWR(KNOCKOUT_PREDICTION_CACHE_KEY, fetchKnockoutPrediction, {
    revalidateOnFocus: false,
  });

  const points = data?.points;
  const picks =
    (data?.quarterfinalists.length ?? 0) +
    (data?.semifinalists.length ?? 0) +
    (data?.finalists.length ?? 0) +
    (data?.champion ? 1 : 0);
  const lockTime = data?.lockAt ? formatMatchDateTimeNepal(data.lockAt) : null;

  return (
    <section className={cn("rounded-3xl border border-border bg-card p-6 shadow-card", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Trophy className="h-3.5 w-3.5" /> Knockout bracket
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight">Knockout predictions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Predict the quarterfinalists, semifinalists, finalists and champion. Up to 19 bonus
            points.
          </p>
        </div>
        {data?.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Locked
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Bonus points</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {points?.total ?? 0}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 19</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Teams picked</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {picks}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 15</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {data?.locked
          ? "Picks are locked. Points update automatically as teams advance."
          : lockTime
            ? `Locks ${lockTime.date} at ${lockTime.kickoff}.`
            : "Locks 1 hour before the first Round of 32 match."}
      </p>

      <Link
        href="/knockout"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
      >
        {data?.locked ? "View bracket" : picks > 0 ? "Edit bracket" : "Make picks"}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
