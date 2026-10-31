import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardPen } from 'lucide-react';
import { closesLabel, groupsOf, registrationOpen, type RegistrationConfig } from '../data/registration';
import { TournamentDates } from './TournamentDates';

/** Lime "Register" pill for a sport hero — only while registration is open. */
export function RegisterButton({ config, slug }: { config: RegistrationConfig; slug: string }) {
  if (!registrationOpen(config)) return null;
  return (
    <Link
      to={`/${slug}/register`}
      className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 text-slate-950 font-black text-xs uppercase tracking-wide px-4 py-2.5 shadow-lg hover:bg-lime-200"
    >
      <ClipboardPen className="size-3.5" aria-hidden />
      Register
    </Link>
  );
}

/**
 * The tournament's dates + registration status under a sport hero: a
 * "Register now" card while open (with the closing day), a quiet
 * "Registration closed" card afterwards.
 */
export function RegistrationBanner({ config, slug }: { config: RegistrationConfig; slug: string }) {
  const open = registrationOpen(config);
  const who = `${groupsOf(config).join(' and ')} · Singles & Doubles`;
  const closes = closesLabel(config);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-line bg-paper-soft px-5 py-5">
        <div className="min-w-0 flex-1 basis-60 space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Registration closed on {closes}</p>
          <p className="portal-display text-3xl text-ink tracking-wide leading-none">{config.title}</p>
          <p className="text-xs text-ink-soft">{who} — the draw and match times will be published here.</p>
        </div>
        <TournamentDates weekends={config.weekends} />
      </div>
    );
  }

  return (
    <Link
      to={`/${slug}/register`}
      className="group flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-5 py-5 hover:border-emerald-400"
    >
      <div className="min-w-0 flex-1 basis-60 space-y-1.5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Registration is open</p>
        <p className="portal-display text-3xl text-ink tracking-wide leading-none">{config.title}</p>
        <p className="text-xs text-ink-soft">{who}</p>
        <p className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
          Closes {closes}
        </p>
      </div>
      <TournamentDates weekends={config.weekends} />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition-all group-hover:gap-2.5">
        Register now
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
