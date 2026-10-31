import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { AdminNav } from '../components/AdminNav';
import { RegistrationsPanel } from '../components/tournamentAdmin/RegistrationsPanel';
import type { RegistrationKey } from '../data/registration';
import { SPORT_CARDS } from '../data/sports';

/** Registrations for a sport that has no tournament console yet (Table Tennis). */
export default function AdminRegistrationsPage({ sport }: { sport: RegistrationKey }) {
  const card = SPORT_CARDS.find((c) => c.slug === sport || c.sport === sport);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-6 max-w-7xl mx-auto">
      <AdminNav subtitle={card?.label ?? 'Registrations'} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/sports" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold">
          ← Back to Sports
        </Link>
        {card ? (
          <a
            href={`/${card.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-300 hover:text-white"
          >
            Resident page <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
      <RegistrationsPanel sport={sport} />
    </div>
  );
}
