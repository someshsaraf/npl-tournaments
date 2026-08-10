import type { CompletedMatch, Fixture, MatchState, Team } from '../data/tournamentData';
import { computeTournamentStats } from './resultStats';
import { hasSeriesWinner } from './matchState';

/** Max serialized context size sent to /api/ask (bytes, UTF-16-ish via JSON length). */
export const ASK_CONTEXT_MAX_CHARS = 90_000;

export const RULES_DIGEST = [
  'Referee decision is final; arguing can lead to penalties.',
  'Arrive at least 10 minutes before scheduled slot.',
  'Non-marking shoes required; serve contact below 1.15m; spin serves banned.',
  'Team Championship: 5 teams, up to 5 players; each tie has 5 matches (1 singles + 4 ranked doubles).',
  'Team Championship group stage: race to 15; deuce from 14–14; golden point at 15–15.',
  'Trump: exactly 1 Trump game per tie; win Trump = +2 team points; lose Trump = −1.',
  'Kids & Women’s: race to 15; deuce from 14–14; golden point at 21–21.',
  'Men’s: race to 21; deuce from 20–20; golden point at 30–30.',
  'Date format in data: e.g. 9-Aug-26 means 9 August 2026.'
].join('\n');

export type AskContextInput = {
  fixtures: Fixture[];
  teams: Team[];
  completed: CompletedMatch[];
  live: MatchState | null;
};

export type AskContextPack = {
  tournament: string;
  rules: string;
  live: Record<string, unknown> | null;
  teams: Array<{ name: string; players: string[] }>;
  completed: Array<{
    when: string;
    category: string;
    stage: string;
    matchup: string;
    result: string;
    winner: string;
  }>;
  fixtures: Array<{
    date: string;
    time: string;
    category: string;
    stage: string;
    details: string;
    status: string;
    winner: string;
    result: string;
  }>;
  stats: {
    totalMatches: number;
    totalPoints: number;
    nailbiterCount: number;
    headline: string;
    byDay: Array<{ name: string; count: number }>;
    champions: Array<{ category: string; winner: string; result: string; matchup: string }>;
    topWinners: Array<{ name: string; count: number }>;
    curiosities: string[];
  };
};

function safeStr(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function matchupOf(row: {
  details?: string;
  player1?: string;
  player2?: string;
  teamA?: string;
  teamB?: string;
}): string {
  const fromPlayers =
    row.player1 || row.player2
      ? `${safeStr(row.player1) || safeStr(row.teamA) || 'Side A'} vs ${
          safeStr(row.player2) || safeStr(row.teamB) || 'Side B'
        }`
      : '';
  return (
    fromPlayers ||
    safeStr(row.details) ||
    `${safeStr(row.teamA) || 'Side A'} vs ${safeStr(row.teamB) || 'Side B'}`
  );
}

function compactLive(live: MatchState | null): Record<string, unknown> | null {
  if (!live || typeof live !== 'object') return null;
  const a = safeStr(live.player1) || safeStr(live.teamA) || 'Side A';
  const b = safeStr(live.player2) || safeStr(live.teamB) || 'Side B';
  const done = hasSeriesWinner(live);
  return {
    category: safeStr(live.category),
    stage: safeStr(live.stage),
    matchup: `${a} vs ${b}`,
    score: `${live.score1 ?? 0}-${live.score2 ?? 0}`,
    series:
      live.bestOf === 3
        ? `${live.gamesWon1 ?? 0}-${live.gamesWon2 ?? 0}`
        : null,
    status: done ? 'finished_on_court' : 'live_or_ready',
    isTrump: !!live.isTrump
  };
}

/**
 * Build a size-capped tournament snapshot for Gemini Ask.
 * Concurrency: pure/stateless.
 * Security: strips to known fields only; truncates strings; caps JSON size.
 * Validation: coerces arrays; ignores malformed rows.
 */
export function buildAskContext(input: unknown): AskContextPack {
  const raw =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Partial<AskContextInput>)
      : {};

  const fixtures = Array.isArray(raw.fixtures) ? raw.fixtures : [];
  const teams = Array.isArray(raw.teams) ? raw.teams : [];
  const completed = Array.isArray(raw.completed) ? raw.completed : [];
  const live = raw.live && typeof raw.live === 'object' ? (raw.live as MatchState) : null;

  const stats = computeTournamentStats(completed);

  const pack: AskContextPack = {
    tournament: 'NPL 2026 · Renaissance Nature Walk',
    rules: RULES_DIGEST,
    live: compactLive(live),
    teams: teams
      .filter((t) => t && typeof t === 'object' && typeof t.name === 'string')
      .map((t) => ({
        name: safeStr(t.name, 80),
        players: (Array.isArray(t.players) ? t.players : [])
          .filter((p): p is string => typeof p === 'string' && !!p.trim())
          .map((p) => safeStr(p, 80))
          .slice(0, 12)
      }))
      .slice(0, 20),
    completed: completed
      .filter((r) => r && typeof r === 'object' && r.status === 'completed')
      .map((r) => ({
        when: [safeStr(r.completedDate, 32), safeStr(r.completedTime, 16)].filter(Boolean).join(' '),
        category: safeStr(r.category, 80),
        stage: safeStr(r.stage, 40),
        matchup: matchupOf(r).slice(0, 160),
        result: safeStr(r.result, 80),
        winner: safeStr(r.winnerName, 120)
      }))
      .slice(0, 200),
    fixtures: fixtures
      .filter((f) => f && typeof f === 'object' && typeof f.date === 'string')
      .map((f) => ({
        date: safeStr(f.date, 32),
        time: safeStr(f.time, 16),
        category: safeStr(f.category, 80),
        stage: safeStr(f.stage, 40),
        details: safeStr(f.details, 160),
        status: safeStr(f.status, 24) || 'scheduled',
        winner: safeStr(f.winnerName, 120),
        result: safeStr(f.result, 80)
      }))
      .slice(0, 250),
    stats: {
      totalMatches: stats.totalMatches,
      totalPoints: stats.totalPoints,
      nailbiterCount: stats.nailbiterCount,
      headline: safeStr(stats.headline, 600),
      byDay: stats.byDay.slice(0, 12),
      champions: stats.champions.slice(0, 20).map((c) => ({
        category: c.category,
        winner: c.winner,
        result: c.result,
        matchup: c.matchup
      })),
      topWinners: stats.topWinners.slice(0, 12),
      curiosities: stats.curiosities.slice(0, 6).map((c) => safeStr(c, 240))
    }
  };

  return trimAskContext(pack);
}

/**
 * If serialized pack exceeds cap, drop oldest completed / fixture rows first.
 */
export function trimAskContext(pack: AskContextPack): AskContextPack {
  if (!pack || typeof pack !== 'object') {
    throw new Error('trimAskContext: pack is required');
  }
  let current = pack;
  let json = JSON.stringify(current);
  if (json.length <= ASK_CONTEXT_MAX_CHARS) return current;

  const next = { ...current };
  while (json.length > ASK_CONTEXT_MAX_CHARS) {
    if (next.completed.length > 40) {
      next.completed = next.completed.slice(0, Math.floor(next.completed.length * 0.75));
    } else if (next.fixtures.length > 40) {
      next.fixtures = next.fixtures.slice(0, Math.floor(next.fixtures.length * 0.75));
    } else {
      next.stats = {
        ...next.stats,
        curiosities: [],
        topWinners: next.stats.topWinners.slice(0, 5),
        champions: next.stats.champions.slice(0, 8)
      };
      json = JSON.stringify(next);
      if (json.length > ASK_CONTEXT_MAX_CHARS) {
        next.completed = next.completed.slice(0, 20);
        next.fixtures = next.fixtures.slice(0, 30);
      }
      break;
    }
    current = next;
    json = JSON.stringify(current);
  }
  return current;
}

/** Suggest portal links from the user question (heuristic; no LLM). */
export function suggestAskLinks(question: unknown): Array<{ label: string; to: string }> {
  if (typeof question !== 'string' || !question.trim()) {
    return [
      { label: 'Schedule', to: '/schedule' },
      { label: 'Results', to: '/results' }
    ];
  }
  const q = question.toLowerCase();
  const links: Array<{ label: string; to: string }> = [];
  const add = (label: string, to: string) => {
    if (!links.some((l) => l.to === to)) links.push({ label, to });
  };

  if (/\brule|trump|golden|deuce|shoe|serve|scoring|format\b/.test(q)) add('Rules', '/rules');
  if (/\bresult|won|winner|score|completed|final|played\b/.test(q)) add('Results', '/results');
  if (/\bstat|nail|blowout|undefeated|champion|how many\b/.test(q)) add('Stats', '/stats');
  if (/\bschedule|when|fixture|upcoming|play\b/.test(q)) add('Schedule', '/schedule');
  if (/\bteam|roster|squad|who is on\b/.test(q)) add('Teams', '/teams');
  if (/\blive|now|on court|scoreboard\b/.test(q)) add('Live stream', '/live');

  if (links.length === 0) {
    add('Schedule', '/schedule');
    add('Results', '/results');
    add('Stats', '/stats');
  }
  return links.slice(0, 4);
}
