import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { SportCard } from '../data/sports';

/**
 * Full-bleed photo header for a sport hub. `meta` is a short line under the
 * title (dates · venue); `actions` sit below it.
 */
export function SportHero({
  card,
  eyebrow,
  title,
  meta,
  live,
  actions
}: {
  card: SportCard;
  eyebrow?: string;
  title?: string;
  meta?: string;
  live?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Link
        to="/sports"
        className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        All sports
      </Link>
      <section className="relative rounded-3xl overflow-hidden border border-line shadow-xl min-h-[300px] sm:min-h-[380px]">
        {card.heroImage ? (
          <img
            src={card.heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: card.heroFocus ?? 'center' }}
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10" />
        <div className="relative h-full min-h-[300px] sm:min-h-[380px] flex flex-col justify-end p-5 sm:p-8 space-y-2.5 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500 text-white">
                <span className="npl-glow-pulse size-1.5 rounded-full bg-white" aria-hidden />
                Live now
              </span>
            ) : null}
            {eyebrow ? (
              <span className="text-[11px] uppercase tracking-[0.16em] text-lime-300 font-bold">{eyebrow}</span>
            ) : null}
          </div>
          <h1 className="text-white portal-display text-5xl sm:text-7xl tracking-wide leading-[0.9] [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
            {title ?? card.label}
          </h1>
          {meta ? <p className="text-sm font-mono text-lime-200/90">{meta}</p> : null}
          <p className="text-sm text-slate-200/90 leading-relaxed max-w-lg">{card.tagline}</p>
          {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
        </div>
      </section>
    </div>
  );
}

/** Pill-style tab bar shared by the sport hubs. */
export function HubTabs<K extends string>({
  tabs,
  active,
  onChange
}: {
  tabs: ReadonlyArray<{ key: K; label: string; badge?: string }>;
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg whitespace-nowrap font-bold uppercase tracking-wide transition-all ${
            active === t.key
              ? 'bg-ink text-white shadow-sm'
              : 'bg-paper-soft text-ink-soft hover:text-ink border border-line'
          }`}
        >
          {t.label}
          {t.badge ? (
            <span className="rounded-full bg-rose-500 text-white text-[9px] px-1.5 py-0.5 leading-none">{t.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
