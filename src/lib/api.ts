import { getSession } from "@/lib/auth";
import type {
  AuthSession,
  Group,
  LeaderboardRow,
  Match,
  MemberPredictionsResponse,
  UserPredictionsResponse,
  WinnerPrediction,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function normalizeOrigin(origin: string | undefined) {
  return origin?.trim().replace(/\/$/, "") ?? "";
}

export function getConfiguredPublicAppOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_ORIGIN);
}

function getAuthHeaderToken(token: string | null | undefined) {
  if (!token || token === "cookie-session") {
    return null;
  }

  return token;
}

function resolveApiBases() {
  const bases = new Set<string>();

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    bases.add(process.env.NEXT_PUBLIC_API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    const { origin, protocol, hostname } = window.location;
    bases.add(origin);
    // Prefer the current host's backend directly as fallback.
    bases.add(`${protocol}//${hostname}:8000`);
  }

  bases.add("http://127.0.0.1:8000");
  bases.add("http://localhost:8000");

  return Array.from(bases);
}

const API_BASES = resolveApiBases();

export function getPreferredApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return API_BASES[0] ?? "http://127.0.0.1:8000";
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

function normalizeApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          const fieldPath =
            "loc" in item && Array.isArray(item.loc)
              ? item.loc
                  .filter(
                    (part: unknown): part is string | number =>
                      typeof part === "string" || typeof part === "number",
                  )
                  .slice(1)
                  .join(".")
              : "";
          return fieldPath ? `${fieldPath}: ${item.msg}` : item.msg;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item))
      .join(", ");
  }

  if (detail && typeof detail === "object" && "msg" in detail && typeof detail.msg === "string") {
    return detail.msg;
  }

  return "Request failed";
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let lastError: unknown = null;
  const sessionToken = getAuthHeaderToken(options.token ?? getSession()?.token ?? null);

  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: options.method ?? "GET",
        cache: options.method && options.method !== "GET" ? "no-store" : "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
        throw new ApiError(
          response.status,
          payload
            ? normalizeApiDetail(payload.detail)
            : `${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
      if (!(error instanceof TypeError)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Request failed");
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "Cannot reach the backend API. Start the Python server and try again.";
  }
  if (error instanceof Error) {
    return error.message === "Request failed"
      ? "Cannot reach the backend API. Start the Python server and try again."
      : error.message;
  }
  return "Request failed";
}

export async function signup(input: { name: string; email: string; password: string }) {
  return apiFetch<AuthSession>("/api/auth/signup", { method: "POST", body: input });
}

export async function login(input: { email: string; password: string }) {
  return apiFetch<AuthSession>("/api/auth/login", { method: "POST", body: input });
}

export async function googleAuth(input: { credential: string }) {
  return apiFetch<AuthSession>("/api/auth/google", { method: "POST", body: input });
}

export async function logout() {
  return apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(token?: string | null) {
  return apiFetch<{
    user: AuthSession["user"];
    points: {
      totalPoints: number;
      exactScores: number;
      predictionCount: number;
      scoredPredictionCount: number;
    };
  }>("/api/me", { token });
}

export async function sendPasswordResetOtp(input: { email: string }) {
  return apiFetch<{ message: string }>("/api/auth/forgot-password/otp", {
    method: "POST",
    body: input,
  });
}

export async function forgotPassword(input: { email: string; otp: string; new_password: string }) {
  return apiFetch<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: input,
  });
}

export async function changePassword(input: { current_password: string; new_password: string }) {
  return apiFetch<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    body: input,
  });
}

export async function fetchMatches() {
  return apiFetch<{ matches: Match[] }>("/api/matches");
}

export async function fetchWinnerPrediction() {
  return apiFetch<WinnerPrediction>("/api/predictions/winner");
}

export async function fetchMyPredictions() {
  return apiFetch<UserPredictionsResponse>("/api/predictions");
}

export async function saveWinnerPrediction(input: { team_name: string }) {
  return apiFetch<{ message: string; prediction: WinnerPrediction }>("/api/predictions/winner", {
    method: "POST",
    body: input,
  });
}

export async function savePrediction(input: {
  match_id: string;
  home_score: number;
  away_score: number;
  winner?: "home" | "away" | "draw";
}) {
  return apiFetch<{
    message: string;
    prediction: { match_id: string; home: number; away: number };
  }>("/api/predictions", {
    method: "POST",
    body: {
      match_id: input.match_id,
      home_score: input.home_score,
      away_score: input.away_score,
      winner: input.winner,
    },
  });
}

export async function createGroup(input: { name: string; join_code: string }) {
  return apiFetch<{ group: Group }>("/api/groups", { method: "POST", body: input });
}

export async function joinGroup(input: { group_name?: string; join_code: string }) {
  return apiFetch<{ group: Group }>("/api/groups/join", { method: "POST", body: input });
}

export async function fetchMyGroups() {
  return apiFetch<{ groups: Group[] }>("/api/groups/mine");
}

export async function fetchGroupLeaderboard(groupId: number) {
  return apiFetch<{ group: Group; leaderboard: LeaderboardRow[] }>(
    `/api/groups/${groupId}/leaderboard`,
  );
}

export async function fetchGroupMemberPredictions(groupId: number, memberId: number) {
  return apiFetch<MemberPredictionsResponse>(
    `/api/groups/${groupId}/members/${memberId}/predictions`,
  );
}
