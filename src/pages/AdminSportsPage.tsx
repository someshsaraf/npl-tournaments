import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AdminNav } from '../components/AdminNav';
import { SPORT_CARDS, adminPathForSport } from '../data/sports';
import { REGISTRATIONS, type RegistrationKey } from '../data/registration';

/** Admin landing: one panel per sport, each opening its tournament console. */
export default function AdminSportsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-6xl mx-auto">
      <AdminNav subtitle="Sports" />
      <div className="grid gap-4 md:grid-cols-3">
        {SPORT_CARDS.map((card) => (
          <section
            key={card.slug}
            className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[260px] flex flex-col"
          >
            {card.cardImage ? (
              <img src={card.cardImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
            <div className="relative mt-auto p-5 space-y-3">
              <h2 className="text-2xl font-black tracking-wide">{card.label}</h2>
              {card.sport ? (
                <Link
                  to={adminPathForSport(card.sport)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 text-slate-950 font-black text-xs uppercase tracking-wide px-4 py-2.5 hover:bg-lime-200"
                >
                  Tournament console
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              ) : REGISTRATIONS[card.slug as RegistrationKey] ? (
                <Link
                  to={`/admin/${card.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 text-slate-950 font-black text-xs uppercase tracking-wide px-4 py-2.5 hover:bg-lime-200"
                >
                  Registrations
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              ) : (
                <p className="text-xs text-slate-400">Coming soon.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
