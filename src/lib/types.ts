export type PredictedScore = {
  home: number;
  away: number;
  winner?: "home" | "away" | "draw";
  shootoutWinner?: "home" | "away" | null;
};

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
  predicted?: PredictedScore;
  submitted?: boolean;
  result?: { home: number; away: number };
  pointsEarned?: number;
  shootoutBonus?: number;
  wentToShootout?: boolean;
  matchday?: number | null;
  stage?: string;
  group?: string | null;
};

export function isKnockoutStage(stage?: string | null) {
  if (!stage) return false;
  const upper = stage.toUpperCase();
  return !upper.includes("GROUP");
}

export type MemberPrediction = {
  matchId: string;
  predicted: PredictedScore;
  pointsEarned?: number;
  shootoutBonus?: number;
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
  matchPoints?: number;
  shootoutBonus?: number;
  progressionPoints?: number;
  isMe?: boolean;
};

export type KnockoutPickStatus = "correct" | "eliminated" | "active";

export type KnockoutTeamStatus = {
  name: string;
  flag: string;
  status: KnockoutPickStatus;
};

export type KnockoutProgressionPoints = {
  quarterfinalPoints: number;
  semifinalPoints: number;
  finalPoints: number;
  championPoints: number;
  total: number;
};

export type KnockoutPrediction = {
  teams: TeamOption[];
  quarterfinalists: KnockoutTeamStatus[];
  semifinalists: KnockoutTeamStatus[];
  finalists: KnockoutTeamStatus[];
  champion: KnockoutTeamStatus | null;
  locked: boolean;
  lockAt?: string | null;
  points: KnockoutProgressionPoints;
  maxQuarterfinalists: number;
  maxSemifinalists: number;
  maxFinalists: number;
};

export type MemberPredictionsResponse = {
  member: AuthUser;
  predictions: Match[];
  knockout?: KnockoutPrediction;
};

export type UserPredictionsResponse = {
  predictions: MemberPrediction[];
};

export type GroupHistoryPrediction = {
  userId: number;
  name: string;
  initials: string;
  predicted: PredictedScore;
  pointsEarned?: number;
  shootoutBonus?: number;
  isMe?: boolean;
};

export type GroupHistoryItem = {
  match: Match;
  predictions: GroupHistoryPrediction[];
};

export type GroupHistoryMember = {
  userId: number;
  name: string;
  initials: string;
  isMe?: boolean;
};

export type GroupHistoryResponse = {
  group: Group;
  members: GroupHistoryMember[];
  items: GroupHistoryItem[];
  playedMatches?: number;
  totalMatches?: number;
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
