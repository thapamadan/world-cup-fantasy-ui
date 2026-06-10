export type Match = {
  id: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  date: string;
  kickoff: string;
  deadline: string;
  status: "upcoming" | "live" | "finished";
  kickoffAt: string;
  predicted?: { home: number; away: number; winner?: "home" | "away" | "draw" };
  result?: { home: number; away: number };
  pointsEarned?: number;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  initials: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type Group = {
  id: number;
  name: string;
  joinCode: string;
  memberCount: number;
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  initials: string;
  points: number;
  movement: number;
  exactScores: number;
  predictionCount: number;
  isMe?: boolean;
};
