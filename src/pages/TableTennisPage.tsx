import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardPen } from 'lucide-react';
import { REGISTRATIONS } from '../data/registration';
import { TournamentDates } from '../components/TournamentDates';
import { Reveal } from '../components/Reveal';

/**
 * Table Tennis (/table-tennis): scoring + schedules aren't built yet, but
 * registration is open — dates and a Register button.
 */
export default function TableTennisPage() {
  const registration = REGISTRATIONS['table-tennis'];
  return (
    <div className="space-y-5">
      <Link
        to="/sports"
        className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        All sports
      </Link>
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_30%_20%,_#1e3a8a_0%,_#0f172a_55%,_#020617_100%)] px-6 py-10 sm:px-10 sm:py-12">
          {/* Table-tennis table motif: net line + centre line + ball */}
          <div className="absolute inset-6 rounded-2xl border-2 border-white/10" aria-hidden />
          <div className="absolute inset-y-6 left-1/2 w-px bg-white/10" aria-hidden />
          <div className="absolute inset-x-6 top-1/2 h-0.5 bg-white/15" aria-hidden />
          <span className="absolute top-[22%] right-[14%] size-5 rounded-full bg-orange-300 shadow-[0_0_24px_rgba(253,186,116,0.7)]" aria-hidden />
          <div className="relative space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-300">
              {registration ? 'Registration open' : 'Coming soon'}
            </p>
            <h1 className="portal-display text-5xl sm:text-7xl text-white tracking-wide leading-[0.9]">
              {registration?.title ?? 'Table Tennis'}
            </h1>
            {registration ? (
              <>
                <TournamentDates weekends={registration.weekends} tone="dark" />
                <p className="text-sm text-slate-300 max-w-md">
                  Kids (under 21) and Adults (21 and over) — Singles, Doubles or both. Draw, schedule and live scores
                  will appear here closer to the tournament.
                </p>
                <Link
                  to="/table-tennis/register"
                  className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg transition-all hover:gap-2.5 hover:bg-lime-200"
                >
                  <ClipboardPen className="size-3.5" aria-hidden />
                  Register now
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </>
            ) : (
              <p className="text-slate-300">Schedules and live scoring are on the way.</p>
            )}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
