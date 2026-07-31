export interface Team {
  id: string;
  name: string;
  players: string[];
}

export interface MatchState {
  currentMatchId: string;
  category: string;
  stage: string;
  teamA: string;
  teamB: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  server: 1 | 2;
  serving?: 1 | 2;
  isTrump: boolean;
  trumpTeam: 1 | 2 | null;
}

export const INITIAL_MATCH: MatchState = {
  currentMatchId: 'tc-1',
  category: 'Team Championship',
  stage: 'Group Stage',
  teamA: 'Team A',
  teamB: 'Team B',
  player1: 'Nitin Verma',
  player2: 'Sambit Mahapatra',
  score1: 0,
  score2: 0,
  server: 1,
  serving: 1,
  isTrump: false,
  trumpTeam: null
};

export interface Team {
  id: string;
  name: string;
  players: string[];
}

export interface Fixture {
  id: string;
  date: string;
  time: string;
  category: string;
  stage: string;
  details: string;
  teamA?: string;
  teamB?: string;
}

export const TEAMS: Team[] = [
  {
    id: 'team-a',
    name: 'Team A',
    players: ['Nitin Verma', 'Prateek Anand', 'Rup Chitrak', 'Anirudh', 'Manmohan']
  },
  {
    id: 'team-b',
    name: 'Team B',
    players: ['Sambit Mahapatra', 'Vinamara', 'Kumar Abhishek', 'Rumit Sehlot', 'Dinesh']
  },
  {
    id: 'team-c',
    name: 'Team C',
    players: ['Shaunak', 'Sanchit', 'Samik', 'Mayank Sehlot', 'Deepti Bapat']
  },
  {
    id: 'team-d',
    name: 'Team D',
    players: ['Abhishek Modi', 'Satish', 'Vishwajeet', 'Manila', 'Naman']
  },
  {
    id: 'team-e',
    name: 'Team E',
    players: ['Vikash Srivastava', 'Anupam', 'Mihir', 'Dhanashree']
  }
];

export interface MatchState {
  currentMatchId: string;
  category: string;
  stage: string;
  teamA: string;
  teamB: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  server: 1 | 2;
  isTrump: boolean;
  trumpTeam: 1 | 2 | null;
}

export const INITIAL_MATCH: MatchState = {
  currentMatchId: 'tc-1',
  category: 'Team Championship',
  stage: 'Group Stage',
  teamA: 'Team A',
  teamB: 'Team B',
  player1: 'Nitin Verma',
  player2: 'Sambit Mahapatra',
  score1: 0,
  score2: 0,
  server: 1,
  isTrump: false,
  trumpTeam: null
};
