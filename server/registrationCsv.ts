import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeName, type PlayerGender, type RegistrationKey } from '../src/data/registration.js';

/**
 * Men/Women for registered players, read from the organisers' CSV at
 * seed/{sport}-registrations.csv (the admin CSV export plus a "Category" —
 * or "Gender" — column: Men / Women; anything else, e.g. "Kid", is skipped).
 * Keyed by normalizeName. Empty when there's no file. Read once at startup:
 * update the CSV and redeploy/restart to change it.
 */
export function gendersFromCsv(sport: RegistrationKey): Map<string, PlayerGender> {
  const out = new Map<string, PlayerGender>();
  const file = resolve(process.env.SEED_DIR || 'seed', `${sport}-registrations.csv`);
  if (!existsSync(file)) return out;
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const nameCol = header.indexOf('name');
  const genderCol = header.findIndex((h) => h === 'category' || h === 'gender');
  if (nameCol < 0 || genderCol < 0) {
    console.warn(`${file}: needs a "Name" and a "Category" (Men / Women) column — ignored.`);
    return out;
  }
  for (const r of rows) {
    const g = (r[genderCol] ?? '').trim().toLowerCase();
    const gender = /^(women|woman|female|f)$/.test(g) ? 'f' : /^(men|man|male|m)$/.test(g) ? 'm' : null;
    if (gender && r[nameCol]?.trim()) out.set(normalizeName(r[nameCol]), gender);
  }
  console.log(`${sport}: Men/Women for ${out.size} player(s) from ${file}`);
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
