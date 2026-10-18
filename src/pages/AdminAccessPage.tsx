import { useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { AdminNav } from '../components/AdminNav';
import { Btn, ConfirmBtn, FieldLabel, Notice, Panel, inputCls } from '../components/lawnTennis/admin/ui';
import { fetchAccessCodeInfo, setCommunityAccessCode, type AccessCodeInfo } from '../utils/authClient';

const WORDS = [
  'ace', 'rally', 'smash', 'volley', 'serve', 'spin', 'lob', 'drop', 'court', 'net', 'deuce', 'match',
  'banyan', 'mango', 'neem', 'lotus', 'maple', 'cedar', 'falcon', 'kestrel', 'heron', 'sparrow', 'tiger', 'panther'
];

/** Easy to read out or type on a TV remote, e.g. "volley-maple-48" (~16 bits per word pair + digits). */
function generateCode(): string {
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  const a = WORDS[r[0] % WORDS.length];
  let b = WORDS[r[1] % WORDS.length];
  if (b === a) b = WORDS[(r[1] + 1) % WORDS.length];
  return `${a}-${b}-${10 + (r[2] % 90)}`;
}

/**
 * /admin/access — the shared community code residents and court screens
 * use. Changing it signs every device out; share the new one on the
 * community group / notice board. The admin code itself is fixed in the
 * server's .env (ADMIN_CODE_HASH).
 */
export default function AdminAccessPage() {
  const [info, setInfo] = useState<AccessCodeInfo | null>(null);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAccessCodeInfo()
      .then(setInfo)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load access settings.'));
  }, []);

  const trimmed = code.trim();
  const valid = trimmed.length >= 6 && trimmed.length <= 64;

  const save = async () => {
    setError(null);
    try {
      await setCommunityAccessCode(trimmed);
      setSaved(trimmed.toLowerCase().replace(/\s+/g, ' '));
      setCode('');
      setInfo(await fetchAccessCodeInfo());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the code.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-6 max-w-3xl mx-auto">
      <AdminNav subtitle="Access" />

      <Panel
        title="Community access code"
        subtitle="One shared code unlocks the resident pages and the court score screens. No accounts or personal details are collected."
      >
        <p className="text-sm text-slate-300">
          {info === null
            ? 'Loading…'
            : !info.configured
              ? 'No community code is set yet — set one below (or COMMUNITY_ACCESS_CODE in the server .env).'
              : info.source === 'env'
                ? 'Currently using COMMUNITY_ACCESS_CODE from the server .env.'
                : `Changed here on ${info.updatedAt ? new Date(info.updatedAt).toLocaleString() : 'an earlier date'}.`}
        </p>

        <div className="space-y-2">
          <FieldLabel>New code (6–64 characters, not case-sensitive)</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. volley-maple-48"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              className={`${inputCls} flex-1 min-w-[12rem] font-mono`}
            />
            <Btn onClick={() => setCode(generateCode())}>
              <RefreshCw className="size-3.5" aria-hidden /> Generate
            </Btn>
          </div>
        </div>

        <ConfirmBtn tone="primary" disabled={!valid} onConfirm={() => void save()} confirmLabel="Sign every device out and switch?">
          Set as the community code
        </ConfirmBtn>
        <p className="text-[11px] text-slate-500">
          Every phone and court screen will need the new code — including the TVs at the courts.
        </p>

        {saved ? (
          <Notice tone="ok">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                New code: <span className="font-mono text-base font-bold text-white">{saved}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(saved).then(() => setCopied(true));
                }}
                className="inline-flex items-center gap-1 text-xs font-bold uppercase text-emerald-200 hover:text-white"
              >
                <Copy className="size-3.5" aria-hidden /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-emerald-300/80">Share it on the community group. This device stays signed in as staff.</p>
          </Notice>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Panel>

      <Panel title="Admin code" subtitle="Fixed on the server, so it can't be changed or lost from this page.">
        <p className="text-sm text-slate-300">
          To change it, run <code className="font-mono text-lime-300">node scripts/hash-admin-password.mjs --generate</code> on
          the server, put the printed hash in <code className="font-mono text-lime-300">ADMIN_CODE_HASH</code> in .env, and restart.
        </p>
      </Panel>
    </div>
  );
}
