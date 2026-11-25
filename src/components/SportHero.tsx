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
  // Skip the small line above the title when it would just repeat it.
  const showEyebrow = !!eyebrow && eyebrow.toLowerCase() !== (title ?? card.label).toLowerCase();
  return (
    <div className="space-y-4">
      <Link
        to="/sports"
        className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        All sports
      </Link>
      {/*
        Phones: title, dates and buttons in a dark band above the photo, so the
        whole photo shows. Wider screens: the text sits over the photo's top edge.
      */}
      <section className="relative flex flex-col rounded-3xl overflow-hidden border border-line shadow-xl bg-slate-950 sm:min-h-[380px]">
        <div
          className={`relative order-2 sm:absolute sm:inset-0 ${card.heroImage ? 'aspect-[4/3] sm:aspect-auto' : 'hidden sm:block'}`}
        >
          {card.heroImage ? (
            <img
              src={card.heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: card.heroFocus ?? 'center' }}
              loading="eager"
            />
          ) : (
            // No photo yet (Table Tennis): a table-tennis table — centre line, net, ball.
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_#1e3a8a_0%,_#0f172a_55%,_#020617_100%)]" aria-hidden>
              <div className="absolute inset-6 rounded-2xl border-2 border-white/10" />
              <div className="absolute inset-y-6 left-1/2 w-px bg-white/10" />
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-white/15" />
              <span className="absolute top-[20%] right-[14%] size-5 rounded-full bg-orange-300 shadow-[0_0_24px_rgba(253,186,116,0.7)]" />
            </div>
          )}
          {/* Phones: a short fade from the text band into the photo. Wider: shade behind the text. */}
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950 to-transparent sm:hidden" />
          <div className="absolute inset-0 hidden sm:block bg-gradient-to-b from-black/90 via-black/40 via-45% to-transparent" />
        </div>
        <div className="relative order-1 flex flex-col justify-start p-5 pb-3 sm:p-8 space-y-2.5 max-w-3xl">
          {live || showEyebrow ? (
          <div className="flex items-center gap-2 flex-wrap">
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500 text-white">
                <span className="npl-glow-pulse size-1.5 rounded-full bg-white" aria-hidden />
                Live now
              </span>
            ) : null}
            {showEyebrow ? (
              <span className="text-[11px] uppercase tracking-[0.16em] text-lime-300 font-bold">{eyebrow}</span>
            ) : null}
          </div>
          ) : null}
          <h1 className="text-white portal-display text-[2.75rem] sm:text-7xl tracking-wide leading-[0.9] [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
            {title ?? card.label}
          </h1>
          {meta ? <p className="text-sm font-mono text-lime-200/90">{meta}</p> : null}
          {card.tagline ? <p className="text-sm text-slate-200/90 leading-relaxed max-w-lg">{card.tagline}</p> : null}
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
