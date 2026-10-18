import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Placeholder until Table Tennis scoring + scheduling are built. */
export default function TableTennisPage() {
  return (
    <div className="space-y-4">
      <Link
        to="/sports"
        className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        All sports
      </Link>
      <section className="rounded-3xl bg-[radial-gradient(circle_at_30%_20%,_#1e3a8a_0%,_#0f172a_55%,_#020617_100%)] px-6 py-16 text-center space-y-3">
        <h1 className="portal-display text-6xl text-white tracking-wide">Table Tennis</h1>
        <p className="text-slate-300">Coming soon — schedules and live scoring are on the way.</p>
      </section>
    </div>
  );
}
