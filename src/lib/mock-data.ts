export const currentUser = {
  name: "Ravi Kumar",
  email: "ravi@wowfinstack.com",
  initials: "RK",
  points: 42,
  rank: 4,
  accuracy: 68,
  exactScores: 5,
  correctWinners: 17,
  streak: 6,
  pointsBehindNext: 3,
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  initials: string;
  points: number;
  movement: number;
  exactScores: number;
  isMe?: boolean;
};

export const leaderboard: LeaderboardRow[] = [
  { rank: 1, name: "Ram Patel", initials: "RP", points: 58, movement: 2, exactScores: 9 },
  { rank: 2, name: "Sita Sharma", initials: "SS", points: 51, movement: -1, exactScores: 7 },
  { rank: 3, name: "John Mathew", initials: "JM", points: 45, movement: 5, exactScores: 6 },
  { rank: 4, name: "Ravi Kumar", initials: "RK", points: 42, movement: 1, exactScores: 5, isMe: true },
  { rank: 5, name: "Aisha Khan", initials: "AK", points: 40, movement: 0, exactScores: 4 },
  { rank: 6, name: "David Chen", initials: "DC", points: 38, movement: -2, exactScores: 4 },
  { rank: 7, name: "Priya Nair", initials: "PN", points: 35, movement: 3, exactScores: 3 },
  { rank: 8, name: "Marco Rossi", initials: "MR", points: 32, movement: -1, exactScores: 3 },
  { rank: 9, name: "Hana Tanaka", initials: "HT", points: 29, movement: 4, exactScores: 2 },
  { rank: 10, name: "Liam O'Brien", initials: "LO", points: 27, movement: -3, exactScores: 2 },
];

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
  predicted?: { home: number; away: number };
  result?: { home: number; away: number };
};

export const upcomingMatches: Match[] = [
  { id: "m1", home: "Argentina", away: "Brazil", homeFlag: "🇦🇷", awayFlag: "🇧🇷", date: "Tomorrow", kickoff: "20:00", deadline: "in 23h", status: "upcoming", predicted: { home: 2, away: 1 } },
  { id: "m2", home: "France", away: "Germany", homeFlag: "🇫🇷", awayFlag: "🇩🇪", date: "In 2 days", kickoff: "21:00", deadline: "in 2 days", status: "upcoming" },
  { id: "m3", home: "England", away: "Spain", homeFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", awayFlag: "🇪🇸", date: "In 4 days", kickoff: "19:30", deadline: "in 4 days", status: "upcoming" },
  { id: "m4", home: "Portugal", away: "Netherlands", homeFlag: "🇵🇹", awayFlag: "🇳🇱", date: "In 5 days", kickoff: "20:00", deadline: "in 5 days", status: "upcoming" },
  { id: "m5", home: "Belgium", away: "Croatia", homeFlag: "🇧🇪", awayFlag: "🇭🇷", date: "In 6 days", kickoff: "18:00", deadline: "in 6 days", status: "upcoming" },
];

export type RecentPrediction = {
  match: string;
  predicted: string;
  actual: string;
  points: number;
  status: "exact" | "winner" | "lost" | "pending";
};

export const recentPredictions: RecentPrediction[] = [
  { match: "Argentina vs Mexico", predicted: "2 - 0", actual: "2 - 0", points: 5, status: "exact" },
  { match: "Japan vs Germany", predicted: "1 - 2", actual: "2 - 1", points: 0, status: "lost" },
  { match: "Brazil vs Serbia", predicted: "2 - 1", actual: "2 - 0", points: 1, status: "winner" },
  { match: "Spain vs Costa Rica", predicted: "3 - 0", actual: "7 - 0", points: 1, status: "winner" },
  { match: "France vs Australia", predicted: "3 - 1", actual: "4 - 1", points: 1, status: "winner" },
];

export const movers = {
  biggestClimber: { name: "John Mathew", change: 5 },
  mostExactScores: { name: "Ram Patel", count: 9 },
  accuracyChampion: { name: "Sita Sharma", value: 74 },
};
