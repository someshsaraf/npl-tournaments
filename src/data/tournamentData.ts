export interface MatchState {
  matchId: string;
  category: string;
  stage: string;
  matchTitle: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  serving: 1 | 2;
  isTrump: boolean;
  targetPoints: number;
  isFinished: boolean;
}

export const INITIAL_MATCH: MatchState = {
  matchId: "court_1",
  category: "Team Championship",
  stage: "Group Stage",
  matchTitle: "Team A vs Team B (Match 1)",
  player1: "Nitin Verma",
  player2: "Sambit Mahapatra",
  score1: 0,
  score2: 0,
  serving: 1,
  isTrump: false,
  targetPoints: 15,
  isFinished: false
};
