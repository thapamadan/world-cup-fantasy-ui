"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, Plus, Trophy, Users } from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { createGroup, fetchMe, getApiErrorMessage, joinGroup } from "@/lib/api";
import { clearActiveGroup, clearSession, getSession, setActiveGroup, setSession } from "@/lib/auth";
import { prefetchGroupHistory } from "@/lib/group-history-prefetch";

export default function GroupsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [groupName, setGroupName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (getSession()) return;

    fetchMe()
      .then((response) => {
        if (!cancelled) {
          setSession({ token: "cookie-session", user: response.user });
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          clearActiveGroup();
          router.push("/");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const enterGroup = (group: {
    id: number;
    name: string;
    joinCode: string;
    memberCount: number;
  }) => {
    setActiveGroup(group);
    void prefetchGroupHistory(group.id);
    router.push("/dashboard");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmittingCreate(true);
    try {
      const response = await createGroup({ name: groupName, join_code: createCode.toUpperCase() });
      setGroupName("");
      setCreateCode("");
      enterGroup(response.group);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmittingJoin(true);
    try {
      const response = await joinGroup({ join_code: joinCode.toUpperCase() });
      setJoinCode("");
      enterGroup(response.group);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmittingJoin(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="overflow-hidden rounded-3xl bg-hero-gradient p-8 text-primary-foreground shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur">
                <Users className="h-3.5 w-3.5 text-gold" /> Private group mode
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                Create a group or join one with code
              </h1>
              <p className="mt-2 text-sm text-primary-foreground/70">
                Every group has its own leaderboard. Create a room for friends and let others join
                it with the group code.
              </p>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold-gradient shadow-gold">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
          </div>
        </section>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        <div className="mx-auto mt-8 max-w-3xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex items-center gap-3 rounded-2xl border p-5 text-left transition ${mode === "create" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-ring/40"}`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${mode === "create" ? "bg-white/15" : "bg-gold/15 text-gold"}`}
              >
                <Plus className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-lg font-semibold">Create group</span>
                <span
                  className={`block text-sm ${mode === "create" ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                >
                  Start a new private leaderboard
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex items-center gap-3 rounded-2xl border p-5 text-left transition ${mode === "join" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-ring/40"}`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${mode === "join" ? "bg-white/15" : "bg-primary/10 text-primary"}`}
              >
                <KeyRound className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-lg font-semibold">Join group</span>
                <span
                  className={`block text-sm ${mode === "join" ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                >
                  Use the group code
                </span>
              </span>
            </button>
          </div>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
            {mode === "create" ? (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold tracking-tight">Create group</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your group name and choose a unique group code.
                  </p>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Field
                    label="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Weekend Champions"
                    required
                  />
                  <Field
                    label="Group code"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    placeholder="A1B2C3"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
                  >
                    {submittingCreate ? "Creating..." : "Create group"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold tracking-tight">Join group</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the group code to join. Group names do not need to match.
                  </p>
                </div>
                <form onSubmit={handleJoin} className="space-y-4">
                  <Field
                    label="Group code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="A1B2C3"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingJoin}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
                  >
                    {submittingJoin ? "Joining..." : "Join group"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/0 transition focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}
