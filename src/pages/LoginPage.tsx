import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { useAuth } from '../contexts/AuthContext';
import { login } from '../utils/authClient';

const INPUT_CLASS =
  'w-full bg-slate-900/80 border border-white/10 text-slate-100 text-sm px-3.5 py-2.5 rounded-lg focus:outline-none focus:border-orange-400/60 disabled:opacity-50';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(identifier.trim(), pin);
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative max-w-md mx-auto space-y-6">
      <div className="npl-blob -top-16 -right-16 size-72 bg-rose-500/20" aria-hidden />

      <Reveal className="relative z-10 space-y-1.5 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90 font-semibold">
          Welcome back
        </p>
        <h1 className="npl-flame-text portal-display text-4xl tracking-wide">Log in</h1>
      </Reveal>

      <Reveal
        delayMs={80}
        className="relative z-10 npl-glass rounded-2xl p-6 space-y-4"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Username or email</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="yourname or you@example.com"
              autoComplete="username"
              disabled={busy}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">6-digit PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              autoComplete="current-password"
              disabled={busy}
              className={`${INPUT_CLASS} tracking-[0.3em] text-center text-lg font-bold`}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !identifier.trim() || pin.length !== 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-slate-950 font-bold text-sm px-5 py-2.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Log in
          </button>
        </form>
        <p className="text-center">
          <Link to="/forgot-pin" className="text-xs text-slate-400 hover:text-white font-semibold">
            Forgot your PIN?
          </Link>
        </p>
        {error ? (
          <p className="text-xs text-rose-300 font-medium" role="alert">
            {error}
          </p>
        ) : null}
      </Reveal>

      <Reveal delayMs={120} className="relative z-10 npl-glass rounded-2xl p-4 flex gap-3">
        <ShieldCheck className="size-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Your personal data is never sold or shared. Your PIN is protected using one-way hashing -
          not even we can see it - and all data is encrypted in transit and access-restricted at
          the database level.
        </p>
      </Reveal>

      <p className="relative z-10 text-center text-xs text-slate-500">
        New here?{' '}
        <Link to="/register" className="text-amber-300 hover:text-amber-200 font-semibold">
          Create an account
        </Link>
      </p>
    </div>
  );
}
