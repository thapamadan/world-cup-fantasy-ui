import { cookies } from "next/headers";

import { MatchesPageClient } from "./MatchesPageClient";

import type { Match } from "@/lib/types";

const SESSION_COOKIE_NAME = "wow_predictor_session";

function normalizeOrigin(origin: string | undefined) {
  return origin?.trim().replace(/\/$/, "") ?? "";
}

async function loadMatchesOnServer() {
  const apiBase = normalizeOrigin(process.env.NEXT_PUBLIC_API_BASE_URL) || "http://127.0.0.1:8000";
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  try {
    const response = await fetch(`${apiBase}/api/matches`, {
      cache: "no-store",
      headers: sessionCookie ? { Cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to load matches: ${response.status}`);
    }

    const payload = (await response.json()) as { matches: Match[] };
    return { initialMatches: payload.matches, initialError: "" };
  } catch {
    return { initialMatches: [] as Match[], initialError: "Cannot reach the backend API. Start the Python server and try again." };
  }
}

export default async function MatchesPage() {
  const { initialMatches, initialError } = await loadMatchesOnServer();

  return <MatchesPageClient initialMatches={initialMatches} initialError={initialError} />;
}
