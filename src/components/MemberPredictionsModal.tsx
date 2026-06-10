"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Lock, X } from "lucide-react";

import { fetchGroupMemberPredictions, getApiErrorMessage } from "@/lib/api";
import type { AuthUser, Match } from "@/lib/types";
import { TeamFlag } from "@/components/TeamFlag";

function getWinnerLabel(home: string, away: string, winner?: "home" | "away" | "draw") {
  if (winner === "home") return home;
  if (winner === "away") return away;
  if (winner === "draw") return "Draw";
  return "-";
}

export function MemberPredictionsModal({ groupId, memberId, onClose }: { groupId: number; memberId: number; onClose: () => void }) {
  const [member, setMember] = useState<AuthUser | null>(null);
  const [predictions, setPredictions] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchGroupMemberPredictions(groupId, memberId)
      .then((response) => {
        if (!cancelled) {
          setMember(response.member);
          setPredictions(response.predictions);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
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
  }, [groupId, memberId]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl bg-card p-6 shadow-elevated">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Locked and finished predictions</div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">{member ? `${member.name}'s submitted scores` : "Player predictions"}</h3>
            {member && <p className="mt-1 text-sm text-muted-foreground">Visible only after the match locks 15 minutes before kickoff.</p>}
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">Loading predictions...</div> : null}
        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && predictions.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">No locked predictions to show yet.</div> : null}

        {!loading && !error && predictions.length > 0 ? (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {predictions.map((match) => (
              <div key={match.id} className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{match.date} · {match.kickoff}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{match.status === "finished" ? "Final" : match.status === "live" ? "Live" : "Locked"}</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <div>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="inline-flex items-center gap-2"><TeamFlag team={match.home} fallback={match.homeFlag} className="h-4 w-6 rounded-sm object-cover" /> {match.home}</span>
                      <span className="text-xs font-normal text-muted-foreground">vs</span>
                      <span className="inline-flex items-center gap-2">{match.away} <TeamFlag team={match.away} fallback={match.awayFlag} className="h-4 w-6 rounded-sm object-cover" /></span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <InfoTile label="Predicted score" value={match.predicted ? `${match.predicted.home}-${match.predicted.away}` : "Not predicted"} />
                      <InfoTile label="Predicted winner" value={match.predicted ? getWinnerLabel(match.home, match.away, match.predicted.winner) : "Not predicted"} />
                      <InfoTile label="Points earned" value={typeof match.pointsEarned === "number" ? `${match.pointsEarned}` : "Pending"} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Match result</div>
                    <div className="mt-1 font-semibold">{match.result ? `${match.result.home}-${match.result.away}` : match.status === "upcoming" ? "Locked, waiting for kickoff" : "Waiting for score update"}</div>
                    {match.predicted ? <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Submitted before lock</div> : <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning"><Lock className="h-3.5 w-3.5" /> No prediction submitted</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
