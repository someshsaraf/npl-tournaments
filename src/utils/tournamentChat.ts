import type { CompletedMatch, Fixture, MatchState, Team } from '../data/tournamentData';
import { FIXTURES, TEAMS } from '../data/tournamentData';
import { hasSeriesWinner } from './matchState';
import { computeTournamentStats } from './resultStats';

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

const MONTH_ALIASES: Record<string, string> = {
  jan: 'Jan',
  january: 'Jan',
  feb: 'Feb',
  february: 'Feb',
  mar: 'Mar',
  march: 'Mar',
  apr: 'Apr',
  april: 'Apr',
  may: 'May',
  jun: 'Jun',
  june: 'Jun',
  jul: 'Jul',
  july: 'Jul',
  aug: 'Aug',
  august: 'Aug',
  sep: 'Sep',
  sept: 'Sep',
  september: 'Sep',
  oct: 'Oct',
  october: 'Oct',
  nov: 'Nov',
  november: 'Nov',
  dec: 'Dec',
  december: 'Dec'
};

/** Default tournament year suffix used in schedule/result dates (e.g. 9-Aug-26). */
const TOURNAMENT_YEAR_YY = '26';

/**
 * Parse natural-language dates from a query into tournament date keys.
 * Returns keys like "9-Aug" and "9-Aug-26" that match schedule/result date strings.
 * Input: any; empty array when no date found.
 */
export function parseQueryDateKeys(query: unknown): string[] {
  if (typeof query !== 'string' || !query.trim()) return [];
  const q = query.toLowerCase();
  const keys = new Set<string>();

  const add = (day: number, monAbbr: string, yearYy?: string | null) => {
    if (!Number.isFinite(day) || day < 1 || day > 31 || !monAbbr) return;
    const d = String(day);
    keys.add(`${d}-${monAbbr}`);
    const yy = yearYy && /^\d{2}$/.test(yearYy) ? yearYy : TOURNAMENT_YEAR_YY;
    keys.add(`${d}-${monAbbr}-${yy}`);
  };

  // 9-Aug-26 / 9-Aug / 09 Aug 2026
  for (const m of q.matchAll(
    /\b(\d{1,2})[-\s\/]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[-\s\/]+(?:20)?(\d{2}))?\b/gi
  )) {
    const mon = MONTH_ALIASES[m[2].toLowerCase()];
    if (mon) add(Number(m[1]), mon, m[3] || null);
  }

  // 9th August / 9 August / August 9th / August 9
  for (const m of q.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi
  )) {
    const mon = MONTH_ALIASES[m[2].toLowerCase()];
    if (mon) add(Number(m[1]), mon, null);
  }
  for (const m of q.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi
  )) {
    const mon = MONTH_ALIASES[m[1].toLowerCase()];
    if (mon) add(Number(m[2]), mon, null);
  }

  return [...keys];
}

/** True when a stored date string (e.g. 9-Aug-26) matches any parsed query date key. */
export function dateMatchesQuery(dateValue: unknown, dateKeys: string[]): boolean {
  if (typeof dateValue !== 'string' || !dateValue.trim() || dateKeys.length === 0) return false;
  const m = dateValue.trim().match(/^(\d{1,2})-([A-Za-z]{3})(?:-(\d{2}))?\b/);
  if (!m) return false;
  const day = String(Number(m[1]));
  const mon = m[2];
  const yy = m[3] || '';
  const prefix = `${day}-${mon}`;
  const full = yy ? `${day}-${mon}-${yy}` : prefix;
  return dateKeys.some((k) => {
    const key = k.trim();
    return key === full || key === prefix || (yy !== '' && key === `${day}-${mon}-${yy}`);
  });
}

function isCountQuery(lower: string): boolean {
  return (
    /\bhow many\b/.test(lower) ||
    /\bnumber of\b/.test(lower) ||
    /\bcount of\b/.test(lower) ||
    /\btotal (?:number of )?matches\b/.test(lower) ||
    /\bmatches (?:were )?played\b/.test(lower) ||
    (/\bplayed\b/.test(lower) && /\bon\b/.test(lower))
  );
}

function displayDateLabel(dateKeys: string[]): string {
  const full = dateKeys.find((k) => /^(\d{1,2})-[A-Za-z]{3}-\d{2}$/.test(k));
  if (full) return full;
  return dateKeys[0] || '';
}

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

/** Age-band intent from free text — distinguishes Men's Singles >35 vs <35. */
export type AgeBand = 'gt35' | 'lt35';

/**
 * Detect over/under-35 intent. Prefer explicit operators over bare "35".
 * Input: any; returns band or null when unspecified.
 */
export function detectAgeBand(text: unknown): AgeBand | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = text.toLowerCase();
  // Order matters: check both sides; explicit ops / phrases win.
  const gt =
    />\s*35|\bover\s*35\b|\babove\s*35\b|\bolder\s*than\s*35\b|\b35\s*\+|\bgt\s*35\b/.test(t);
  const lt =
    /<\s*35|\bunder\s*35\b|\bbelow\s*35\b|\byounger\s*than\s*35\b|\blt\s*35\b/.test(t);
  if (gt && !lt) return 'gt35';
  if (lt && !gt) return 'lt35';
  return null;
}

function ageBandInCategory(category: unknown): AgeBand | null {
  if (typeof category !== 'string' || !category.trim()) return null;
  const c = category.toLowerCase();
  if (c.includes('>35') || c.includes('over 35')) return 'gt35';
  if (c.includes('<35') || c.includes('under 35')) return 'lt35';
  return null;
}

/**
 * Tokenize a user query for matching.
 * Input: any; returns lowercase tokens (stop-words removed).
 * Preserves age operators as tokens like ">35" / "<35".
 */
export function tokenizeQuery(query: unknown): string[] {
  if (typeof query !== 'string' || !query.trim()) return [];
  // Normalize common age phrases and ordinals before stripping punctuation.
  let normalized = query
    .toLowerCase()
    .replace(/\bover\s*35\b|\babove\s*35\b|\bolder\s*than\s*35\b|\b35\s*\+/g, '>35')
    .replace(/\bunder\s*35\b|\bbelow\s*35\b|\byounger\s*than\s*35\b/g, '<35')
    .replace(/>\s*35/g, '>35')
    .replace(/<\s*35/g, '<35')
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/g, '$1');
  // Expand month names to schedule abbreviations (august → aug).
  for (const [full, abbr] of Object.entries(MONTH_ALIASES)) {
    if (full.length <= 3) continue;
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr.toLowerCase());
  }
  normalized = normalized.replace(/[^a-z0-9\s'/<>-]/g, ' ');
  return normalized
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
    // Bare "35" is too weak alone (matches both >35 and <35); skip unless
    // paired with an operator token handled elsewhere.
    if (t === '35') continue;
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
  // Prefer live player order so game tally (e.g. 0-2) aligns with the named sides.
  const fromPlayers =
    row.player1 || row.player2
      ? `${row.player1 || row.teamA || 'Side A'} vs ${row.player2 || row.teamB || 'Side B'}`
      : '';
  const matchup =
    fromPlayers || row.details || `${row.teamA || 'Side A'} vs ${row.teamB || 'Side B'}`;
  const stage = row.stage ? ` · ${row.stage}` : '';
  return `${when || 'Recent'} — ${row.category || 'Match'}${stage}: ${matchup} · ${row.result || '—'}${
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

function findFixtures(
  tokens: string[],
  fixtures: Fixture[],
  limit = 8,
  queryText = ''
): Fixture[] {
  const queryBand = detectAgeBand(queryText);
  const dateKeys = parseQueryDateKeys(queryText);
  const wantsFinal = tokens.includes('final') || /\bfinal\b/i.test(queryText);
  const scored = fixtures
    .map((f) => {
      const catBand = ageBandInCategory(f.category);
      if (queryBand && catBand && queryBand !== catBand) {
        return { f, score: 0 };
      }

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
        if (t === '35' || t === '>35' || t === '<35') continue;
        if (f.date.toLowerCase().includes(t)) score += 4;
        if (f.category.toLowerCase().includes(t)) score += 3;
      }
      if (dateKeys.length > 0 && dateMatchesQuery(f.date, dateKeys)) score += 14;
      if (queryBand && catBand === queryBand) score += 12;
      if (wantsFinal && typeof f.stage === 'string' && f.stage.toLowerCase() === 'final') {
        score += 10;
      }
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.date.localeCompare(b.f.date) || a.f.time.localeCompare(b.f.time));

  return scored.slice(0, limit).map((x) => x.f);
}

/**
 * Score completed rows for a query. Age-band mismatch is excluded when the
 * query specifies >35 / <35 so Men's Singles pools do not bleed together.
 */
function findCompleted(
  tokens: string[],
  rows: CompletedMatch[],
  limit = 6,
  queryText = ''
): { rows: CompletedMatch[]; scores: number[] } {
  const queryBand = detectAgeBand(queryText);
  const dateKeys = parseQueryDateKeys(queryText);
  const wantsFinal = tokens.includes('final') || /\bfinal\b/i.test(queryText);
  const scored = rows
    .map((r) => {
      const catBand = ageBandInCategory(r.category);
      if (queryBand && catBand && queryBand !== catBand) {
        return { r, score: 0 };
      }

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
      let score = scoreText(blob, tokens);

      if (r.category) {
        for (const t of tokens) {
          if (t === '35' || t === '>35' || t === '<35') continue;
          if (r.category.toLowerCase().includes(t)) score += 4;
        }
      }
      if (dateKeys.length > 0 && dateMatchesQuery(r.completedDate, dateKeys)) score += 14;
      if (queryBand && catBand === queryBand) score += 12;
      if (wantsFinal && typeof r.stage === 'string' && r.stage.toLowerCase() === 'final') {
        score += 10;
      } else if (wantsFinal && typeof r.stage === 'string' && r.stage.toLowerCase().includes('final')) {
        score += 6;
      }

      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  return { rows: top.map((x) => x.r), scores: top.map((x) => x.score) };
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
          '• Tournament stats / nail-biters\n' +
          '• What’s on court now?',
        links: [
          { label: 'Schedule', to: '/schedule' },
          { label: 'Rules', to: '/rules' },
          { label: 'Teams', to: '/teams' },
          { label: 'Results', to: '/results' },
          { label: 'Stats', to: '/stats' }
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

  // How many matches on a date (e.g. "9th August", "9-Aug")
  const dateKeys = parseQueryDateKeys(q);
  if (isCountQuery(lower) && dateKeys.length > 0) {
    const label = displayDateLabel(dateKeys);
    const playedIntent =
      /\bplayed\b/.test(lower) ||
      /\bcompleted\b/.test(lower) ||
      /\bfinished\b/.test(lower) ||
      /\btotal\b/.test(lower);
    const completedOn = completed.filter((r) => dateMatchesQuery(r.completedDate, dateKeys));
    const scheduledOn = fixtures.filter((f) => dateMatchesQuery(f.date, dateKeys));
    const scheduledDone = scheduledOn.filter((f) => f.status === 'completed');

    if (playedIntent) {
      const n = completedOn.length;
      const sample =
        n > 0
          ? `\nExamples:\n${completedOn
              .slice(0, 4)
              .map((r) => `• ${formatCompleted(r)}`)
              .join('\n')}${n > 4 ? `\n• …and ${n - 4} more` : ''}`
          : '';
      return {
        text:
          n === 0
            ? `No completed matches are recorded for ${label}.`
            : `${n} match${n === 1 ? '' : 'es'} played (completed) on ${label}.${sample}`,
        links: [
          { label: 'Results', to: '/results' },
          { label: 'Stats', to: '/stats' }
        ]
      };
    }

    return {
      text:
        `On ${label}: ${scheduledOn.length} scheduled` +
        (scheduledDone.length ? ` (${scheduledDone.length} marked done on the schedule)` : '') +
        `; ${completedOn.length} completed result${completedOn.length === 1 ? '' : 's'} recorded.`,
      links: [
        { label: 'Schedule', to: '/schedule' },
        { label: 'Results', to: '/results' }
      ]
    };
  }

  // How many matches in the whole tournament (no specific date)
  if (
    isCountQuery(lower) &&
    dateKeys.length === 0 &&
    includesAny(lower, ['played', 'completed', 'total', 'tournament', 'overall', 'altogether'])
  ) {
    const n = completed.length;
    return {
      text:
        n === 0
          ? 'No completed matches are recorded yet.'
          : `${n} match${n === 1 ? '' : 'es'} have been played (completed) in the tournament so far.`,
      links: [
        { label: 'Results', to: '/results' },
        { label: 'Stats', to: '/stats' }
      ]
    };
  }

  // Tournament stats overview
  if (
    includesAny(lower, ['stats', 'statistics', 'nailbiter', 'nail-biter', 'blowout', 'undefeated']) ||
    (includesAny(lower, ['interesting', 'highlight']) && includesAny(lower, ['result', 'results', 'match']))
  ) {
    if (completed.length === 0) {
      return {
        text: 'No completed matches yet — stats will appear after games are saved.',
        links: [
          { label: 'Stats', to: '/stats' },
          { label: 'Results', to: '/results' }
        ]
      };
    }
    const s = computeTournamentStats(completed);
    const top = s.topWinners.slice(0, 3).map((w) => `${w.name} (${w.count})`).join(', ');
    const champ =
      s.champions.length > 0
        ? `\nFinals champions: ${s.champions
            .slice(0, 6)
            .map((c) => `${c.category} — ${c.winner}`)
            .join('; ')}.`
        : '';
    const tight =
      s.avgMarginByCategory[0]
        ? `\nTightest category: ${s.avgMarginByCategory[0].name} (~${s.avgMarginByCategory[0].avgMargin} pt avg margin).`
        : '';
    return {
      text:
        `Across ${s.totalMatches} completed matches (${s.totalPoints.toLocaleString()} points played): ` +
        `${s.nailbiterCount} nail-biters` +
        (s.byDay[0] ? `; busiest day ${s.byDay[0].name} (${s.byDay[0].count})` : '') +
        (top ? `. Most wins: ${top}.` : '.') +
        champ +
        tight +
        '\nOpen Stats for the full breakdown.',
      links: [
        { label: 'Tournament stats', to: '/stats' },
        { label: 'All results', to: '/results' }
      ]
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

  // Results / who won
  if (includesAny(lower, ['result', 'results', 'winner', 'won', 'completed', 'finished', 'final'])) {
    const { rows: hits, scores } = findCompleted(tokens, completed, 6, q);
    if (hits.length > 0) {
      const whoWon =
        includesAny(lower, ['who won', 'winner', 'won']) ||
        (includesAny(lower, ['final']) && includesAny(lower, ['who', 'winner', 'won']));
      const top = hits[0];
      const topScore = scores[0] ?? 0;
      const secondScore = scores[1] ?? 0;
      const clearWinnerAsk =
        whoWon &&
        top.winnerName &&
        (hits.length === 1 || topScore >= secondScore + 8);

      if (clearWinnerAsk) {
        const when = [top.completedDate, top.completedTime].filter(Boolean).join(' ');
        const matchup =
          top.player1 || top.player2
            ? `${top.player1 || top.teamA || 'Side A'} vs ${top.player2 || top.teamB || 'Side B'}`
            : top.details || `${top.teamA || 'Side A'} vs ${top.teamB || 'Side B'}`;
        const stage = top.stage ? ` (${top.stage})` : '';
        return {
          text: `${top.winnerName} won${stage} — ${top.category || 'Match'}: ${matchup}${
            top.result ? ` · ${top.result}` : ''
          }${when ? ` · ${when}` : ''}.`,
          links: [{ label: 'All results', to: '/results' }]
        };
      }

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
    let list = findFixtures(tokens, fixtures, 10, q).filter((f) => f.status !== 'completed');
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
  const fixtureHits = findFixtures(tokens, fixtures, 8, q);
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
  'Who won Men\'s Singles >35 final?',
  'How many matches played on 9th August?',
  'Who is on Team C?',
  'What’s on court now?',
  'Show tournament stats',
  'Show recent results'
] as const;
