"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Trophy } from "lucide-react";
import useSWR from "swr";

import { TeamFlag } from "@/components/TeamFlag";
import { fetchWinnerPrediction, getApiErrorMessage, saveWinnerPrediction } from "@/lib/api";
import { WINNER_PREDICTION_CACHE_KEY } from "@/lib/predictions-cache";
import type { WinnerPrediction } from "@/lib/types";
import { cn, formatMatchDateTimeNepal } from "@/lib/utils";
import { WINNER_PREDICTION_LOCK_AT, WORLD_CUP_TEAMS } from "@/lib/world-cup";

const DEFAULT_PREDICTION: WinnerPrediction = {
  teams: WORLD_CUP_TEAMS,
  locked: Date.now() >= Date.parse(WINNER_PREDICTION_LOCK_AT),
  lockAt: WINNER_PREDICTION_LOCK_AT,
  selectedTeam: null,
  selectedFlag: null,
  winningTeam: null,
  winningFlag: null,
  pointsAwarded: null,
};

export function WinnerPredictionCard({ className }: { className?: string }) {
  const {
    data: prediction,
    error: predictionError,
    mutate: mutateWinnerPrediction,
  } = useSWR(WINNER_PREDICTION_CACHE_KEY, fetchWinnerPrediction, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
  const [selectedTeam, setSelectedTeam] = useState(WORLD_CUP_TEAMS[0]?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const resolvedPrediction = prediction ?? DEFAULT_PREDICTION;
  const error = saveError || (predictionError ? getApiErrorMessage(predictionError) : "");

  useEffect(() => {
    if (prediction) {
      setSelectedTeam(prediction.selectedTeam ?? WORLD_CUP_TEAMS[0]?.name ?? "");
    }
  }, [prediction]);

  const handleSave = async () => {
    if (!selectedTeam) {
      setSaveError("Choose a country first.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSuccess("");

    try {
      const response = await saveWinnerPrediction({ team_name: selectedTeam });
      await mutateWinnerPrediction(response.prediction, { revalidate: false });
      setSelectedTeam(response.prediction.selectedTeam ?? selectedTeam);
      setSuccess(response.message);
      void mutateWinnerPrediction();
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
      setSuccess("");
    } finally {
      setSaving(false);
    }
  };

  const lockTime = resolvedPrediction.lockAt
    ? formatMatchDateTimeNepal(resolvedPrediction.lockAt)
    : null;

  return (
    <section className={cn("rounded-3xl border border-border bg-card p-6 shadow-card", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Trophy className="h-3.5 w-3.5" /> Bonus pick
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight">World Cup winner prediction</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick one country to win the tournament. A correct pick adds 10 points to the
            leaderboard.
          </p>
        </div>
        {resolvedPrediction.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Locked
          </span>
        ) : null}
      </div>

      {resolvedPrediction ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-background/40 p-4 text-sm text-muted-foreground">
            {lockTime
              ? `Winner picks lock before the last group-stage kickoff: ${lockTime.date} at ${lockTime.kickoff}.`
              : "Winner picks lock before the last group-stage kickoff."}
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Your country
            </span>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              disabled={resolvedPrediction.locked || saving}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resolvedPrediction.teams.map((team) => (
                <option key={team.name} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile
              label="Your pick"
              value={resolvedPrediction.selectedTeam ?? "Not picked"}
              flag={resolvedPrediction.selectedFlag}
            />
            <InfoTile
              label="Champion"
              value={resolvedPrediction.winningTeam ?? "Not decided"}
              flag={resolvedPrediction.winningFlag}
            />
            <InfoTile
              label="Bonus"
              value={
                typeof resolvedPrediction.pointsAwarded === "number"
                  ? `+${resolvedPrediction.pointsAwarded}`
                  : "Pending"
              }
              highlight={resolvedPrediction.pointsAwarded === 10}
            />
          </div>

          {!resolvedPrediction.locked ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-70"
            >
              {saving
                ? "Saving..."
                : resolvedPrediction.selectedTeam
                  ? "Update winner prediction"
                  : "Save winner prediction"}
            </button>
          ) : (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
              <Lock className="h-4 w-4" /> Winner prediction locked before the final group-stage
              match
            </div>
          )}

          {success ? (
            <p className="inline-flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {success}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/20 p-4 text-sm text-muted-foreground">
          Winner prediction is unavailable right now.
        </div>
      )}
    </section>
  );
}

function InfoTile({
  label,
  value,
  flag,
  highlight = false,
}: {
  label: string;
  value: string;
  flag?: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background/40 p-4 text-sm",
        highlight && "border-success/30 bg-success/10",
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2 font-semibold text-foreground">
        {flag ? (
          <TeamFlag team={value} fallback={flag} className="h-5 w-7 rounded-sm object-cover" />
        ) : null}
        <span>{value}</span>
      </div>
    </div>
  );
}
