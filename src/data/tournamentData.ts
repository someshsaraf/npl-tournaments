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
  maxPoints: 11 | 21;
  server: 1 | 2; // 1 = Team A serving, 2 = Team B serving
  servingSide: 'right' | 'left'; // Even score = Right, Odd score = Left
  deuceActive: boolean;
  gameWinner: 1 | 2 | null;
  isTrump: boolean;
  trumpTeam: 1 | 2 | null;
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

export const FIXTURES: Fixture[] = [
  { id: 'f-1', date: '31-Jul-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 1)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-2', date: '31-Jul-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 2)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-3', date: '31-Jul-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 3)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-4', date: '31-Jul-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 4)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-5', date: '31-Jul-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 5)', teamA: 'Team A', teamB: 'Team B' }
];

export const INITIAL_MATCH: MatchState = {
  currentMatchId: 'f-1',
  category: 'Team Championship',
  stage: 'Group Stage',
  teamA: 'Team A',
  teamB: 'Team B',
  player1: 'Nitin Verma',
  player2: 'Sambit Mahapatra',
  score1: 0,
  score2: 0,
  maxPoints: 11,
  server: 1,
  servingSide: 'right',
  deuceActive: false,
  gameWinner: null,
  isTrump: false,
  trumpTeam: null
};
