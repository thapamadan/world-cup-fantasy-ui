import type { AuthSession, Group } from "@/lib/types";

let currentSession: AuthSession | null = null;
let activeGroup: Group | null = null;

export function getSession(): AuthSession | null {
  return currentSession;
}

export function setSession(session: AuthSession) {
  currentSession = session;
}

export function clearSession() {
  currentSession = null;
}

export function getActiveGroup(): Group | null {
  return activeGroup;
}

export function setActiveGroup(group: Group) {
  activeGroup = group;
}

export function clearActiveGroup() {
  activeGroup = null;
}
