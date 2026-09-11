const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// "admin" is the fixed staff-login username (separate credential system) —
// the public login page tries it as a fallback, so no resident can register it.
const RESERVED_USERNAMES = new Set(['admin']);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(trimmed)) return null;
  return trimmed;
}

/** RTDB keys can't contain . # $ [ ] / — emails need escaping to use as a key segment. */
export function emailToKey(email: string): string {
  return email.replace(/[.#$[\]/]/g, (ch) => `,${ch.charCodeAt(0)},`);
}
