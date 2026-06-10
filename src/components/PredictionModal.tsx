"use client";

import { useState } from "react";
import { CheckCircle2, Lock, X } from "lucide-react";

import { TeamFlag } from "@/components/TeamFlag";
import { getApiErrorMessage, savePrediction } from "@/lib/api";
import type { Match } from "@/lib/types";

function getWinnerLabel(home: string, away: string, score?: { home: number; away: number }, winner?: "home" | "away" | "draw") {
  if (winner) {
    if (winner === "home") return home;
    if (winner === "away") return away;
    return "Draw";
  }

  if (!score) return "-";
  if (score.home > score.away) return home;
  if (score.away > score.home) return away;
  return "Draw";
}

function getPredictionPoints(match: Match) {
  if (typeof match.pointsEarned === "number") return match.pointsEarned;
  if (!match.predicted || !match.result) return 0;
  if (match.predicted.home === match.result.home && match.predicted.away === match.result.away) return 6;

  const predictedDiff = match.predicted.home - match.predicted.away;
  const resultDiff = match.result.home - match.result.away;
  if ((predictedDiff === 0 && resultDiff === 0) || (predictedDiff > 0 && resultDiff > 0) || (predictedDiff < 0 && resultDiff < 0)) {
    return 1;
  }

  return 0;
}

export function PredictionModal({
  match,
  onClose,
  onSaved,
}: {
  match: Match;
  onClose: () => void;
  onSaved: (matchId: string, home: number, away: number, winner: "home" | "away" | "draw" | null) => void;
}) {
  const [home, setHome] = useState(match.predicted?.home ?? 0);
  const [away, setAway] = useState(match.predicted?.away ?? 0);
  const [winnerPick, setWinnerPick] = useState<"home" | "away" | "draw" | null>(match.predicted?.winner ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const finished = match.status === "finished" && !!match.result;
  const editingLocked = finished || Date.now() >= Date.parse(match.kickoffAt) - 15 * 60 * 1000;
  const scoreHome = finished && match.result ? match.result.home : home;
  const scoreAway = finished && match.result ? match.result.away : away;
  const predictedWinnerLabel = getWinnerLabel(match.home, match.away, match.predicted, match.predicted?.winner);
  const actualWinnerLabel = getWinnerLabel(match.home, match.away, match.result ?? undefined);
  const pointsEarned = getPredictionPoints(match);

  const submitPrediction = async () => {
    setSaving(true);
    setError("");

    try {
      if (editingLocked) {
        setError("Predictions lock 15 minutes before kickoff.");
        setSaving(false);
        return;
      }

      if (!winnerPick) {
        setError("Choose whether the match will end in a home win, away win, or draw.");
        setSaving(false);
        return;
      }

      await savePrediction({ match_id: match.id, home_score: home, away_score: away, winner: winnerPick });
      onSaved(match.id, home, away, winnerPick);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{match.date} · {match.kickoff}</div>
            <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{match.home} vs {match.away}</h3>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl bg-muted/50 p-5">
          <ScoreInput label={match.home} flag={match.homeFlag} value={scoreHome} onChange={setHome} disabled={editingLocked} />
          <div className="text-2xl font-semibold text-muted-foreground">-</div>
          <ScoreInput label={match.away} flag={match.awayFlag} value={scoreAway} onChange={setAway} disabled={editingLocked} />
        </div>

        {!editingLocked && (
          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4 text-sm">
            <div className="mb-3 text-sm font-semibold">Choose winner</div>
            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => setWinnerPick("home")} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${winnerPick === "home" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>
                {match.home}
              </button>
              <button type="button" onClick={() => setWinnerPick("draw")} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${winnerPick === "draw" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>
                Draw
              </button>
              <button type="button" onClick={() => setWinnerPick("away")} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${winnerPick === "away" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>
                {match.away}
              </button>
            </div>
          </div>
        )}

        {finished ? (
          <div className="mt-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Predicted winner</div>
                <div className="mt-1 font-semibold">{match.predicted ? predictedWinnerLabel : "Not predicted"}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Actual winner</div>
                <div className="mt-1 font-semibold">{actualWinnerLabel}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Predicted score</div>
                <div className="mt-1 font-semibold">{match.predicted ? `${match.predicted.home}-${match.predicted.away}` : "Not predicted"}</div>
              </div>
            </div>
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> You earned {pointsEarned} point{pointsEarned === 1 ? "" : "s"}
            </div>
          </div>
        ) : editingLocked ? (
          <div className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-success">
            <Lock className="h-4 w-4" /> Prediction locked 15 minutes before kickoff
          </div>
        ) : (
          <button onClick={submitPrediction} disabled={saving} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95">
            {saving ? "Saving..." : "Submit prediction"}
          </button>
        )}
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">Other employees can&apos;t see your prediction until results close.</p>
      </div>
    </div>
  );
}

function ScoreInput({ label, flag, value, onChange, disabled }: { label: string; flag: string; value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <div className="text-center">
      <div className="mb-2"><TeamFlag team={label} fallback={flag} className="h-7 w-9 rounded object-cover" /></div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-3 inline-flex items-center gap-2">
        <button disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card text-lg font-semibold shadow-card disabled:opacity-40">-</button>
        <div className="w-10 text-3xl font-semibold tabular-nums">{value}</div>
        <button disabled={disabled} onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card text-lg font-semibold shadow-card disabled:opacity-40">+</button>
      </div>
    </div>
  );
}
