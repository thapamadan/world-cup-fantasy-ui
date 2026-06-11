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
  submitted?: boolean;
  result?: { home: number; away: number };
  pointsEarned?: number;
};

export type MemberPrediction = {
  matchId: string;
  predicted: { home: number; away: number; winner?: "home" | "away" | "draw" };
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
  userId: number;
  rank: number;
  name: string;
  initials: string;
  points: number;
  movement: number;
  exactScores: number;
  predictionCount: number;
  isMe?: boolean;
};

export type MemberPredictionsResponse = {
  member: AuthUser;
  predictions: MemberPrediction[];
};

export type UserPredictionsResponse = {
  predictions: MemberPrediction[];
};

export type TeamOption = {
  name: string;
  flag: string;
};

export type WinnerPrediction = {
  teams: TeamOption[];
  selectedTeam?: string | null;
  selectedFlag?: string | null;
  locked: boolean;
  lockAt?: string | null;
  winningTeam?: string | null;
  winningFlag?: string | null;
  pointsAwarded?: number | null;
};
