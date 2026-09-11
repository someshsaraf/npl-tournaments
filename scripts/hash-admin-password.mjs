#!/usr/bin/env node
/**
 * Generates the ADMIN_PASSWORD_HASH value to set on Vercel.
 *
 * Usage:
 *   AUTH_PEPPER="<same value you set on Vercel>" node scripts/hash-admin-password.mjs "611608"
 *
 * The output is a bcrypt hash of "<password>:<AUTH_PEPPER>" — matching what
 * api/_lib/secrets.ts computes at login time. Never commit the plaintext
 * password or AUTH_PEPPER; only the printed hash goes into Vercel env vars.
 */
import bcrypt from 'bcryptjs';

const password = process.argv[2];
const pepper = process.env.AUTH_PEPPER;

if (!password) {
  console.error('Usage: AUTH_PEPPER="..." node scripts/hash-admin-password.mjs "<password>"');
  process.exit(1);
}
if (!pepper || pepper.trim().length < 16) {
  console.error('Set AUTH_PEPPER (same value as on Vercel, 16+ chars) in the environment first.');
  process.exit(1);
}

const hash = await bcrypt.hash(`${password}:${pepper}`, 12);
console.log(hash);
