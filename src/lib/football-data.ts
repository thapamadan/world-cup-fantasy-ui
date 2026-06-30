import { WORLD_CUP_TEAMS } from "@/lib/world-cup";
import type { Match } from "@/lib/types";

const FOOTBALL_DATA_MATCHES_BASE_URL = "https://api.football-data.org/v4/competitions/WC/matches";

const FINISHED_SOURCE_STATUSES = new Set(["FINISHED", "AWARDED"]);
const LIVE_SOURCE_STATUSES = new Set(["IN_PLAY", "PAUSED", "SUSPENDED"]);

const teamFlags = new Map(WORLD_CUP_TEAMS.map((team) => [team.name, team.flag]));

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
    regularTime?: { home?: number | null; away?: number | null };
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

// football-data.org reports a shootout match's `fullTime` as the on-pitch score
// combined with the penalty tally (a 1-1 won 3-2 on penalties comes back as
// fullTime 4-3 with penalties 3-2). Subtract the penalties back out, in place,
// so `fullTime` holds the real score and stays separate from the shootout. The
// guards make it safe and idempotent: it only touches actual shootouts and skips
// the subtraction if either side would go negative (which is what a feed that has
// already separated the two looks like), so re-running it never corrupts a value.
function excludeShootoutPenalties(score: NonNullable<FootballDataMatch["score"]>) {
  if ((score.duration || "").toUpperCase() !== "PENALTY_SHOOTOUT") {
    return;
  }
  const fullTime = score.fullTime;
  const penalties = score.penalties;
  if (
    fullTime?.home == null ||
    fullTime.away == null ||
    penalties?.home == null ||
    penalties.away == null
  ) {
    return;
  }
  const strippedHome = Number(fullTime.home) - Number(penalties.home);
  const strippedAway = Number(fullTime.away) - Number(penalties.away);
  if (strippedHome < 0 || strippedAway < 0) {
    return;
  }
  fullTime.home = strippedHome;
  fullTime.away = strippedAway;
}

function resolveResult(match: FootballDataMatch) {
  const score = match.score;
  if (!score) {
    return undefined;
  }

  // Pull the penalty shootout out of fullTime so it holds the actual on-pitch
  // score, then read fullTime first as it now carries the clean final score.
  excludeShootoutPenalties(score);

  for (const candidate of [score.fullTime, score.regularTime, score.extraTime, score.halfTime]) {
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

function resolveWinnerTeam(
  match: FootballDataMatch,
  home: string,
  away: string,
  result: { home: number; away: number } | undefined,
): string | null {
  const winner = match.score?.winner;
  if (winner) {
    const value = String(winner).toUpperCase();
    if (value === "HOME_TEAM") {
      return home;
    }
    if (value === "AWAY_TEAM") {
      return away;
    }
    if (value === "DRAW") {
      return null;
    }
  }
  if (!result) {
    return null;
  }
  if (result.home > result.away) {
    return home;
  }
  if (result.away > result.home) {
    return away;
  }
  return null;
}

// Express the shootout winner as a side so the UI can highlight it. In a
// shootout the overall winner is the side that converted more penalties, so
// reuse the already-resolved winnerTeam, falling back to the penalty tally.
function resolveShootoutWinner(
  match: FootballDataMatch,
  home: string,
  away: string,
  wentToShootout: boolean,
  winnerTeam: string | null,
): "home" | "away" | null {
  if (!wentToShootout) {
    return null;
  }
  if (winnerTeam === home) {
    return "home";
  }
  if (winnerTeam === away) {
    return "away";
  }
  const penalties = match.score?.penalties;
  if (penalties?.home != null && penalties.away != null) {
    if (Number(penalties.home) > Number(penalties.away)) {
      return "home";
    }
    if (Number(penalties.away) > Number(penalties.home)) {
      return "away";
    }
  }
  return null;
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

  const result = resolveResult(match);
  const wentToShootout = resolveWentToShootout(match);
  const winnerTeam = resolveWinnerTeam(match, home, away, result);
  const shootoutWinner = resolveShootoutWinner(match, home, away, wentToShootout, winnerTeam);

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
    result,
    stage: match.stage,
    group: match.group ?? null,
    wentToShootout,
    shootoutWinner,
    winnerTeam,
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
