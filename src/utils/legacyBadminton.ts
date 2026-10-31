import { FIXTURES } from '../data/tournamentData';
import {
  buildBlankTournament,
  type FixtureSide,
  type FixtureStage,
  type Tournament,
  type TournamentCategory,
  type TournamentEntry,
  type TournamentFormat
} from '../data/tournament';
import { newId } from './tournament';

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/** "9-Aug-26" → "2026-08-09" ('' if it doesn't parse). */
export function legacyDateToIso(raw: string): string {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(raw.trim());
  const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
  return m && month ? `20${m[3]}-${month}-${m[1].padStart(2, '0')}` : '';
}

function stageFor(raw: string): FixtureStage {
  const s = raw.trim().toLowerCase();
  if (s.includes('final') && !s.includes('semi') && !s.includes('quarter')) return 'final';
  if (s.includes('semi')) return 'semifinal';
  if (s.includes('quarter')) return 'quarterfinal';
  return 'pool';
}

function formatFor(category: string, sides: string[]): TournamentFormat {
  if (/team/i.test(category)) return 'team';
  if (/doubles/i.test(category) || sides.some((s) => s.includes('&'))) return 'doubles';
  return 'singles';
}

/**
 * The NPL 2026 badminton schedule that used to be built into the code
 * (FIXTURES), as an editable tournament. Fixture ids are kept, so results
 * already recorded against them stay attached. Each category gets an entry
 * list ("Finalists") holding the named sides; "TBD" sides stay open.
 */
export function buildTournamentFromLegacyBadminton(): Tournament {
  const t = buildBlankTournament('badminton', 2026);
  t.formats = [];
  t.divisions = [];
  const categories = new Map<string, TournamentCategory>();

  for (const f of FIXTURES) {
    const sides = [f.teamA ?? '', f.teamB ?? ''].map((s) => s.trim());
    let cat = categories.get(f.category);
    if (!cat) {
      cat = {
        id: newId('cat'),
        format: formatFor(f.category, sides),
        name: f.category,
        custom: true,
        pools: [{ id: newId('p'), name: 'Finalists', entries: [], listOnly: true }],
        qualifiersPerPool: 1,
        knockoutStart: 'none'
      };
      categories.set(f.category, cat);
    }
    const pool = cat.pools[0];
    const sideFor = (name: string): FixtureSide => {
      if (!name || /^tbd$/i.test(name)) return { kind: 'tbd' };
      let entry: TournamentEntry | undefined = pool.entries.find((e) => e.name === name);
      if (!entry) {
        entry = {
          id: newId('e'),
          name,
          players: cat!.format === 'doubles' ? name.split(/\s*&\s*/) : cat!.format === 'team' ? [] : [name]
        };
        pool.entries.push(entry);
      }
      return { kind: 'entry', entryId: entry.id };
    };
    t.fixtures.push({
      id: f.id,
      categoryId: cat.id,
      stage: stageFor(f.stage),
      ...(stageFor(f.stage) === 'pool' ? { poolId: pool.id } : {}),
      sideA: sideFor(sides[0]),
      sideB: sideFor(sides[1]),
      date: legacyDateToIso(f.date),
      time: /^\d{2}:\d{2}$/.test(f.time) ? f.time : '',
      court: '',
      order: t.fixtures.length
    });
  }
  t.categories = [...categories.values()];
  return t;
}
