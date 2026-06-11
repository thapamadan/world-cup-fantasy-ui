"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { logout } from "@/lib/api";
import type { Group, AuthSession } from "@/lib/types";
import { clearActiveGroup, clearSession, getActiveGroup, getSession } from "@/lib/auth";
import { BRAND_SUBTITLE, BRAND_TITLE } from "@/lib/branding";

export function AppNavbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [activeGroup, setActiveGroupState] = useState<Group | null>(null);

  useEffect(() => {
    setSessionState(getSession());
    setActiveGroupState(getActiveGroup());
  }, []);

  const sessionName = session?.user.name ?? "Guest User";
  const sessionEmail = session?.user.email ?? "guest@example.com";
  const sessionInitials = session?.user.initials ?? "GU";
  const groupName = activeGroup?.name ?? "No group selected";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearSession();
      clearActiveGroup();
      setSessionState(null);
      setActiveGroupState(null);
      setMenuOpen(false);
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-gradient shadow-gold">
            <Trophy className="h-4 w-4 text-primary" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-foreground">
              {BRAND_TITLE}
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {BRAND_SUBTITLE}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium text-foreground">{sessionName}</div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {sessionInitials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-border bg-card p-4 shadow-elevated">
                <div className="border-b border-border pb-3">
                  <div className="text-sm font-semibold text-foreground">{sessionName}</div>
                  <div className="text-xs text-muted-foreground">{sessionEmail}</div>
                </div>
                <div className="py-3">
                  <div className="text-xs text-muted-foreground">Current group</div>
                  <div className="text-sm font-medium text-foreground">{groupName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/change-password");
                  }}
                  className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Change password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
