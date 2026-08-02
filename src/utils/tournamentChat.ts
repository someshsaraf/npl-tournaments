import type { CompletedMatch, Fixture, MatchState, Team } from '../data/tournamentData';
import { FIXTURES, TEAMS } from '../data/tournamentData';
import { hasSeriesWinner } from './matchState';

export type ChatKnowledge = {
  fixtures: Fixture[];
  teams: Team[];
  completed: CompletedMatch[];
  live: MatchState | null;
};

export type ChatAnswer = {
  text: string;
  links?: { label: string; to: string }[];
};

const STOP = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'what',
  'when',
  'where',
  'who',
  'whom',
  'which',
  'how',
  'do',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'about',
  'for',
  'of',
  'in',
  'on',
  'at',
  'to',
  'and',
  'or',
  'with',
  'from',
  'tell',
  'please',
  'show',
  'give',
  'list',
  'any',
  'some',
  'there',
  'this',
  'that',
  'npl',
  '2026',
  'match',
  'matches',
  'game',
  'games'
]);

const RULES: { keys: string[]; answer: string }[] = [
  {
    keys: ['trump'],
    answer:
      'Trump Game (Team Championship): each team picks exactly 1 Trump game per tie. Winning Trump = +2 team points; losing Trump = −1 team point.'
  },
  {
    keys: ['golden', 'goldpoint'],
    answer:
      'Golden point: when the score reaches the cap (e.g. Team Championship group stage 15–15; kids/women 21–21; men’s 30–30), the next point wins the game.'
  },
  {
    keys: ['deuce'],
    answer:
      'Deuce: play continues win-by-2 after the deuce threshold (Team Championship / kids & women from 14–14; men’s from 20–20) until the golden-point cap.'
  },
  {
    keys: ['shoe', 'shoes', 'nonmarking', 'non-marking'],
    answer: 'Non-marking shoes are strictly required on court.'
  },
  {
    keys: ['serve', 'service', 'spin'],
    answer:
      'Service contact must be below 1.15m. Spin serves are banned. The referee’s decision is final.'
  },
  {
    keys: ['arrive', 'arrival', 'late', 'punctual'],
    answer: 'Players must arrive at least 10 minutes before their scheduled slot.'
  },
  {
    keys: ['referee', 'umpire', 'argue', 'argument'],
    answer: 'The match referee’s decision is final. Arguing with the referee can lead to penalties.'
  },
  {
    keys: ['team', 'championship', 'tie'],
    answer:
      'Team Championship: 5 teams, up to 5 players each. Each tie has 5 matches (1 singles + 4 ranked doubles). Group stage is race to 15; golden point at 15–15.'
  },
  {
    keys: ['kids', 'women', 'women\'s', 'girl', 'girls'],
    answer:
      'Kids & Women’s categories: race to 15. Deuce from 14–14 (win by 2); golden point at 21–21.'
  },
  {
    keys: ['men', 'men\'s', 'mens'],
    answer:
      'Men’s categories: race to 21. Deuce from 20–20 (win by 2); golden point at 30–30.'
  },
  {
    keys: ['rule', 'rules', 'regulation', 'format', 'scoring'],
    answer:
      'Key rules: referee final; arrive 10 min early; non-marking shoes; serve below 1.15m (no spin). Team Championship group = race to 15 (golden at 15–15). Kids/Women race to 15 (golden 21–21). Men race to 21 (golden 30–30). Trump: +2 win / −1 loss, one Trump per tie. See Rules for full detail.'
  }
];

/**
 * Tokenize a user query for matching.
 * Input: any; returns lowercase tokens (stop-words removed).
 */
export function tokenizeQuery(query: unknown): string[] {
  if (typeof query !== 'string' || !query.trim()) return [];
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s'/-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function includesAny(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n));
}

function scoreText(text: string, tokens: string[]): number {
  if (!text || tokens.length === 0) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (lower.includes(t)) score += t.length >= 4 ? 3 : 2;
  }
  return score;
}

function formatFixture(f: Fixture): string {
  const status =
    f.status === 'completed'
      ? ` · Done${f.winnerName ? ` · Winner ${f.winnerName}` : ''}${f.result ? ` (${f.result})` : ''}`
      : '';
  return `${f.date} ${f.time} — ${f.category} · ${f.details}${status}`;
}

function formatCompleted(row: CompletedMatch): string {
  const when = [row.completedDate, row.completedTime].filter(Boolean).join(' ');
  const matchup =
    row.details || `${row.player1 || row.teamA} vs ${row.player2 || row.teamB}`;
  return `${when || 'Recent'} — ${row.category || 'Match'}: ${matchup} · ${row.result || '—'}${
    row.winnerName ? ` · Winner ${row.winnerName}` : ''
  }`;
}

function findTeams(tokens: string[], teams: Team[]): Team[] {
  const hits: { team: Team; score: number }[] = [];
  for (const team of teams) {
    let score = scoreText(team.name, tokens);
    for (const p of team.players) score += scoreText(p, tokens) * 2;
    // "team a" style
    const nameTok = team.name.toLowerCase().replace(/\s+/g, '');
    if (tokens.some((t) => nameTok.includes(t.replace(/\s+/g, '')))) score += 5;
    if (score > 0) hits.push({ team, score });
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((h) => h.team);
}

function findFixtures(tokens: string[], fixtures: Fixture[], limit = 8): Fixture[] {
  const scored = fixtures
    .map((f) => {
      const blob = [
        f.date,
        f.time,
        f.category,
        f.stage,
        f.details,
        f.teamA,
        f.teamB,
        f.winnerName,
        f.result
      ]
        .filter(Boolean)
        .join(' ');
      let score = scoreText(blob, tokens);
      // Boost date-ish tokens (jul, aug, 31, etc.)
      for (const t of tokens) {
        if (f.date.toLowerCase().includes(t)) score += 4;
        if (f.category.toLowerCase().includes(t)) score += 3;
      }
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.date.localeCompare(b.f.date) || a.f.time.localeCompare(b.f.time));

  return scored.slice(0, limit).map((x) => x.f);
}

function findCompleted(tokens: string[], rows: CompletedMatch[], limit = 6): CompletedMatch[] {
  const scored = rows
    .map((r) => {
      const blob = [
        r.category,
        r.stage,
        r.details,
        r.teamA,
        r.teamB,
        r.player1,
        r.player2,
        r.winnerName,
        r.result,
        r.completedDate
      ]
        .filter(Boolean)
        .join(' ');
      return { r, score: scoreText(blob, tokens) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.r);
}

function upcomingFixtures(fixtures: Fixture[], limit = 6): Fixture[] {
  return fixtures.filter((f) => f.status !== 'completed').slice(0, limit);
}

function answerRules(q: string, tokens: string[]): ChatAnswer | null {
  const lower = q.toLowerCase();
  if (!includesAny(lower, ['rule', 'rules', 'trump', 'golden', 'deuce', 'shoe', 'serve', 'spin', 'format', 'scoring', 'how long', 'points', 'arrive', 'referee'])) {
    // still allow pure trump/golden without "rule"
    if (!tokens.some((t) => ['trump', 'golden', 'deuce', 'shoes', 'serve'].includes(t))) {
      return null;
    }
  }

  const matched: string[] = [];
  for (const rule of RULES) {
    if (rule.keys.some((k) => lower.includes(k) || tokens.includes(k))) {
      matched.push(rule.answer);
    }
  }
  if (matched.length === 0 && includesAny(lower, ['rule', 'rules', 'format', 'scoring'])) {
    const general = RULES.find((r) => r.keys.includes('rule'));
    if (general) matched.push(general.answer);
  }
  if (matched.length === 0) return null;

  // Deduplicate while keeping order
  const unique = [...new Set(matched)].slice(0, 3);
  return {
    text: unique.join('\n\n'),
    links: [{ label: 'Full rules', to: '/rules' }]
  };
}

function answerLive(live: MatchState | null): ChatAnswer | null {
  if (!live) {
    return {
      text: 'I don’t have a live match snapshot right now. Check Live Stream or the home page for the current score.',
      links: [
        { label: 'Live stream', to: '/live' },
        { label: 'Home', to: '/' }
      ]
    };
  }
  const a = live.player1 || live.teamA || 'Side A';
  const b = live.player2 || live.teamB || 'Side B';
  const done = hasSeriesWinner(live);
  const score = `${live.score1 ?? 0}–${live.score2 ?? 0}`;
  const series =
    live.bestOf === 3 ? ` · Series ${live.gamesWon1 ?? 0}–${live.gamesWon2 ?? 0}` : '';
  return {
    text: done
      ? `Latest finished on court: ${a} vs ${b} — ${score}${series} (${live.category || 'Match'}).`
      : `On court now: ${a} vs ${b} — ${score}${series}. Category: ${live.category || '—'}${
          live.stage ? ` · ${live.stage}` : ''
        }.`,
    links: [
      { label: 'Live stream', to: '/live' },
      { label: 'Scoreboard', to: '/score' }
    ]
  };
}

/**
 * Answer a portal question from local tournament knowledge (no external AI API).
 * Concurrency: pure/stateless — safe to call from React event handlers.
 * Security: read-only over provided knowledge; query length capped by caller.
 */
export function answerTournamentQuestion(
  query: unknown,
  knowledge: ChatKnowledge
): ChatAnswer {
  if (typeof query !== 'string' || !query.trim()) {
    return { text: 'Ask something about the schedule, rules, teams, or results.' };
  }
  const q = query.trim().slice(0, 400);
  const tokens = tokenizeQuery(q);
  const lower = q.toLowerCase();

  const fixtures =
    Array.isArray(knowledge.fixtures) && knowledge.fixtures.length > 0
      ? knowledge.fixtures
      : FIXTURES;
  const teams =
    Array.isArray(knowledge.teams) && knowledge.teams.length > 0 ? knowledge.teams : TEAMS;
  const completed = Array.isArray(knowledge.completed) ? knowledge.completed : [];

  // Help
  if (
    tokens.length === 0 ||
    includesAny(lower, ['help', 'hi', 'hello', 'what can you', 'capabilities'])
  ) {
    if (tokens.length === 0 || includesAny(lower, ['help', 'hi', 'hello', 'what can you'])) {
      return {
        text:
          'I can answer from NPL 2026 data — try asking:\n' +
          '• When does Team A play?\n' +
          '• What are the trump rules?\n' +
          '• Boys Singles schedule on 9-Aug\n' +
          '• Who is on Team C?\n' +
          '• Recent results / who won?\n' +
          '• What’s on court now?',
        links: [
          { label: 'Schedule', to: '/schedule' },
          { label: 'Rules', to: '/rules' },
          { label: 'Teams', to: '/teams' },
          { label: 'Results', to: '/results' }
        ]
      };
    }
  }

  // Live / now
  if (includesAny(lower, ['live', 'now', 'on court', 'current', 'happening', 'scoreboard', 'streaming'])) {
    return answerLive(knowledge.live) ?? {
      text: 'Check the live stream for the current match.',
      links: [{ label: 'Live stream', to: '/live' }]
    };
  }

  // Rules first when clearly about regulations
  const rulesHit = answerRules(q, tokens);
  if (rulesHit && includesAny(lower, ['rule', 'rules', 'trump', 'golden', 'deuce', 'shoe', 'serve', 'spin', 'format', 'scoring', 'referee'])) {
    return rulesHit;
  }

  // Teams / roster
  if (includesAny(lower, ['roster', 'player', 'players', 'team', 'who is on', 'squad'])) {
    const teamHits = findTeams(tokens, teams);
    if (teamHits.length > 0) {
      const lines = teamHits.map((t) => {
        const roster = (Array.isArray(t.players) ? t.players : []).join(', ') || 'No players listed';
        return `${t.name}: ${roster}`;
      });
      return {
        text: lines.join('\n'),
        links: [{ label: 'All teams', to: '/teams' }]
      };
    }
    if (includesAny(lower, ['how many team', 'list team', 'all team', 'teams'])) {
      return {
        text: `There are ${teams.length} Team Championship sides: ${teams.map((t) => t.name).join(', ')}.`,
        links: [{ label: 'Teams', to: '/teams' }]
      };
    }
  }

  // Results
  if (includesAny(lower, ['result', 'results', 'winner', 'won', 'completed', 'finished', 'final'])) {
    const hits = findCompleted(tokens, completed, 6);
    if (hits.length > 0) {
      return {
        text: `Completed matches:\n${hits.map((r) => `• ${formatCompleted(r)}`).join('\n')}`,
        links: [{ label: 'All results', to: '/results' }]
      };
    }
    if (completed.length > 0 && (includesAny(lower, ['recent', 'latest', 'all']) || tokens.length <= 2)) {
      const recent = completed.slice(0, 5);
      return {
        text: `Latest results:\n${recent.map((r) => `• ${formatCompleted(r)}`).join('\n')}`,
        links: [{ label: 'All results', to: '/results' }]
      };
    }
    if (completed.length === 0) {
      return {
        text: 'No completed matches are recorded yet. Check back after games are finished and saved.',
        links: [{ label: 'Results', to: '/results' }]
      };
    }
  }

  // Upcoming / next
  if (includesAny(lower, ['upcoming', 'next', 'up next', 'coming', 'remaining'])) {
    let list = findFixtures(tokens, fixtures, 10).filter((f) => f.status !== 'completed');
    if (list.length === 0) list = upcomingFixtures(fixtures, 6);
    if (list.length === 0) {
      return {
        text: 'No upcoming fixtures found — the schedule may be fully completed.',
        links: [{ label: 'Schedule', to: '/schedule' }]
      };
    }
    return {
      text: `Up next:\n${list.slice(0, 6).map((f) => `• ${formatFixture(f)}`).join('\n')}`,
      links: [{ label: 'Full schedule', to: '/schedule' }]
    };
  }

  // Schedule / when / fixtures (default retrieval path)
  const fixtureHits = findFixtures(tokens, fixtures, 8);
  const teamHits = findTeams(tokens, teams);

  if (fixtureHits.length > 0) {
    const lines = fixtureHits.map((f) => `• ${formatFixture(f)}`);
    let text = `Here’s what I found on the schedule:\n${lines.join('\n')}`;
    if (teamHits.length === 1) {
      const t = teamHits[0];
      text += `\n\n${t.name} roster: ${(t.players || []).join(', ')}`;
    }
    if (rulesHit && !includesAny(lower, ['when', 'schedule', 'fixture', 'time'])) {
      // skip
    }
    return {
      text,
      links: [
        { label: 'Schedule', to: '/schedule' },
        ...(teamHits.length ? [{ label: 'Teams', to: '/teams' }] : [])
      ]
    };
  }

  if (teamHits.length > 0) {
    const lines = teamHits.map((t) => {
      const roster = (Array.isArray(t.players) ? t.players : []).join(', ') || 'No players listed';
      return `${t.name}: ${roster}`;
    });
    return {
      text: lines.join('\n'),
      links: [
        { label: 'Teams', to: '/teams' },
        { label: 'Schedule', to: '/schedule' }
      ]
    };
  }

  if (rulesHit) return rulesHit;

  return {
    text:
      'I couldn’t find a clear match for that. Try a team name, player, category, date (e.g. 31-Jul), or ask about trump / golden point / schedule.',
    links: [
      { label: 'Schedule', to: '/schedule' },
      { label: 'Rules', to: '/rules' },
      { label: 'Ask again tips', to: '/ask' }
    ]
  };
}

export const SUGGESTED_PROMPTS = [
  'What are the trump rules?',
  'When does Team A play?',
  'Boys Singles schedule',
  'Who is on Team C?',
  'What is golden point?',
  'What’s on court now?',
  'Show recent results'
] as const;
