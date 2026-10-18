#!/usr/bin/env node
/**
 * Creates the ADMIN_CODE_HASH value for the server .env (the fixed staff code).
 *
 *   node scripts/hash-admin-password.mjs --generate      make a strong random code
 *   node scripts/hash-admin-password.mjs "<your code>"   hash a code you chose
 *   node scripts/hash-admin-password.mjs --check         test a code against .env's hash
 *
 * AUTH_PEPPER is read from the environment or ./.env, and must be the value
 * the server uses. Only the hash goes into .env — keep the code itself in a
 * password manager and share it with staff directly.
 */
import { existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';

if (!process.env.AUTH_PEPPER && existsSync('.env')) process.loadEnvFile('.env');
const pepper = process.env.AUTH_PEPPER;
if (!pepper || pepper.trim().length < 16) {
  console.error('Set AUTH_PEPPER (16+ chars) in .env or the environment first.');
  process.exit(1);
}

// 4 groups of 4 from an unambiguous alphabet (no 0/O/1/I/L) ≈ 80 bits.
function generateCode() {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += alphabet[randomInt(alphabet.length)];
    groups.push(s);
  }
  return groups.join('-');
}

const arg = process.argv[2];

if (arg === '--check') {
  const hash = (process.env.ADMIN_CODE_HASH || process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(hash)) {
    console.error('ADMIN_CODE_HASH in .env is missing or not a bcrypt hash.');
    process.exit(1);
  }
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question('Admin code to test: ')).trim();
  rl.close();
  const ok =
    (await bcrypt.compare(`${typed}:${pepper}`, hash)) ||
    (await bcrypt.compare(`${typed.toUpperCase()}:${pepper}`, hash));
  console.log(
    ok
      ? 'OK — that code matches ADMIN_CODE_HASH. If login still fails, restart the server.'
      : 'No match. Either this code and the hash came from different --generate runs, or AUTH_PEPPER changed since. Run --generate again and paste the new hash.'
  );
  process.exit(ok ? 0 : 1);
}
if (!arg) {
  console.error('Usage: node scripts/hash-admin-password.mjs --generate   |   "<your code>"');
  process.exit(1);
}
const generated = arg === '--generate';
const code = generated ? generateCode() : arg.trim();
if (!generated && code.length < 10) {
  console.error('Pick an admin code of at least 10 characters (or use --generate).');
  process.exit(1);
}

const hash = await bcrypt.hash(`${code}:${pepper}`, 12);
if (generated) console.log(`Admin code (give this to staff; it is not stored anywhere): ${code}\n`);
// Single quotes keep "$" in the bcrypt hash literal for .env and docker compose.
console.log(`ADMIN_CODE_HASH='${hash}'`);
