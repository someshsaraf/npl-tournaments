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
  server?: 1 | 2;
  serving?: 1 | 2;
  isTrump: boolean;
  trumpTeam: 1 | 2 | null;
}

// ---------------------------------------------------------------------------
// Pre-Entered Teams (Team Championship - Davis Cup Style)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Pre-Entered Tournament Fixtures & Master Schedule
// ---------------------------------------------------------------------------
export const FIXTURES: Fixture[] = [
  // Weekend 1: Friday, 31st Jul
  { id: 'f-1', date: '31-Jul-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 1)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-2', date: '31-Jul-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 2)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-3', date: '31-Jul-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 3)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-4', date: '31-Jul-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 4)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-5', date: '31-Jul-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 5)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-6', date: '31-Jul-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 1)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-7', date: '31-Jul-26', time: '18:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 2)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-8', date: '31-Jul-26', time: '18:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 3)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-9', date: '31-Jul-26', time: '19:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 4)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-10', date: '31-Jul-26', time: '19:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 5)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-11', date: '31-Jul-26', time: '19:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Agam vs Keerat Sahai' },
  { id: 'f-12', date: '31-Jul-26', time: '19:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Vivaan Puri vs Atharva Kitturu' },
  { id: 'f-13', date: '31-Jul-26', time: '20:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Arush Goyal vs Agam' },
  { id: 'f-14', date: '31-Jul-26', time: '20:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Keerat Sahai vs Vivaan Puri' },
  { id: 'f-15', date: '31-Jul-26', time: '20:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Atharva Kitturu vs Arush Goyal' },
  { id: 'f-16', date: '31-Jul-26', time: '20:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Kushagra vs Riday' },

  // Weekend 1: Saturday, 1st Aug
  { id: 'f-17', date: '1-Aug-26', time: '07:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Aarav Karthik vs Tarun Rajavelu' },
  { id: 'f-18', date: '1-Aug-26', time: '07:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Kevin Behl vs Kushagra' },
  { id: 'f-19', date: '1-Aug-26', time: '07:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Riday vs Aarav Karthik' },
  { id: 'f-20', date: '1-Aug-26', time: '07:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Tarun Rajavelu vs Kevin Behl' },
  { id: 'f-21', date: '1-Aug-26', time: '08:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Anvik Suman vs Rithvik Anand' },
  { id: 'f-22', date: '1-Aug-26', time: '08:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Smaran vs Dhruv Siva' },
  { id: 'f-23', date: '1-Aug-26', time: '08:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Anvik Suman vs Smaran' },
  { id: 'f-24', date: '1-Aug-26', time: '08:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Rithvik Anand vs Dhruv Siva' },
  { id: 'f-25', date: '1-Aug-26', time: '09:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Anvik Suman vs Dhruv Siva' },
  { id: 'f-26', date: '1-Aug-26', time: '09:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Rithvik Anand vs Smaran' },
  { id: 'f-27', date: '1-Aug-26', time: '09:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Agam vs Vivaan Puri' },
  { id: 'f-28', date: '1-Aug-26', time: '09:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Keerat Sahai vs Atharva Kitturu' },
  { id: 'f-29', date: '1-Aug-26', time: '10:00', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya SG vs Ananya Adurthi' },
  { id: 'f-30', date: '1-Aug-26', time: '10:15', category: 'Girls Singles', stage: 'Group Stage', details: 'Meenaakshi S vs Stuthi Rajanish' },
  { id: 'f-31', date: '1-Aug-26', time: '10:30', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya SG vs Meenaakshi S' },
  { id: 'f-32', date: '1-Aug-26', time: '10:45', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya Adurthi vs Stuthi Rajanish' },
  { id: 'f-33', date: '1-Aug-26', time: '11:00', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya SG vs Stuthi Rajanish' },
  { id: 'f-34', date: '1-Aug-26', time: '11:15', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya Adurthi vs Meenaakshi S' },
  { id: 'f-35', date: '1-Aug-26', time: '11:30', category: 'Girls Singles', stage: 'Group Stage', details: 'Sadhna kishor vs Asawari Aashish Desai' },
  { id: 'f-36', date: '1-Aug-26', time: '11:45', category: 'Girls Singles', stage: 'Group Stage', details: 'Ria Payik vs Meher Gupta' },
  { id: 'f-37', date: '1-Aug-26', time: '16:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 1)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-38', date: '1-Aug-26', time: '16:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 2)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-39', date: '1-Aug-26', time: '16:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 3)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-40', date: '1-Aug-26', time: '16:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 4)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-41', date: '1-Aug-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 5)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-42', date: '1-Aug-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 1)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-43', date: '1-Aug-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 2)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-44', date: '1-Aug-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 3)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-45', date: '1-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 4)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-46', date: '1-Aug-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 5)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-47', date: '1-Aug-26', time: '18:30', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya SG & Stuti vs Ananya Adurthi & Meenakshi' },
  { id: 'f-48', date: '1-Aug-26', time: '18:45', category: 'Girls Doubles', stage: 'Group Stage', details: 'Sadhna kishor & Meher vs Asawari Desai & Ria' },
  { id: 'f-49', date: '1-Aug-26', time: '19:00', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya SG & Stuti vs Sadhna kishor & Meher' },
  { id: 'f-50', date: '1-Aug-26', time: '19:15', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya Adurthi & Meenakshi vs Asawari Desai & Ria' },
  { id: 'f-51', date: '1-Aug-26', time: '19:30', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya SG & Stuti vs Asawari Desai & Ria' },
  { id: 'f-52', date: '1-Aug-26', time: '19:45', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya Adurthi & Meenakshi vs Sadhna kishor & Meher' },
  { id: 'f-53', date: '1-Aug-26', time: '20:00', category: 'Boys Doubles', stage: 'Group Stage', details: 'Agam & Smaran vs Anvik Suman & Atharva' },
  { id: 'f-54', date: '1-Aug-26', time: '20:15', category: 'Boys Doubles', stage: 'Group Stage', details: 'Riday & Dhruv vs Vivaan Puri & Kevin' },
  { id: 'f-55', date: '1-Aug-26', time: '20:30', category: 'Boys Doubles', stage: 'Group Stage', details: 'Agam & Smaran vs Riday & Dhruv' },
  { id: 'f-56', date: '1-Aug-26', time: '20:45', category: 'Boys Doubles', stage: 'Group Stage', details: 'Anvik Suman & Atharva vs Vivaan Puri & Kevin' },

  // Weekend 1: Sunday, 2nd Aug
  { id: 'f-57', date: '2-Aug-26', time: '07:00', category: 'Boys Doubles', stage: 'Group Stage', details: 'Agam & Smaran vs Vivaan Puri & Kevin' },
  { id: 'f-58', date: '2-Aug-26', time: '07:15', category: 'Boys Doubles', stage: 'Group Stage', details: 'Anvik Suman & Atharva vs Riday & Dhruv' },
  { id: 'f-59', date: '2-Aug-26', time: '07:30', category: 'Boys Doubles', stage: 'Group Stage', details: 'Kushagra & Arush Goyal vs Keerat Sahai & Tarun' },
  { id: 'f-60', date: '2-Aug-26', time: '07:45', category: 'Boys Doubles', stage: 'Group Stage', details: 'Keerat Sahai & Tarun vs Rithvik Anand & Aarav' },
  { id: 'f-61', date: '2-Aug-26', time: '08:00', category: 'Boys Doubles', stage: 'Group Stage', details: 'Kushagra & Arush Goyal vs Rithvik Anand & Aarav' },
  { id: 'f-62', date: '2-Aug-26', time: '08:15', category: "Men's Singles >35", stage: 'Group Stage', details: 'Nitin Verma vs Vikash Srivastava' },
  { id: 'f-63', date: '2-Aug-26', time: '08:30', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vinamra Jaiswal vs Anand' },
  { id: 'f-64', date: '2-Aug-26', time: '08:45', category: "Men's Singles >35", stage: 'Group Stage', details: 'Nitin Verma vs Rajanish GJ' },
  { id: 'f-65', date: '2-Aug-26', time: '09:00', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vikash Srivastava vs Vinamra Jaiswal' },
  { id: 'f-66', date: '2-Aug-26', time: '09:15', category: "Men's Singles >35", stage: 'Group Stage', details: 'Anand vs Rajanish GJ' },
  { id: 'f-67', date: '2-Aug-26', time: '09:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Agam vs Atharva Kitturu' },
  { id: 'f-68', date: '2-Aug-26', time: '09:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Keerat Sahai vs Arush Goyal' },
  { id: 'f-69', date: '2-Aug-26', time: '10:00', category: 'Girls Singles', stage: 'Group Stage', details: 'Sadhna kishor vs Ria Payik' },
  { id: 'f-70', date: '2-Aug-26', time: '10:15', category: 'Girls Singles', stage: 'Group Stage', details: 'Asawari Aashish Desai vs Meher Gupta' },
  { id: 'f-71', date: '2-Aug-26', time: '10:30', category: 'Girls Singles', stage: 'Group Stage', details: 'Sadhna kishor vs Meher Gupta' },
  { id: 'f-72', date: '2-Aug-26', time: '10:45', category: 'Girls Singles', stage: 'Group Stage', details: 'Asawari Aashish Desai vs Ria Payik' },
  { id: 'f-73', date: '2-Aug-26', time: '11:00', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Shila sg' },
  { id: 'f-74', date: '2-Aug-26', time: '11:15', category: "Women's Singles", stage: 'Group Stage', details: 'Anisha vs Manila' },
  { id: 'f-75', date: '2-Aug-26', time: '11:30', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Anisha' },
  { id: 'f-76', date: '2-Aug-26', time: '11:45', category: "Women's Singles", stage: 'Group Stage', details: 'Shila sg vs Manila' },
  { id: 'f-77', date: '2-Aug-26', time: '12:00', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Saanvi' },
  { id: 'f-78', date: '2-Aug-26', time: '12:15', category: "Women's Singles", stage: 'Group Stage', details: 'Shila sg vs Saanvi' },
  { id: 'f-79', date: '2-Aug-26', time: '16:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 1)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-80', date: '2-Aug-26', time: '16:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 2)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-81', date: '2-Aug-26', time: '16:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 3)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-82', date: '2-Aug-26', time: '16:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 4)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-83', date: '2-Aug-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 5)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-84', date: '2-Aug-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 1)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-85', date: '2-Aug-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 2)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-86', date: '2-Aug-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 3)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-87', date: '2-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 4)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-88', date: '2-Aug-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 5)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-89', date: '2-Aug-26', time: '18:30', category: "Men's Doubles A", stage: 'Group Stage', details: 'Nitin Verma & Sanchit vs Tejas A & Anupam' },
  { id: 'f-90', date: '2-Aug-26', time: '18:45', category: "Men's Doubles A", stage: 'Group Stage', details: 'Sambit Mahapatra & Shaunak vs Ishan Suman & Abhishek Modi' },
  { id: 'f-91', date: '2-Aug-26', time: '19:00', category: "Men's Doubles A", stage: 'Group Stage', details: 'Ajay Narang & Vikash vs Nitin Verma & Sanchit' },
  { id: 'f-92', date: '2-Aug-26', time: '19:15', category: "Men's Doubles A", stage: 'Group Stage', details: 'Tejas A & Anupam vs Sambit Mahapatra & Shaunak' },
  { id: 'f-93', date: '2-Aug-26', time: '19:30', category: "Men's Doubles A", stage: 'Group Stage', details: 'Ishan Suman & Abhishek Modi vs Ajay Narang & Vikash' },
  { id: 'f-94', date: '2-Aug-26', time: '19:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Prateek Surana & Samik vs Vinamra Jaiswal & Anirudh' },
  { id: 'f-95', date: '2-Aug-26', time: '20:00', category: "Men's Doubles B", stage: 'Group Stage', details: 'Satish Ram & Mihir vs Vishwajeet & Mayank Sehlot' },
  { id: 'f-96', date: '2-Aug-26', time: '20:15', category: "Men's Doubles B", stage: 'Group Stage', details: 'Prateek Surana & Samik vs Satish Ram & Mihir' },
  { id: 'f-97', date: '2-Aug-26', time: '20:30', category: "Men's Doubles B", stage: 'Group Stage', details: 'Vinamra Jaiswal & Anirudh vs Vishwajeet & Mayank Sehlot' },
  { id: 'f-98', date: '2-Aug-26', time: '20:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Prateek Surana & Samik vs Vishwajeet & Mayank Sehlot' }
];

// ---------------------------------------------------------------------------
// Default Initial Match State
// ---------------------------------------------------------------------------
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
  server: 1,
  serving: 1,
  isTrump: false,
  trumpTeam: null
};
