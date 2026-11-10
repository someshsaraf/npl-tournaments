import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarX2, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  categoryFor,
  closesLabel,
  formatsOf,
  groupsOf,
  registrationOpen,
  type RegistrationKey
} from '../data/registration';
import { SPORT_CARDS } from '../data/sports';
import { Reveal } from '../components/Reveal';
import { TournamentDates } from '../components/TournamentDates';
import { DeadlineTile, RegisteredCount } from '../components/RegistrationBanner';
import { useRegisteredCount } from '../hooks/useRegisteredCount';
import { useRegistrations } from '../hooks/useRegistrations';

/**
 * Tournament registration (/lawn-tennis/register): full name + exactly one
 * age group (Kids or Adults) with Singles, Doubles or both. Saved on the
 * server where only admins can see it.
 */
export default function TournamentRegisterPage({ sport }: { sport: RegistrationKey }) {
  const { shown, loading } = useRegistrations();
  const config = shown[sport];
  const card = SPORT_CARDS.find((c) => c.sport === sport || c.slug === sport)!;
  const slug = card.slug;
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [formats, setFormats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; category: string } | null>(null);
  const { admin } = useAuth();
  const [count, refreshCount] = useRegisteredCount(sport);

  if (loading && !config) return null;
  if (!config) {
    return (
      <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
        Registration isn't open for {card.label} yet.
      </p>
    );
  }

  const open = registrationOpen(config);
  const closes = closesLabel(config);
  const groups = groupsOf(config);
  const allFormats = formatsOf(config);
  const toggleFormat = (f: string) => {
    setError(null);
    setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : allFormats.filter((x) => x === f || cur.includes(x))));
  };
  const firstDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${config.firstDay}T00:00:00`)
  );

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!group) {
      setError('Please choose Kids or Adults.');
      return;
    }
    if (formats.length === 0) {
      setError('Please choose Singles, Doubles or both.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          name,
          categories: formats.map((f) => categoryFor(config, group, f)?.id).filter(Boolean)
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; name?: string; category?: string };
      if (!res.ok) throw new Error(data.error || `Registration failed (${res.status}).`);
      setDone({ name: data.name ?? name.trim(), category: data.category ?? '' });
      refreshCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDone(null);
    setName('');
    setGroup('');
    setFormats([]);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link
        to={`/${slug}`}
        className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        {card.label}
      </Link>

      <Reveal>
        <section className="relative rounded-3xl overflow-hidden border border-line shadow-xl bg-[radial-gradient(circle_at_30%_20%,_#1e3a8a_0%,_#0f172a_55%,_#020617_100%)]">
          {card.heroImage ? (
            <img
              src={card.heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: card.heroFocus ?? 'center' }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/25" />
          <div className="relative p-6 sm:p-8 space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-lime-300 font-bold">
                {open ? 'Registration open' : `Registration closed on ${closes}`}
              </p>
              <h1 className="portal-display text-4xl sm:text-5xl text-white tracking-wide leading-none">{config.title}</h1>
            </div>
            <RegisteredCount count={count} open={open} />
            <TournamentDates weekends={config.weekends} tone="dark" />
            <DeadlineTile config={config} tone="dark" />
          </div>
        </section>
      </Reveal>

      {!open && !admin ? (
        <Reveal>
          <section className="rounded-3xl border border-line bg-paper-soft p-6 sm:p-8 text-center space-y-3" role="status">
            <CalendarX2 className="size-12 mx-auto text-slate-400" aria-hidden />
            <h2 className="portal-display text-4xl text-ink tracking-wide">Registration closed</h2>
            <p className="text-ink-soft">
              Registration for the {config.title} closed on <span className="font-bold text-ink">{closes}</span>.
            </p>
            <p className="text-sm text-slate-500">
              Missed it? Please contact the organisers. The draw and match times will be published on the {card.label} page.
            </p>
            <div className="pt-2">
              <Link
                to={`/${slug}`}
                className="rounded-full bg-ink px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800"
              >
                Back to {card.label}
              </Link>
            </div>
          </section>
        </Reveal>
      ) : done ? (
        <Reveal>
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 text-center space-y-3" role="status">
            <CheckCircle2 className="size-12 mx-auto text-emerald-600" aria-hidden />
            <h2 className="portal-display text-4xl text-ink tracking-wide">You're registered!</h2>
            <p className="text-ink-soft">
              <span className="font-bold text-ink">{done.name}</span> is registered for{' '}
              <span className="font-bold text-ink">{done.category}</span>.
            </p>
            <p className="text-sm text-slate-500">
              The organisers will publish the draw and match times on the {card.label} page. See you on court from {firstDay}!
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-line bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink hover:bg-paper-soft"
              >
                Register someone else
              </button>
              <Link
                to={`/${slug}`}
                className="rounded-full bg-ink px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800"
              >
                Back to {card.label}
              </Link>
            </div>
          </section>
        </Reveal>
      ) : (
        <Reveal delayMs={60}>
          <form
            className="rounded-3xl border border-line bg-white p-5 sm:p-7 space-y-6 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {!open ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                Registration closed on {closes}. You're signed in as staff, so you can still add a late entry.
              </p>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink">Full name</span>
              <input
                value={name}
                onChange={(e) => {
                  setError(null);
                  setName(e.target.value);
                }}
                autoComplete="name"
                maxLength={60}
                disabled={busy}
                className="w-full rounded-xl border border-line bg-paper-soft px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
              />
            </label>

            <fieldset className="space-y-2" disabled={busy}>
              <legend className="text-xs font-black uppercase tracking-[0.14em] text-ink mb-2">
                Age group <span className="font-semibold normal-case tracking-normal text-slate-500">— choose one</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {groups.map((g) => (
                  <label key={g} className={choiceCls(group === g)}>
                    <input
                      type="radio"
                      name="group"
                      value={g}
                      checked={group === g}
                      onChange={() => {
                        setError(null);
                        setGroup(g);
                      }}
                      className="size-4 accent-emerald-600"
                    />
                    <span className="font-semibold text-ink">{g}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2" disabled={busy}>
              <legend className="text-xs font-black uppercase tracking-[0.14em] text-ink mb-2">
                Events <span className="font-semibold normal-case tracking-normal text-slate-500">— Singles, Doubles or both</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {allFormats.map((f) => (
                  <label key={f} className={choiceCls(formats.includes(f))}>
                    <input
                      type="checkbox"
                      name="events"
                      value={f}
                      checked={formats.includes(f)}
                      onChange={() => toggleFormat(f)}
                      className="size-4 rounded accent-emerald-600"
                    />
                    <span className="font-semibold text-ink">{f}</span>
                  </label>
                ))}
              </div>
              {group && formats.length > 0 ? (
                <p className="text-xs text-emerald-700 font-semibold">
                  You're registering for {group} · {formats.join(' & ')}
                </p>
              ) : null}
            </fieldset>

            {error ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-black uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Submit registration
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              Your name is used only to organise the draw and is visible to the organisers only. One registration per
              person.
            </p>
          </form>
        </Reveal>
      )}
    </div>
  );
}

function choiceCls(selected: boolean): string {
  return `flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
    selected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-line bg-white hover:border-slate-300'
  }`;
}
