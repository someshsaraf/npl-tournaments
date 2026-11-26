import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeName, type PlayerGender, type RegistrationKey, type RosterPlayer } from '../src/data/registration.js';

/**
 * Men/Women for registered players, read from the organisers' CSV at
 * seed/{sport}-registrations.csv (the admin CSV export plus a "Category" —
 * or "Gender" — column: Men / Women; anything else, e.g. "Kid", is skipped).
 * Keyed by normalizeName. Empty when there's no file. Read once at startup:
 * update the CSV and redeploy/restart to change it.
 */
export function gendersFromCsv(sport: RegistrationKey): Map<string, PlayerGender> {
  const out = new Map<string, PlayerGender>();
  for (const p of rosterFromCsv(sport, true)) {
    if (p.group !== 'kids') out.set(normalizeName(p.name), p.group === 'women' ? 'f' : 'm');
  }
  if (out.size) console.log(`${sport}: Men/Women for ${out.size} player(s) from the seed CSV`);
  return out;
}

/**
 * Every player in seed/{sport}-registrations.csv: Kids / Women / Men (from the
 * "Category" column, or the age group for kids), Level A/B, and whether they
 * entered singles / doubles. Read fresh on each call, so a replaced CSV
 * shows up without a restart. Admin-only (api/registration-roster.ts).
 */
export function rosterFromCsv(sport: RegistrationKey, quiet = false): RosterPlayer[] {
  const file = resolve(process.env.SEED_DIR || 'seed', `${sport}-registrations.csv`);
  if (!existsSync(file)) return [];
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const nameCol = col('name');
  const groupCol = col('category', 'gender');
  const ageCol = col('age group');
  const levelCol = col('level');
  const singlesCol = col('singles');
  const doublesCol = col('doubles');
  if (nameCol < 0 || groupCol < 0) {
    if (!quiet) console.warn(`${file}: needs a "Name" and a "Category" (Men / Women / Kid) column — ignored.`);
    return [];
  }
  const yes = (r: string[], c: number) => c >= 0 && /^(yes|y|true|1|x|✓)$/i.test((r[c] ?? '').trim());
  const out: RosterPlayer[] = [];
  for (const r of rows) {
    const name = (r[nameCol] ?? '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const g = (r[groupCol] ?? '').trim().toLowerCase();
    const age = ageCol >= 0 ? (r[ageCol] ?? '').toLowerCase() : '';
    const group = /^(kid|kids|child|junior)$/.test(g) || /kid/.test(age)
      ? 'kids'
      : /^(women|woman|female|f)$/.test(g)
        ? 'women'
        : /^(men|man|male|m)$/.test(g)
          ? 'men'
          : null;
    if (!group) continue;
    const lv = levelCol >= 0 ? (r[levelCol] ?? '').trim().toUpperCase() : '';
    out.push({
      name,
      group,
      level: lv === 'A' || lv === 'B' ? lv : '',
      singles: singlesCol < 0 || yes(r, singlesCol),
      doubles: doublesCol < 0 || yes(r, doublesCol)
    });
  }
  return out;
}

/** Minimal CSV reader: commas, double-quoted cells with "" escapes, CRLF or LF. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) out.push(row);
  return out;
}
