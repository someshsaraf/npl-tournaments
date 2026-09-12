import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/**
 * Shows a recovery code exactly once with a copy button and an explicit
 * "I've saved it" confirmation — the server never stores or shows this
 * code again after this screen.
 */
export function RecoveryCodeReveal({
  code,
  onContinue,
  continueLabel = "I've saved it - continue"
}: {
  code: string;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="npl-glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <KeyRound className="size-5 text-amber-600 shrink-0" aria-hidden />
        <h2 className="text-base font-bold text-ink">Save your recovery code</h2>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        If you ever forget your PIN, this code is the only way to reset it yourself - we can't show
        it to you again. Write it down or save it somewhere safe now.
      </p>
      <div className="flex items-center gap-2">
        <p className="flex-1 font-mono text-lg sm:text-xl tracking-[0.15em] text-center text-ink bg-paper-soft border border-line rounded-lg py-3">
          {code}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy recovery code"
          className="shrink-0 inline-flex items-center justify-center size-11 rounded-lg border border-line bg-white text-ink-soft hover:bg-paper-soft hover:text-ink transition-colors"
        >
          {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>
      <label className="flex items-center gap-2.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="size-4 accent-ink"
        />
        I've saved this code somewhere safe.
      </label>
      <button
        type="button"
        onClick={onContinue}
        disabled={!acknowledged}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink text-white font-bold text-sm px-5 py-2.5 hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {continueLabel}
      </button>
    </div>
  );
}

export default RecoveryCodeReveal;
