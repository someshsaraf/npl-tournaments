import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { RecoveryCodeReveal } from '../components/RecoveryCodeReveal';
import { useAuth } from '../contexts/AuthContext';
import { resetPinWithCode, verifyRecoveryCode } from '../utils/authClient';

type Step = 'identify' | 'pin' | 'done';

const INPUT_CLASS =
  'w-full bg-paper-soft border border-line text-ink text-sm px-3.5 py-2.5 rounded-lg focus:outline-none focus:border-slate-400 disabled:opacity-50';

export default function ForgotPinPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<Step>('identify');
  const [identifier, setIdentifier] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyRecoveryCode(identifier.trim(), recoveryCode.trim());
      setStep('pin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify recovery code.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    if (!/^\d{6}$/.test(newPin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== newPinConfirm) {
      setError('PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await resetPinWithCode(identifier.trim(), recoveryCode.trim(), newPin);
      await refresh();
      setNewRecoveryCode(res.newRecoveryCode);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset PIN.');
    } finally {
      setBusy(false);
    }
  };

  if (user && step !== 'done') {
    return <Navigate to="/" replace />;
  }

  if (step === 'done' && newRecoveryCode) {
    return (
      <div className="relative max-w-md mx-auto space-y-6">
        <div className="npl-blob -top-16 -right-16 size-72 bg-rose-500/20" aria-hidden />
        <Reveal className="relative z-10 space-y-1.5 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
            PIN reset
          </p>
          <h1 className="npl-flame-text portal-display text-4xl tracking-wide">All set!</h1>
        </Reveal>
        <p className="relative z-10 text-center text-sm text-slate-500">
          Your old recovery code no longer works - here's a fresh one.
        </p>
        <Reveal delayMs={80} className="relative z-10">
          <RecoveryCodeReveal
            code={newRecoveryCode}
            onContinue={() => navigate('/')}
            continueLabel="I've saved it - go to Home"
          />
        </Reveal>
      </div>
    );
  }

  return (
    <div className="relative max-w-md mx-auto space-y-6">
      <div className="npl-blob -top-16 -right-16 size-72 bg-rose-500/20" aria-hidden />

      <Reveal className="relative z-10 space-y-1.5 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
          Account recovery
        </p>
        <h1 className="npl-flame-text portal-display text-4xl tracking-wide">Forgot PIN</h1>
      </Reveal>

      <Reveal delayMs={80} className="relative z-10 npl-glass rounded-2xl p-6 space-y-4">
        {step === 'identify' ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerify();
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-ink-soft">Username or email</span>
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
              <span className="text-xs font-semibold text-ink-soft">Recovery code</span>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                disabled={busy}
                className={`${INPUT_CLASS} tracking-[0.15em] text-center font-mono`}
              />
              <span className="text-[11px] text-slate-500">
                The code you saved when you created your account.
              </span>
            </label>
            <button
              type="submit"
              disabled={busy || !identifier.trim() || !recoveryCode.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink text-white font-bold text-sm px-5 py-2.5 hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Verify
            </button>
          </form>
        ) : null}

        {step === 'pin' ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleReset();
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-ink-soft">New 6-digit PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                disabled={busy}
                className={`${INPUT_CLASS} tracking-[0.3em] text-center text-lg font-bold`}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-ink-soft">Confirm new PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                disabled={busy}
                className={`${INPUT_CLASS} tracking-[0.3em] text-center text-lg font-bold`}
              />
            </label>
            <button
              type="submit"
              disabled={busy || newPin.length !== 6 || newPinConfirm.length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink text-white font-bold text-sm px-5 py-2.5 hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Set new PIN
            </button>
          </form>
        ) : null}

        {error ? (
          <p className="text-xs text-rose-600 font-medium" role="alert">
            {error}
          </p>
        ) : null}
      </Reveal>

      <Reveal delayMs={120} className="relative z-10 npl-glass rounded-2xl p-4 flex gap-3">
        <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Lost your recovery code too? There's no self-service option beyond this - contact an
          admin directly and they can reset your PIN after confirming who you are.
        </p>
      </Reveal>

      <p className="relative z-10 text-center text-xs text-slate-500">
        Remembered your PIN?{' '}
        <Link to="/login" className="text-amber-700 hover:text-amber-800 font-semibold">
          Log in
        </Link>
      </p>
    </div>
  );
}
