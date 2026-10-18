import { Link } from 'react-router-dom';
import { ArrowRight, Camera, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { HomeEventAdBanner, useHomeEventAds } from '../components/HomeEventAdBanner';
import { Reveal } from '../components/Reveal';
import { SPORT_CARDS, type SportCard } from '../data/sports';
import { isMatchOnCourt, useSportLiveMatch } from '../hooks/useSportLiveMatch';
import type { Sport } from '../data/tournamentData';

/**
 * Landing = sport picker. Each card leads to that sport's hub (schedule,
 * live, recordings, photos). Sports not built yet show as "Coming soon".
 */
export default function HomePage() {
  const homeAds = useHomeEventAds();
  // Staff-only shortcut — residents (community code) never see it.
  const { admin } = useAuth();

  return (
    <div className="relative space-y-10">
      <Reveal className="relative z-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
              Renaissance Nature Walk · Sports
            </p>
            <h1 className="portal-display text-5xl sm:text-6xl text-ink leading-[0.95] tracking-wide">
              Pick your sport
            </h1>
            <p className="text-sm sm:text-base text-ink-soft">
              Schedules, live scores, streams, recordings and photos for every tournament on our
              courts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/photos"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink hover:bg-paper-soft transition-colors"
            >
              <Camera className="size-3.5" aria-hidden />
              Photos
            </Link>
            {admin ? (
              <Link
                to="/admin/sports"
                className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3.5 py-2 text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                <ShieldCheck className="size-3.5" aria-hidden />
                Admin
              </Link>
            ) : null}
          </div>
        </header>
      </Reveal>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
        {SPORT_CARDS.map((card, i) => (
          <Reveal key={card.slug} delayMs={80 + i * 70} className="min-w-0">
            {card.sport ? <SportTile card={card} sport={card.sport} /> : <ComingSoonTile card={card} />}
          </Reveal>
        ))}
      </div>

      {homeAds.length > 0 ? <HomeEventAdBanner ads={homeAds} /> : null}
    </div>
  );
}

function SportTile({ card, sport }: { card: SportCard; sport: Sport }) {
  const live = isMatchOnCourt(useSportLiveMatch(sport));
  return (
    <Link
      to={`/${card.slug}`}
      className="group relative block h-[340px] sm:h-[420px] rounded-3xl overflow-hidden border border-line shadow-lg shadow-slate-900/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/60"
    >
      <img
        src={card.cardImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />
      {live ? (
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 shadow-lg">
          <span className="npl-glow-pulse size-1.5 rounded-full bg-white" aria-hidden />
          Live now
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 space-y-2">
        <h2 className="portal-display text-5xl sm:text-6xl text-white tracking-wide leading-none [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
          {card.label}
        </h2>
        <p className="text-sm text-slate-200/90 leading-snug max-w-xs">{card.tagline}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-950 text-xs font-bold uppercase tracking-wide px-4 py-2 mt-1 transition-all group-hover:gap-2.5">
          Enter
          <ArrowRight className="size-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function ComingSoonTile({ card }: { card: SportCard }) {
  return (
    <div
      aria-disabled="true"
      className="relative h-[340px] sm:h-[420px] rounded-3xl overflow-hidden border border-line bg-[radial-gradient(circle_at_30%_20%,_#1e3a8a_0%,_#0f172a_55%,_#020617_100%)]"
    >
      {/* Table-tennis table motif: net line + centre line */}
      <div className="absolute inset-8 rounded-2xl border-2 border-white/15" aria-hidden />
      <div className="absolute inset-y-8 left-1/2 w-px bg-white/15" aria-hidden />
      <div className="absolute inset-x-8 top-1/2 h-0.5 bg-white/25" aria-hidden />
      <span className="absolute top-[38%] left-[62%] size-5 rounded-full bg-orange-300 shadow-[0_0_24px_rgba(253,186,116,0.7)]" aria-hidden />
      <span className="absolute top-4 left-4 rounded-full bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 border border-white/20">
        Coming soon
      </span>
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 space-y-2">
        <h2 className="portal-display text-5xl sm:text-6xl text-white/90 tracking-wide leading-none">
          {card.label}
        </h2>
        <p className="text-sm text-slate-300/80">Schedules and live scoring are on the way.</p>
      </div>
    </div>
  );
}
