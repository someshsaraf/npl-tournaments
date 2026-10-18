import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Dark admin card. */
export function Panel({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-lime-300">{title}</h2>
          {subtitle ? <p className="text-xs text-slate-400 max-w-2xl">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{children}</span>;
}

/** Input look without a width, for controls that size themselves. */
export const inputBaseCls =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-lime-400';

export const inputCls = `w-full ${inputBaseCls}`;

/**
 * Text input that keeps local state and commits on blur / Enter, so typing
 * doesn't write the whole tournament to the data store on every keystroke.
 */
export function CommitInput({
  value,
  onCommit,
  className = inputCls,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(value);
      }}
      className={className}
    />
  );
}

export function Chip({
  active,
  onClick,
  children,
  disabled
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors disabled:opacity-40 ${
        active
          ? 'bg-lime-300 text-slate-950 border-lime-200'
          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

type BtnTone = 'primary' | 'neutral' | 'danger';
const TONE: Record<BtnTone, string> = {
  primary: 'bg-lime-300 text-slate-950 hover:bg-lime-200 border-lime-200',
  neutral: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700',
  danger: 'bg-red-950/40 text-red-300 hover:bg-red-950/70 border-red-900/60'
};

export function Btn({
  tone = 'neutral',
  onClick,
  children,
  disabled,
  small
}: {
  tone?: BtnTone;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-bold uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        small ? 'text-[10px] px-2.5 py-1.5' : 'text-xs px-3.5 py-2'
      } ${TONE[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * Two-step button for destructive actions — no window.confirm, which court
 * kiosks/tablets often suppress. First click arms it for 4 seconds.
 */
export function ConfirmBtn({
  onConfirm,
  children,
  confirmLabel = 'Click again to confirm',
  tone = 'danger',
  small,
  disabled
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  tone?: BtnTone;
  small?: boolean;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return (
    <Btn
      tone={armed ? 'danger' : tone}
      small={small}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 4000);
      }}
    >
      {armed ? confirmLabel : children}
    </Btn>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'warn' | 'ok'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-red-800 bg-red-950/40 text-red-200'
      : tone === 'warn'
        ? 'border-amber-800/70 bg-amber-950/30 text-amber-200'
        : 'border-emerald-800 bg-emerald-950/40 text-emerald-200';
  return <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
}
