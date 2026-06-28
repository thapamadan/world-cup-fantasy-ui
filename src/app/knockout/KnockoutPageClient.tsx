"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Lock, Trophy, Users } from "lucide-react";
import useSWR from "swr";

import { AppNavbar } from "@/components/AppNavbar";
import { TeamFlag } from "@/components/TeamFlag";
import {
  ApiError,
  fetchGroupKnockoutPredictions,
  fetchKnockoutPrediction,
  fetchMe,
  getApiErrorMessage,
  saveKnockoutPrediction,
} from "@/lib/api";
import { clearActiveGroup, clearSession, getActiveGroup, getSession, setSession } from "@/lib/auth";
import {
  clearKnockoutPredictionCache,
  KNOCKOUT_PREDICTION_CACHE_KEY,
  readKnockoutPredictionCache,
  writeKnockoutPredictionCache,
} from "@/lib/predictions-cache";
import type {
  GroupKnockoutMember,
  KnockoutPickStatus,
  KnockoutPrediction,
  KnockoutTeamStatus,
  TeamOption,
} from "@/lib/types";
import { cn, formatMatchDateTimeNepal } from "@/lib/utils";

type TierKey = "quarterfinalists" | "semifinalists" | "finalists";

const TIERS: { key: TierKey; title: string; subtitle: string; perTeam: string }[] = [
  {
    key: "quarterfinalists",
    title: "Quarterfinalists",
    subtitle: "Pick the 8 teams you expect to reach the quarterfinals.",
    perTeam: "+1 each (max 8)",
  },
  {
    key: "semifinalists",
    title: "Semifinalists",
    subtitle: "Pick the 4 teams you expect to reach the semifinals.",
    perTeam: "+1 each (max 4)",
  },
  {
    key: "finalists",
    title: "Finalists",
    subtitle: "Pick the 2 teams you expect to reach the final.",
    perTeam: "+1 each (max 2)",
  },
];

function statusBadge(status: KnockoutPickStatus) {
  if (status === "correct") {
    return { label: "Through", icon: "✅", className: "bg-success/15 text-success" };
  }
  if (status === "eliminated") {
    return { label: "Out", icon: "❌", className: "bg-destructive/15 text-destructive" };
  }
  return { label: "Active", icon: "⏳", className: "bg-muted text-muted-foreground" };
}

function buildStatusMap(prediction?: KnockoutPrediction) {
  const map = new Map<string, KnockoutPickStatus>();
  if (!prediction) return map;
  for (const tier of [
    prediction.quarterfinalists,
    prediction.semifinalists,
    prediction.finalists,
  ]) {
    for (const team of tier) {
      // The same team can sit in multiple tiers; key per tier handled at render time.
      map.set(team.name, team.status);
    }
  }
  return map;
}

export function KnockoutPageClient() {
  const router = useRouter();
  // Seed SWR with the last-known bracket from localStorage so the page paints
  // immediately (even in a new tab) while the network request revalidates.
  const cachedPrediction = useMemo(() => readKnockoutPredictionCache() ?? undefined, []);
  const {
    data: prediction,
    error: fetchError,
    mutate,
  } = useSWR(KNOCKOUT_PREDICTION_CACHE_KEY, fetchKnockoutPrediction, {
    revalidateOnFocus: false,
    fallbackData: cachedPrediction,
    keepPreviousData: true,
  });

  const [quarterfinalists, setQuarterfinalists] = useState<string[]>([]);
  const [semifinalists, setSemifinalists] = useState<string[]>([]);
  const [finalists, setFinalists] = useState<string[]>([]);
  const [champion, setChampion] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<TierKey | "champion">("quarterfinalists");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!getSession()) {
      fetchMe()
        .then((me) => setSession({ token: "cookie-session", user: me.user }))
        .catch(() => {
          // The knockout request is cookie-authenticated already.
        });
    }
  }, []);

  useEffect(() => {
    if (!prediction) return;
    setQuarterfinalists(prediction.quarterfinalists.map((team) => team.name));
    setSemifinalists(prediction.semifinalists.map((team) => team.name));
    setFinalists(prediction.finalists.map((team) => team.name));
    setChampion(prediction.champion?.name ?? null);
    // Keep the cross-tab cache in sync with the freshest bracket data.
    writeKnockoutPredictionCache(prediction);
  }, [prediction]);

  useEffect(() => {
    if (fetchError instanceof ApiError && fetchError.status === 401) {
      clearKnockoutPredictionCache();
      clearSession();
      clearActiveGroup();
      router.push("/");
    }
  }, [fetchError, router]);

  const locked = prediction?.locked ?? false;
  const teams = prediction?.teams ?? [];
  const statusMap = useMemo(() => buildStatusMap(prediction), [prediction]);

  // Once the bracket locks, reveal what everyone in the active group predicted.
  const activeGroup = getActiveGroup();
  const { data: groupPredictions } = useSWR(
    locked && activeGroup ? ["group-knockout-predictions", activeGroup.id] : null,
    () => fetchGroupKnockoutPredictions(activeGroup!.id),
    { revalidateOnFocus: false },
  );
  const groupMembers = groupPredictions?.members ?? [];

  const tierState: Record<TierKey, [string[], (value: string[]) => void, number]> = {
    quarterfinalists: [quarterfinalists, setQuarterfinalists, prediction?.maxQuarterfinalists ?? 8],
    semifinalists: [semifinalists, setSemifinalists, prediction?.maxSemifinalists ?? 4],
    finalists: [finalists, setFinalists, prediction?.maxFinalists ?? 2],
  };

  const toggleTeam = (tier: TierKey, teamName: string) => {
    if (locked) return;
    setSuccess("");
    const [selected, setSelected, max] = tierState[tier];
    if (selected.includes(teamName)) {
      setSelected(selected.filter((name) => name !== teamName));
      return;
    }
    if (selected.length >= max) {
      setSaveError(`You can only pick ${max} ${tier}.`);
      return;
    }
    setSaveError("");
    setSelected([...selected, teamName]);
  };

  const toggleChampion = (teamName: string) => {
    if (locked) return;
    setSuccess("");
    setChampion((current) => (current === teamName ? null : teamName));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSuccess("");
    try {
      const response = await saveKnockoutPrediction({
        quarterfinalists,
        semifinalists,
        finalists,
        champion,
      });
      await mutate(response.prediction, { revalidate: false });
      setSuccess(response.message);
      void mutate();
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const error = saveError || (fetchError ? getApiErrorMessage(fetchError) : "");
  const points = prediction?.points;
  const lockTime = prediction?.lockAt ? formatMatchDateTimeNepal(prediction.lockAt) : null;

  const isChampionMode = activeMode === "champion";
  const activeSelected =
    activeMode === "champion" ? (champion ? [champion] : []) : tierState[activeMode][0];
  const activeMax = activeMode === "champion" ? 1 : tierState[activeMode][2];
  const activeLabel =
    activeMode === "champion"
      ? "Champion"
      : activeMode === "quarterfinalists"
        ? "Quarterfinalists"
        : activeMode === "semifinalists"
          ? "Semifinalists"
          : "Finalists";

  const handleSelectTeam = (teamName: string) => {
    if (activeMode === "champion") {
      toggleChampion(teamName);
    } else {
      toggleTeam(activeMode, teamName);
    }
  };

  const chooseTeamsRef = useRef<HTMLDivElement>(null);
  const goToPicks = (mode: TierKey | "champion") => {
    setActiveMode(mode);
    setSaveError("");
    requestAnimationFrame(() => {
      chooseTeamsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <header>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Trophy className="h-3.5 w-3.5" /> Knockout bracket
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Knockout predictions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Predict who advances through the bracket. Quarterfinalists, semifinalists and finalists
            score +1 each; the champion scores +5. Up to 19 bonus points are on the line.
          </p>
        </header>

        <section
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm",
            locked
              ? "border-border bg-muted/50 text-muted-foreground"
              : "border-warning/30 bg-warning/10 text-foreground",
          )}
        >
          <div className="inline-flex items-center gap-2 font-medium">
            {locked ? <Lock className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {locked
              ? "Predictions are locked. Points update automatically as teams advance."
              : lockTime
                ? `Locks ${lockTime.date} at ${lockTime.kickoff} (1 hour before the first Round of 32 match).`
                : "Locks 1 hour before the first Round of 32 match."}
          </div>
          {points ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 font-semibold text-foreground shadow-card">
              <Trophy className="h-3.5 w-3.5 text-primary" /> {points.total} / 19 bonus pts
            </div>
          ) : null}
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? (
          <p className="inline-flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </p>
        ) : null}

        {points ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PointTile label="Champion" value={points.championPoints} max={5} />
            <PointTile label="Quarterfinals" value={points.quarterfinalPoints} max={8} />
            <PointTile label="Semifinals" value={points.semifinalPoints} max={4} />
            <PointTile label="Finalists" value={points.finalPoints} max={2} />
          </section>
        ) : null}

        {!prediction ? (
          <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            Loading knockout bracket…
          </div>
        ) : (
          <>
            <div className="space-y-5">
              <ChampionCard
                champion={champion}
                status={prediction.champion?.status}
                locked={locked}
                isActive={isChampionMode}
                onPick={() => goToPicks("champion")}
              />

              {TIERS.map((tier) => {
                const [selected, , max] = tierState[tier.key];
                return (
                  <TierCard
                    key={tier.key}
                    title={tier.title}
                    subtitle={tier.subtitle}
                    perTeam={tier.perTeam}
                    selectedCount={selected.length}
                    max={max}
                    selectedTeams={selected}
                    statusMap={statusMap}
                    locked={locked}
                    onPick={() => goToPicks(tier.key)}
                    isActive={activeMode === tier.key}
                  />
                );
              })}
            </div>

            <section
              ref={chooseTeamsRef}
              className="scroll-mt-20 rounded-3xl border border-border bg-card p-5 shadow-card"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Choose teams
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {activeLabel} · {activeSelected.length}/{activeMax}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveMode("champion")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      isChampionMode
                        ? "bg-gold text-gold-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    <Trophy className="h-3.5 w-3.5" /> Champion
                  </button>
                  {TIERS.map((tier) => (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => setActiveMode(tier.key)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        activeMode === tier.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70",
                      )}
                    >
                      {tier.title}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {isChampionMode
                  ? "Tap a team to set your champion (+5)."
                  : `Tap teams to add or remove them from your ${activeLabel.toLowerCase()} picks.`}
              </p>

              <TeamGrid
                teams={teams}
                selected={activeSelected}
                onSelect={handleSelectTeam}
                champion={champion}
                locked={locked}
                statusMap={statusMap}
              />
            </section>

            {!locked ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-70"
              >
                {saving ? "Saving…" : "Save knockout predictions"}
              </button>
            ) : null}

            {locked && activeGroup ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold tracking-tight">
                    Everyone&apos;s bracket picks
                  </h2>
                  <span className="text-xs text-muted-foreground">{activeGroup.name}</span>
                </div>
                {groupMembers.length === 0 ? (
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                    Loading group predictions…
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupMembers.map((member) => (
                      <MemberKnockoutCard key={member.userId} member={member} />
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function PointTile({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value}
        <span className="ml-1 text-xs font-normal text-muted-foreground">/ {max}</span>
      </div>
    </div>
  );
}

function TierCard({
  title,
  subtitle,
  perTeam,
  selectedCount,
  max,
  selectedTeams,
  statusMap,
  locked,
  onPick,
  isActive,
}: {
  title: string;
  subtitle: string;
  perTeam: string;
  selectedCount: number;
  max: number;
  selectedTeams: string[];
  statusMap: Map<string, KnockoutPickStatus>;
  locked: boolean;
  onPick: () => void;
  isActive: boolean;
}) {
  return (
    <section
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={cn(
        "cursor-pointer rounded-3xl border bg-card p-5 shadow-card transition hover:border-primary/40",
        isActive ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {perTeam}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              selectedCount === max
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            {selectedCount}/{max}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {selectedTeams.length === 0 ? (
          <span className="rounded-xl border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            {locked ? "No picks" : "Tap to choose teams →"}
          </span>
        ) : (
          selectedTeams.map((name) => {
            const badge = statusBadge(statusMap.get(name) ?? "active");
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3 py-1.5 text-sm font-medium"
              >
                <TeamFlag team={name} className="h-3.5 w-5 rounded-sm object-cover" />
                {name}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    badge.className,
                  )}
                >
                  {badge.icon}
                </span>
              </span>
            );
          })
        )}
        {!locked && selectedTeams.length > 0 ? (
          <span className="ml-auto text-xs font-semibold text-primary">Edit →</span>
        ) : null}
      </div>
    </section>
  );
}

function ChampionCard({
  champion,
  status,
  locked,
  isActive,
  onPick,
}: {
  champion: string | null;
  status?: KnockoutPickStatus;
  locked: boolean;
  isActive: boolean;
  onPick: () => void;
}) {
  const badge = champion ? statusBadge(status ?? "active") : null;
  return (
    <section
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={cn(
        "cursor-pointer rounded-3xl border bg-gold/5 p-5 shadow-card transition hover:border-gold",
        isActive ? "border-gold ring-1 ring-gold/30" : "border-gold/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Champion</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pick the tournament winner. A correct champion scores +5.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          +5 points
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {champion ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-card px-3 py-2 text-sm font-semibold">
            <TeamFlag team={champion} className="h-4 w-6 rounded-sm object-cover" />
            {champion}
            {badge ? (
              <span
                className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", badge.className)}
              >
                {badge.icon} {badge.label}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No champion picked yet.</span>
        )}
        {!locked ? (
          <button
            type="button"
            onClick={onPick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-gold text-gold-foreground"
                : "border border-gold/50 bg-card text-foreground hover:bg-gold/10",
            )}
          >
            <Trophy className="h-4 w-4" /> {champion ? "Change champion" : "Choose champion"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function TeamGrid({
  teams,
  selected,
  onSelect,
  champion,
  locked,
  statusMap,
}: {
  teams: TeamOption[];
  selected: string[];
  onSelect: (name: string) => void;
  champion: string | null;
  locked: boolean;
  statusMap: Map<string, KnockoutPickStatus>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {teams.map((team) => {
        const isSelected = selected.includes(team.name);
        const isChampion = champion === team.name;
        const status = statusMap.get(team.name);
        return (
          <button
            key={team.name}
            type="button"
            onClick={() => onSelect(team.name)}
            disabled={locked}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border bg-background/40 hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2">
              <TeamFlag
                team={team.name}
                fallback={team.flag}
                className="h-4 w-6 rounded-sm object-cover"
              />
              <span className="truncate">{team.name}</span>
            </span>
            <span className="flex items-center gap-1">
              {isChampion ? <Trophy className="h-3.5 w-3.5 text-gold" /> : null}
              {status === "correct" ? <span className="text-[11px]">✅</span> : null}
              {status === "eliminated" ? <span className="text-[11px]">❌</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MemberKnockoutCard({ member }: { member: GroupKnockoutMember }) {
  return (
    <article
      className={cn(
        "rounded-3xl border bg-card p-5 shadow-card",
        member.isMe ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {member.initials}
          </span>
          <span className="text-sm font-semibold">{member.name}</span>
          {member.isMe ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              You
            </span>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 text-primary" /> {member.points.total} pts
        </span>
      </div>

      <div className="space-y-2.5">
        <PickRow label="Champion" teams={member.champion ? [member.champion] : []} highlight />
        <PickRow label="Finalists" teams={member.finalists} />
        <PickRow label="Semifinalists" teams={member.semifinalists} />
        <PickRow label="Quarterfinalists" teams={member.quarterfinalists} />
      </div>
    </article>
  );
}

function PickRow({
  label,
  teams,
  highlight = false,
}: {
  label: string;
  teams: KnockoutTeamStatus[];
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-2">
      <span className="pt-1 text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {teams.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          teams.map((team) => {
            const badge = statusBadge(team.status);
            return (
              <span
                key={team.name}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium",
                  highlight ? "border-gold/50 bg-gold/5" : "border-border bg-background/50",
                )}
              >
                <TeamFlag
                  team={team.name}
                  fallback={team.flag}
                  className="h-3.5 w-5 rounded-sm object-cover"
                />
                {team.name}
                <span
                  className={cn("rounded-full px-1 py-0.5 text-[9px] font-bold", badge.className)}
                >
                  {badge.icon}
                </span>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
