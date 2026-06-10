import type { AuthSession, Group } from "@/lib/types";

let currentSession: AuthSession | null = null;
let activeGroup: Group | null = null;

const SESSION_STORAGE_KEY = "wow_predictor_session";
const ACTIVE_GROUP_STORAGE_KEY = "wow_predictor_active_group";

function readStorageItem<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeStorageItem(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageItem(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}

export function getSession(): AuthSession | null {
  if (!currentSession) {
    currentSession = readStorageItem<AuthSession>(SESSION_STORAGE_KEY);
  }
  return currentSession;
}

export function setSession(session: AuthSession) {
  currentSession = session;
  writeStorageItem(SESSION_STORAGE_KEY, session);
}

export function clearSession() {
  currentSession = null;
  removeStorageItem(SESSION_STORAGE_KEY);
}

export function getActiveGroup(): Group | null {
  if (!activeGroup) {
    activeGroup = readStorageItem<Group>(ACTIVE_GROUP_STORAGE_KEY);
  }
  return activeGroup;
}

export function setActiveGroup(group: Group) {
  activeGroup = group;
  writeStorageItem(ACTIVE_GROUP_STORAGE_KEY, group);
}

export function clearActiveGroup() {
  activeGroup = null;
  removeStorageItem(ACTIVE_GROUP_STORAGE_KEY);
}
