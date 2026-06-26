import type {
  AuthUser,
  Group,
  GroupHistoryResponse,
  KnockoutPrediction,
  LeaderboardRow,
  Match,
} from "@/lib/types";

export const MY_PREDICTIONS_CACHE_KEY = "my-predictions";
export const WINNER_PREDICTION_CACHE_KEY = "winner-prediction";
export const KNOCKOUT_PREDICTION_CACHE_KEY = "knockout-prediction";

export type MemberPredictionsCache = {
  member: AuthUser;
  predictions: Match[];
  knockout?: KnockoutPrediction;
};

export type DashboardLeaderboardCache = {
  group: Group;
  leaderboard: LeaderboardRow[];
};

function getGroupHistoryStorageKey(groupId: number) {
  return `wow_group_history_${groupId}`;
}

function getDashboardLeaderboardStorageKey(groupId: number) {
  return `wow_dashboard_leaderboard_v2_${groupId}`;
}

export function getDashboardLeaderboardCacheKey(groupId: number) {
  return `dashboard-leaderboard:v2:${groupId}`;
}

export function readDashboardLeaderboardCache(groupId: number) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getDashboardLeaderboardStorageKey(groupId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as DashboardLeaderboardCache;
  } catch {
    window.sessionStorage.removeItem(getDashboardLeaderboardStorageKey(groupId));
    return null;
  }
}

export function writeDashboardLeaderboardCache(groupId: number, value: DashboardLeaderboardCache) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getDashboardLeaderboardStorageKey(groupId), JSON.stringify(value));
}

export function readGroupHistoryCache(groupId: number) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getGroupHistoryStorageKey(groupId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as GroupHistoryResponse;
  } catch {
    window.sessionStorage.removeItem(getGroupHistoryStorageKey(groupId));
    return null;
  }
}

export function writeGroupHistoryCache(groupId: number, value: GroupHistoryResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getGroupHistoryStorageKey(groupId), JSON.stringify(value));
}

function getMemberPredictionsStorageKey(groupId: number, memberId: number) {
  return `wow_member_predictions_${groupId}_${memberId}`;
}

export function getGroupMemberPredictionsCacheKey(groupId: number, memberId: number) {
  return `group-member-predictions:${groupId}:${memberId}`;
}

export function readMemberPredictionsCache(groupId: number, memberId: number) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getMemberPredictionsStorageKey(groupId, memberId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as MemberPredictionsCache;
  } catch {
    window.sessionStorage.removeItem(getMemberPredictionsStorageKey(groupId, memberId));
    return null;
  }
}

export function writeMemberPredictionsCache(
  groupId: number,
  memberId: number,
  value: MemberPredictionsCache,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    getMemberPredictionsStorageKey(groupId, memberId),
    JSON.stringify(value),
  );
}

export function clearMemberPredictionsCache(groupId: number, memberId: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getMemberPredictionsStorageKey(groupId, memberId));
}
