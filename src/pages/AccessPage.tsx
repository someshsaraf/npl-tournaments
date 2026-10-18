import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { enterAccessCode } from '../utils/authClient';

/** A deep link to return to after unlocking (same-site paths only), or null. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw === '/' || raw.startsWith('/?') || raw.startsWith('/access')) return null;
  return raw;
}

/**
 * The site's front page (/): always asks for a code, and the code decides
 * where you go — community code → sport picker (/sports), admin code → staff
 * tools (/admin/sports). A locked deep link (?next=, e.g. a court TV on
 * /score/lawn-tennis) is returned to instead. No accounts or personal details.
 */
export default function AccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { access, admin, refresh } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await enterAccessCode(code);
      await refresh();
      navigate(next ?? (result.admin ? '/admin/sports' : '/sports'), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-950 text-white">
      <img
        src="/sports/lawn-tennis/lt-2025-3.jpg"
        alt=""
        className="fixed inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="fixed inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
      <main className="relative min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6 text-center">
          <img
            src="/nature-walk-logo-1.png"
            alt="Renaissance Nature Walk"
            className="mx-auto size-16 rounded-2xl bg-white p-1 shadow-lg"
          />
          <div className="space-y-2">
            <h1
              className="text-5xl tracking-wide leading-none"
              style={{ fontFamily: '"Bebas Neue", "Arial Narrow", Impact, sans-serif' }}
            >
              Renaissance Nature Walk
            </h1>
            <p className="text-slate-300">Sports schedules, live scores and photos for our community.</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="block text-left space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-lime-300">Community access code</span>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                placeholder="Enter the code"
                className="w-full rounded-xl bg-white/10 border border-white/25 px-4 py-3.5 text-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-300 disabled:opacity-50"
              />
            </label>
            <button
              type="submit"
              disabled={busy || code.trim().length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 text-slate-950 font-black uppercase tracking-wide py-3.5 hover:bg-lime-200 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <KeyRound className="size-5" aria-hidden />}
              Enter
            </button>
            {error ? (
              <p className="text-sm text-amber-300 font-semibold" role="alert">
                {error}
              </p>
            ) : null}
          </form>
          <p className="text-sm text-slate-400">
            Don't have the code? Ask in the community group or check the clubhouse notice board.
          </p>
          {access ? (
            <Link
              to={next ?? (admin ? '/admin/sports' : '/sports')}
              className="inline-block text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-white"
            >
              Already unlocked on this device — continue →
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
