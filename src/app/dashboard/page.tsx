"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Award, CheckCircle2, Crown, KeyRound, Medal, Minus, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { MemberPredictionsModal } from "@/components/MemberPredictionsModal";
import { TeamFlag } from "@/components/TeamFlag";
import { ApiError, fetchGroupLeaderboard, fetchMatches, fetchMe, fetchMyGroups, getApiErrorMessage } from "@/lib/api";
import { clearActiveGroup, clearSession, getActiveGroup, getSession, setActiveGroup, setSession } from "@/lib/auth";
import type { Group, LeaderboardRow, Match } from "@/lib/types";

const DEFAULT_REFRESH_INTERVAL_MS = 8_000;
const LIVE_REFRESH_INTERVAL_MS = 5_000;
const UPCOMING_PREVIEW_SESSION_KEY = "wow_dashboard_upcoming_matches";

function sortMatchesByKickoff(matches: Match[]) {
  return [...matches].sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
}

function selectUpcomingPreviewMatches(matches: Match[]) {
  const upcomingMatches = sortMatchesByKickoff(matches.filter((match) => match.status === "upcoming"));
  if (typeof window === "undefined") {
    return upcomingMatches.slice(0, 3);
  }

  const storedIds = window.sessionStorage.getItem(UPCOMING_PREVIEW_SESSION_KEY);
  const parsedIds = storedIds ? storedIds.split(",").filter(Boolean) : [];
  const upcomingById = new Map(upcomingMatches.map((match) => [match.id, match]));

  const selected: Match[] = [];
  const seenIds = new Set<string>();

  parsedIds.forEach((id) => {
    const match = upcomingById.get(id);
    if (match && !seenIds.has(id)) {
      selected.push(match);
      seenIds.add(id);
    }
  });

  upcomingMatches.forEach((match) => {
    if (selected.length >= 3 || seenIds.has(match.id)) {
      return;
    }

    selected.push(match);
    seenIds.add(match.id);
  });

  return selected;
}

export default function DashboardPage() {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMember, setSelectedMember] = useState<LeaderboardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;

    const scheduleRefresh = (matchesToCheck: Match[]) => {
      if (cancelled) {
        return;
      }

      const refreshInterval = matchesToCheck.some((match) => match.status === "live") ? LIVE_REFRESH_INTERVAL_MS : DEFAULT_REFRESH_INTERVAL_MS;
      refreshTimer = window.setTimeout(() => {
        loadDashboard().catch((err) => {
          if (!cancelled) {
            setError(getApiErrorMessage(err));
            if (err instanceof ApiError && err.status === 401) {
              clearSession();
              clearActiveGroup();
              router.push("/");
            }
          }
        });
      }, refreshInterval);
    };

    const loadDashboard = async () => {
      if (!getSession()) {
        const me = await fetchMe();
        if (cancelled) return;
        setSession({ token: "cookie-session", user: me.user });
      }

      const currentGroup = getActiveGroup();

      let resolvedGroup = currentGroup;
      if (!resolvedGroup) {
        const groupsResponse = await fetchMyGroups();
        resolvedGroup = groupsResponse.groups[0] ?? null;
        if (resolvedGroup) {
          setActiveGroup(resolvedGroup);
        }
      }

      if (!resolvedGroup) {
        router.push("/groups");
        return;
      }

      const [response, matchesResponse] = await Promise.all([fetchGroupLeaderboard(resolvedGroup.id), fetchMatches()]);
      if (cancelled) return;

      setActiveGroup(response.group);
      setGroup(response.group);
      setLeaderboard(response.leaderboard);
      setMatches(matchesResponse.matches);
      setError("");
      scheduleRefresh(matchesResponse.matches);
    };

    loadDashboard()
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
          if (err instanceof ApiError && err.status === 401) {
            clearSession();
            clearActiveGroup();
            router.push("/");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <HeroCard group={group} leaderboard={leaderboard} loading={loading} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <LeaderboardCard group={group} leaderboard={leaderboard} loading={loading} onSelectMember={setSelectedMember} />
          </div>
          <div className="space-y-8">
            <UpcomingPreview matches={matches} />
            <GroupInfoCard group={group} />
          </div>
        </div>
      </main>
      {group && selectedMember ? <MemberPredictionsModal groupId={group.id} memberId={selectedMember.userId} onClose={() => setSelectedMember(null)} /> : null}
    </div>
  );
}

function HeroCard({ group, leaderboard, loading }: { group: Group | null; leaderboard: LeaderboardRow[]; loading: boolean }) {
  const session = getSession();
  const currentName = session?.user.name ?? "Player";
  const me = leaderboard.find((row) => row.isMe);
  const isLeading = me?.rank === 1;
  const targetRow = me && me.rank > 1 ? leaderboard[me.rank - 2] : null;
  const pointsBehind = me && targetRow ? Math.max(targetRow.points - me.points, 0) : 0;
  const progress = me ? Math.min(100, (me.points / Math.max(me.points + pointsBehind, 1)) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-3xl bg-hero-gradient p-8 text-primary-foreground shadow-elevated">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur">
            <Trophy className="h-3.5 w-3.5 text-gold" /> {group?.name ?? "Group leaderboard"}
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Hey {currentName.split(" ")[0]}{me ? <> - you&apos;re <span className="text-gold">#{me.rank}</span></> : null}</h1>
          <p className="mt-2 text-primary-foreground/70">
            {loading ? "Loading your group standings..." : group ? `You are competing inside the ${group.name} group. Predict every game and top the leaderboard.` : "Join or create a group to start competing."}
          </p>

          {me && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-primary-foreground/60">
                <span>{isLeading ? "You are leading this group" : `Progress to #${me.rank - 1}`}</span>
                <span>{me.points} pts</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gold-gradient shadow-gold" style={{ width: `${isLeading ? 100 : progress}%` }} />
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/matches" className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-primary shadow-gold transition hover:brightness-105">
              Predict next match <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/recent-games" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-primary-foreground backdrop-blur transition hover:bg-white/10">
              Recent games <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Current rank" value={me ? `#${me.rank}` : "-"} hint={group ? group.name : "Group"} />
          <Stat label="Total points" value={me ? `${me.points}` : "0"} hint="pts" />
          <Stat label="My predictions" value={me ? `${me.predictionCount}` : "0"} hint="matches" />
          <Stat label="Group members" value={group ? `${group.memberCount}` : "0"} hint="players" accent />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur ${accent ? "border-gold/30 bg-gold/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-2xl font-semibold tracking-tight">{value}{hint && <span className="ml-1 text-sm font-normal text-primary-foreground/60">{hint}</span>}</div>
      <div className="mt-0.5 text-xs text-primary-foreground/60">{label}</div>
    </div>
  );
}

function LeaderboardCard({ group, leaderboard, loading, onSelectMember }: { group: Group | null; leaderboard: LeaderboardRow[]; loading: boolean; onSelectMember: (member: LeaderboardRow) => void }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{group ? `${group.name} leaderboard` : "Group leaderboard"}</h2>
          <p className="text-sm text-muted-foreground">Only members of this group appear here</p>
        </div>
      </div>

      {loading ? <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">Loading leaderboard...</div> : <div className="space-y-1">{leaderboard.map((row) => <LeaderboardEntry key={`${row.rank}-${row.name}`} row={row} onOpen={() => onSelectMember(row)} />)}</div>}
    </section>
  );
}

function LeaderboardEntry({ row, onOpen }: { row: LeaderboardRow; onOpen: () => void }) {
  const podium = row.rank <= 3;
  const podiumIcon = row.rank === 1 ? Crown : row.rank === 2 ? Medal : Award;
  const PodiumIcon = podiumIcon;
  const podiumColor = row.rank === 1 ? "text-gold" : row.rank === 2 ? "text-muted-foreground" : "text-warning";

  return (
    <button type="button" onClick={onOpen} className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition ${row.isMe ? "bg-gold/10 ring-1 ring-gold/40" : "hover:bg-muted/60"}`}>
      <div className="flex w-10 items-center justify-center">{podium ? <PodiumIcon className={`h-5 w-5 ${podiumColor}`} strokeWidth={2.5} /> : <span className="text-sm font-semibold text-muted-foreground">{row.rank}</span>}</div>
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{row.initials}</div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{row.name} {row.isMe && <span className="ml-1.5 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold-foreground">You</span>}</div>
        <div className="text-xs text-muted-foreground">{row.predictionCount} predictions submitted · Click to view locked picks</div>
      </div>
      <Movement value={row.movement} />
      <div className="w-16 text-right text-base font-semibold tabular-nums">{row.points} <span className="text-xs font-normal text-muted-foreground">pts</span></div>
    </button>
  );
}

function Movement({ value }: { value: number }) {
  if (value === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /></span>;
  const up = value > 0;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>{up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(value)}</span>;
}

function UpcomingPreview({ matches }: { matches: Match[] }) {
  const [next, setNext] = useState<Match[]>([]);

  useEffect(() => {
    const selectedMatches = selectUpcomingPreviewMatches(matches);
    setNext(selectedMatches);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(UPCOMING_PREVIEW_SESSION_KEY, selectedMatches.map((match) => match.id).join(","));
    }
  }, [matches]);

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Upcoming matches</h2>
        <Link href="/matches" className="text-xs font-medium text-muted-foreground hover:text-foreground">All →</Link>
      </div>
      <div className="space-y-3">
        {next.map((m) => (
          <div key={m.id} className="rounded-2xl border border-border bg-background/40 p-4 transition hover:border-ring/40">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{m.date} · {m.kickoff}</span>
              {m.status === "finished" ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Final</span> : m.predicted ? <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success"><CheckCircle2 className="h-3 w-3" /> Submitted</span> : <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">Not predicted</span>}
            </div>
            {m.result && m.status !== "upcoming" ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-semibold">
                <div className="flex items-center gap-2"><TeamFlag team={m.home} fallback={m.homeFlag} className="h-5 w-7 rounded-sm object-cover" /><span>{m.home}</span></div>
                <div className="text-center"><div className="text-2xl font-semibold tabular-nums">{m.result.home} - {m.result.away}</div><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.status === "finished" ? "Final" : "Live"}</div></div>
                <div className="flex items-center justify-end gap-2"><span>{m.away}</span><TeamFlag team={m.away} fallback={m.awayFlag} className="h-5 w-7 rounded-sm object-cover" /></div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm font-semibold"><span className="inline-flex items-center gap-2"><TeamFlag team={m.home} fallback={m.homeFlag} className="h-4 w-6 rounded-sm object-cover" /> {m.home}</span><span className="text-xs font-normal text-muted-foreground">vs</span><span className="inline-flex items-center gap-2">{m.away} <TeamFlag team={m.away} fallback={m.awayFlag} className="h-4 w-6 rounded-sm object-cover" /></span></div>
            )}
          </div>
        ))}
        {next.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-background/20 p-6 text-sm text-muted-foreground">No upcoming matches yet.</div>}
      </div>
      <Link href="/matches" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm font-medium transition hover:bg-muted">View all matches <ArrowRight className="h-4 w-4" /></Link>
    </section>
  );
}

function GroupInfoCard({ group }: { group: Group | null }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-lg font-semibold tracking-tight">Current group</h2>
      <p className="mt-1 text-sm text-muted-foreground">Share these details with other players so they can join your private leaderboard.</p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-card text-primary shadow-card"><Users className="h-4 w-4" /></div>
          <div><div className="text-xs text-muted-foreground">Group name</div><div className="text-sm font-semibold">{group?.name ?? "No group selected"}</div></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-card text-gold shadow-card"><KeyRound className="h-4 w-4" /></div>
          <div><div className="text-xs text-muted-foreground">Join details</div><div className="text-sm font-semibold">ID {group?.id ?? "-"} · Code {group?.joinCode ?? "-"}</div></div>
        </div>
      </div>
    </section>
  );
}
