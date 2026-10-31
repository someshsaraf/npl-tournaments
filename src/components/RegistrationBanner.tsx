import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardPen } from 'lucide-react';
import {
  closeDayParts,
  closesLabel,
  countdownLabel,
  daysUntilClose,
  groupsOf,
  registrationOpen,
  type RegistrationConfig
} from '../data/registration';
import { TournamentDates } from './TournamentDates';

/**
 * The registration deadline, made hard to miss: a red calendar tile for the
 * closing day plus a countdown ("13 days left" … "Last day today!") that
 * pulses in the final three days. Red on purpose — the green tiles are the
 * days you play, the red one is the day sign-ups stop.
 */
export function DeadlineTile({ config, tone = 'light' }: { config: RegistrationConfig; tone?: 'light' | 'dark' }) {
  if (!registrationOpen(config)) return null;
  const { weekday, day, month } = closeDayParts(config);
  const urgent = daysUntilClose(config) <= 3;
  const dark = tone === 'dark';
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        dark ? 'bg-rose-950/60 ring-1 ring-rose-400/50 backdrop-blur-sm' : 'bg-rose-50 ring-1 ring-rose-200'
      }`}
      role="note"
      aria-label={`Registration closes ${closesLabel(config)} — ${countdownLabel(config)}`}
    >
      <div className="w-14 sm:w-16 shrink-0 overflow-hidden rounded-xl bg-white text-center shadow-sm ring-1 ring-rose-300">
        <p className="bg-rose-600 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{weekday}</p>
        <p className="portal-display text-3xl sm:text-4xl leading-none pt-1.5 text-rose-700">{day}</p>
        <p className="pb-1 text-[10px] font-bold uppercase tracking-wider text-rose-500">{month}</p>
      </div>
      <div className="space-y-1">
        <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${dark ? 'text-rose-200' : 'text-rose-700'}`}>
          Registration closes
        </p>
        <p className={`text-sm font-black ${dark ? 'text-white' : 'text-ink'}`}>{closesLabel(config)} · 11:59 PM</p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
          {urgent ? <span className="npl-glow-pulse size-1.5 rounded-full bg-white" aria-hidden /> : null}
          {countdownLabel(config)}
        </p>
      </div>
    </div>
  );
}

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
      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] text-white">{countdownLabel(config)}</span>
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
      </div>
      <TournamentDates weekends={config.weekends} />
      <DeadlineTile config={config} />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition-all group-hover:gap-2.5">
        Register now
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
