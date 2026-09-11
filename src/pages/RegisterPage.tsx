import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { RecoveryCodeReveal } from '../components/RecoveryCodeReveal';
import { useAuth } from '../contexts/AuthContext';
import { checkUsername, register } from '../utils/authClient';

const INPUT_CLASS =
  'w-full bg-slate-900/80 border border-white/10 text-slate-100 text-sm px-3.5 py-2.5 rounded-lg focus:outline-none focus:border-orange-400/60 disabled:opacity-50';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const usernameCheckId = useRef(0);

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const id = ++usernameCheckId.current;
    const t = setTimeout(() => {
      void checkUsername(trimmed).then((res) => {
        if (usernameCheckId.current !== id) return;
        setUsernameStatus(res.available ? 'available' : 'taken');
      });
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const canSubmit =
    email.trim() && usernameStatus === 'available' && pin.length === 6 && pinConfirm.length === 6;

  const handleCreateAccount = async () => {
    setError(null);
    if (usernameStatus !== 'available') {
      setError('Choose an available username.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await register(email.trim().toLowerCase(), username.trim().toLowerCase(), pin);
      await refresh();
      setRecoveryCode(res.recoveryCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  if (user && !recoveryCode) {
    return <Navigate to="/" replace />;
  }

  if (recoveryCode) {
    return (
      <div className="relative max-w-md mx-auto space-y-6">
        <div className="npl-blob -top-16 -left-16 size-72 bg-orange-500/20" aria-hidden />
        <Reveal className="relative z-10 space-y-1.5 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90 font-semibold">
            Account created
          </p>
          <h1 className="npl-flame-text portal-display text-4xl tracking-wide">Welcome!</h1>
        </Reveal>
        <Reveal delayMs={80} className="relative z-10">
          <RecoveryCodeReveal code={recoveryCode} onContinue={() => navigate('/')} />
        </Reveal>
      </div>
    );
  }

  return (
    <div className="relative max-w-md mx-auto space-y-6">
      <div className="npl-blob -top-16 -left-16 size-72 bg-orange-500/20" aria-hidden />

      <Reveal className="relative z-10 space-y-1.5 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90 font-semibold">
          Create account
        </p>
        <h1 className="npl-flame-text portal-display text-4xl tracking-wide">Register</h1>
      </Reveal>

      <Reveal delayMs={80} className="relative z-10 npl-glass rounded-2xl p-6 space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreateAccount();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Username</span>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="yourname"
                autoComplete="username"
                disabled={busy}
                className={`${INPUT_CLASS} pr-9`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' ? (
                  <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden />
                ) : usernameStatus === 'available' ? (
                  <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
                ) : usernameStatus === 'taken' ? (
                  <XCircle className="size-4 text-rose-400" aria-hidden />
                ) : null}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              {usernameStatus === 'taken'
                ? 'That username is taken.'
                : '3-20 characters: lowercase letters, numbers, underscore.'}
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
              className={INPUT_CLASS}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Create a 6-digit PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              disabled={busy}
              className={`${INPUT_CLASS} tracking-[0.3em] text-center text-lg font-bold`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">Confirm PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              disabled={busy}
              className={`${INPUT_CLASS} tracking-[0.3em] text-center text-lg font-bold`}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-slate-950 font-bold text-sm px-5 py-2.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Create account
          </button>
        </form>

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
        Already have an account?{' '}
        <Link to="/login" className="text-amber-300 hover:text-amber-200 font-semibold">
          Log in
        </Link>
      </p>
    </div>
  );
}
