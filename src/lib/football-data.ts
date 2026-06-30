import { WORLD_CUP_TEAMS } from "@/lib/world-cup";
import type { Match } from "@/lib/types";

const FOOTBALL_DATA_MATCHES_BASE_URL = "https://api.football-data.org/v4/competitions/WC/matches";

const FINISHED_SOURCE_STATUSES = new Set(["FINISHED", "AWARDED"]);
const LIVE_SOURCE_STATUSES = new Set(["IN_PLAY", "PAUSED", "SUSPENDED"]);

const teamFlags = new Map(WORLD_CUP_TEAMS.map((team) => [team.name, team.flag]));

// Manual corrections for finished matches the upstream feed reports incompletely.
// Mirrors MATCH_RESULT_OVERRIDES in the backend (app/matches.py): Netherlands vs
// Morocco (537418) actually finished 1-1 with Morocco advancing on penalties, but
// football-data.org returns 0-0 with no shootout winner. Remove once the feed is
// fixed upstream.
const MATCH_RESULT_OVERRIDES: Record<
  string,
  { result: { home: number; away: number }; wentToShootout: boolean; shootoutWinner: "home" | "away" | null; winnerTeam: string }
> = {
  "537418": {
    result: { home: 1, away: 1 },
    wentToShootout: true,
    shootoutWinner: "away",
    winnerTeam: "Morocco",
  },
};

type FootballDataMatch = {
  id?: number | string;
  utcDate?: string;
  status?: string;
  stage?: string;
  group?: string | null;
  homeTeam?: {
    name?: string;
    shortName?: string;
  };
  awayTeam?: {
    name?: string;
    shortName?: string;
  };
  score?: {
    winner?: string | null;
    duration?: string | null;
    fullTime?: { home?: number | null; away?: number | null };
    halfTime?: { home?: number | null; away?: number | null };
    extraTime?: { home?: number | null; away?: number | null };
    penalties?: { home?: number | null; away?: number | null };
  };
};

type FootballDataQuery = {
  dateFrom?: string;
  dateTo?: string;
};

function getApiKey() {
  return process.env.FOOTBALL_DATA_API_KEY?.trim() || "";
}

function getApiHeaderName() {
  return process.env.FOOTBALL_DATA_API_HEADER?.trim() || "X-Auth-Token";
}

function resolveTeamName(
  team: FootballDataMatch["homeTeam"] | FootballDataMatch["awayTeam"],
  fallback: string,
) {
  return team?.name || team?.shortName || fallback;
}

function resolveResult(match: FootballDataMatch) {
  const score = match.score;
  if (!score) {
    return undefined;
  }

  for (const candidate of [score.extraTime, score.fullTime, score.halfTime]) {
    if (candidate?.home != null && candidate.away != null) {
      return { home: Number(candidate.home), away: Number(candidate.away) };
    }
  }

  return undefined;
}

function resolveWentToShootout(match: FootballDataMatch) {
  const score = match.score;
  if (!score) {
    return false;
  }
  if ((score.duration || "").toUpperCase() === "PENALTY_SHOOTOUT") {
    return true;
  }
  return score.penalties?.home != null && score.penalties.away != null;
}

function resolveStatus(match: FootballDataMatch, kickoffAt: Date) {
  const sourceStatus = (match.status || "").toUpperCase();
  if (FINISHED_SOURCE_STATUSES.has(sourceStatus)) {
    return "finished" as const;
  }
  if (LIVE_SOURCE_STATUSES.has(sourceStatus)) {
    return "live" as const;
  }
  return kickoffAt.getTime() > Date.now() ? ("upcoming" as const) : ("live" as const);
}

function resolveDeadlineLabel(status: Match["status"], kickoffAt: Date) {
  if (status === "finished") {
    return "full time";
  }
  if (status === "live") {
    return "live";
  }

  const diffMs = kickoffAt.getTime() - Date.now();
  if (diffMs <= 15 * 60 * 1000) {
    return "locked";
  }

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (totalHours < 48) {
    return `in ${totalHours}h`;
  }

  return `in ${Math.floor(totalHours / 24)} days`;
}

function mapFootballDataMatch(match: FootballDataMatch): Match | null {
  if (!match.utcDate) {
    return null;
  }

  const home = resolveTeamName(match.homeTeam, "Home TBD");
  const away = resolveTeamName(match.awayTeam, "Away TBD");
  const kickoffAt = new Date(match.utcDate);
  const status = resolveStatus(match, kickoffAt);
  const id = String(match.id ?? `${home}-${away}-${match.utcDate}`);
  const override = status === "finished" ? MATCH_RESULT_OVERRIDES[id] : undefined;

  return {
    id,
    home,
    away,
    homeFlag: teamFlags.get(home) ?? "",
    awayFlag: teamFlags.get(away) ?? "",
    date: kickoffAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
    kickoff: kickoffAt.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }),
    deadline: resolveDeadlineLabel(status, kickoffAt),
    status,
    kickoffAt: match.utcDate,
    result: override?.result ?? resolveResult(match),
    stage: match.stage,
    group: match.group ?? null,
    wentToShootout: override?.wentToShootout ?? resolveWentToShootout(match),
    shootoutWinner: override?.shootoutWinner ?? null,
    winnerTeam: override?.winnerTeam ?? null,
  };
}

export function getDirectMatchesErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load matches.";
}

function buildFootballDataMatchesUrl(query: FootballDataQuery = {}) {
  const searchParams = new URLSearchParams({ season: "2026" });
  return `${FOOTBALL_DATA_MATCHES_BASE_URL}?${searchParams.toString()}`;
}

function matchesDateFilter(match: Match, query: FootballDataQuery) {
  const matchDate = match.kickoffAt.slice(0, 10);

  if (query.dateFrom && matchDate < query.dateFrom) {
    return false;
  }

  if (query.dateTo && matchDate > query.dateTo) {
    return false;
  }

  return true;
}

export async function fetchFootballDataMatches(query: FootballDataQuery = {}) {
  const apiKey = getApiKey();
  const apiHeaderName = getApiHeaderName();
  if (!apiKey) {
    throw new Error("Missing FOOTBALL_DATA_API_KEY.");
  }

  const response = await fetch(buildFootballDataMatchesUrl(), {
    headers: {
      [apiHeaderName]: apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load matches from football-data.org: ${response.status}`);
  }

  const payload = (await response.json()) as { matches?: FootballDataMatch[] };
  const matches = Array.isArray(payload.matches)
    ? payload.matches.map(mapFootballDataMatch).filter((match): match is Match => match !== null)
    : [];

  return { matches: matches.filter((match) => matchesDateFilter(match, query)) };
}

export async function fetchMatchesFromProxy(query: FootballDataQuery = {}) {
  const searchParams = new URLSearchParams();

  if (query.dateFrom) {
    searchParams.set("dateFrom", query.dateFrom);
  }

  if (query.dateTo) {
    searchParams.set("dateTo", query.dateTo);
  }

  const queryString = searchParams.toString();
  const response = await fetch(
    `/api/football-data/matches${queryString ? `?${queryString}` : ""}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Failed to load matches: ${response.status}`);
  }

  return (await response.json()) as { matches: Match[] };
}
