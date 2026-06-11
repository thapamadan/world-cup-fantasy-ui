"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { TeamFlag } from "@/components/TeamFlag";
import { fetchMatches } from "@/lib/api";
import { leaderboard } from "@/lib/mock-data";
import type { Match } from "@/lib/types";
import { formatMatchDateTimeNepal } from "@/lib/utils";

const tabs = ["Overview", "Matches", "Users"] as const;
type Tab = (typeof tabs)[number];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin panel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage tournament fixtures, users and results.
            </p>
          </div>
          <div className="inline-flex rounded-full bg-muted p-1 text-sm">
            {tabs.map((tabName) => (
              <button
                key={tabName}
                onClick={() => setTab(tabName)}
                className={`rounded-full px-4 py-1.5 font-medium transition ${tab === tabName ? "bg-card shadow-card" : "text-muted-foreground"}`}
              >
                {tabName}
              </button>
            ))}
          </div>
        </header>

        {tab === "Overview" && <Overview />}
        {tab === "Matches" && <Matches />}
        {tab === "Users" && <UsersTab />}
      </main>
    </div>
  );
}

function Overview() {
  const stats = [
    { icon: Users, label: "Total users", value: "48", hint: "+3 this week" },
    { icon: ListChecks, label: "Total predictions", value: "612", hint: "+82 this week" },
    { icon: CalendarDays, label: "Upcoming matches", value: "12" },
    { icon: Trophy, label: "Completed matches", value: "26" },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground">
              <stat.icon className="h-4 w-4" />
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
              {stat.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stat.label}
              {stat.hint && (
                <>
                  {" "}
                  · <span className="text-success">{stat.hint}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <h3 className="text-lg font-semibold tracking-tight">Scoring system</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-xl bg-gold/10 px-4 py-3">
              <span>Exact score</span>
              <span className="font-semibold text-gold">3 pts</span>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <span>Correct team prediction</span>
              <span className="font-semibold">1 pt</span>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <span>Correct draw prediction</span>
              <span className="font-semibold">1 pt</span>
            </li>
          </ul>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <h3 className="text-lg font-semibold tracking-tight">Privacy</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Predictions are private until you close a match&apos;s results. Only aggregated
            leaderboard data is public to employees.
          </p>
        </div>
      </div>
    </>
  );
}

function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMatches()
      .then((response) => {
        if (!cancelled) {
          setMatches(response.matches);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Match management</h2>
          <p className="text-sm text-muted-foreground">
            Add fixtures, set deadlines and enter final scores.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95">
          <Plus className="h-4 w-4" /> Add match
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Match</th>
              <th className="px-4 py-3 text-left font-medium">Kickoff</th>
              <th className="px-4 py-3 text-left font-medium">Deadline</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matches.map((match) => {
              const matchTime = formatMatchDateTimeNepal(match.kickoffAt);

              return (
                <tr key={match.id} className="bg-card">
                  <td className="px-4 py-3 font-medium">
                    <TeamFlag
                      team={match.home}
                      fallback={match.homeFlag}
                      className="mr-1 inline-block h-4 w-6 rounded-sm object-cover align-middle"
                    />{" "}
                    {match.home} <span className="text-muted-foreground">vs</span> {match.away}{" "}
                    <TeamFlag
                      team={match.away}
                      fallback={match.awayFlag}
                      className="ml-1 inline-block h-4 w-6 rounded-sm object-cover align-middle"
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {matchTime.date} · {matchTime.kickoff}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">Locks {match.deadline}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-warning">
                      Upcoming
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersTab() {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            Search, audit predictions, remove accounts.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search users..."
            className="w-64 rounded-xl border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Rank</th>
              <th className="px-4 py-3 text-left font-medium">Points</th>
              <th className="px-4 py-3 text-left font-medium">Exact</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leaderboard.map((user) => (
              <tr key={user.rank} className="bg-card">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {user.initials}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">#{user.rank}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{user.points}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{user.exactScores}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button className="rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      View history
                    </button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
