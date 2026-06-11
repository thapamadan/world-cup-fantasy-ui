import type { AuthUser, Match } from "@/lib/types";

export const MY_PREDICTIONS_CACHE_KEY = "my-predictions";
export const WINNER_PREDICTION_CACHE_KEY = "winner-prediction";

export type MemberPredictionsCache = {
  member: AuthUser;
  predictions: Match[];
};

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
