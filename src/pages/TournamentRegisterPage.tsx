import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import type { Sport } from '../data/tournamentData';
import { REGISTRATIONS } from '../data/registration';
import { sportCardBySport, sportSlug } from '../data/sports';
import { Reveal } from '../components/Reveal';

/**
 * Tournament registration (/lawn-tennis/register): full name + exactly one
 * category. Saved on the server where only admins can see it.
 */
export default function TournamentRegisterPage({ sport }: { sport: Sport }) {
  const config = REGISTRATIONS[sport];
  const card = sportCardBySport(sport);
  const slug = sportSlug(sport);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; category: string } | null>(null);

  if (!config) {
    return (
      <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
        Registration isn't open for {card.label} yet.
      </p>
    );
  }

  const groups = [...new Set(config.categories.map((c) => c.group))];
  const firstDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${config.firstDay}T00:00:00`)
  );

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!category) {
      setError('Please choose one category.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, name, category })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; name?: string; category?: string };
      if (!res.ok) throw new Error(data.error || `Registration failed (${res.status}).`);
      setDone({ name: data.name ?? name.trim(), category: data.category ?? '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDone(null);
    setName('');
    setCategory('');
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
        <section className="relative rounded-3xl overflow-hidden border border-line shadow-xl">
          {card.heroImage ? (
            <img
              src={card.heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: card.heroFocus ?? 'center' }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/25" />
          <div className="relative p-6 sm:p-8 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-lime-300 font-bold">Registration open</p>
            <h1 className="portal-display text-4xl sm:text-5xl text-white tracking-wide leading-none">{config.title}</h1>
            <p className="inline-flex items-center gap-2 text-sm text-lime-100/90 font-mono">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              {config.dates}
            </p>
          </div>
        </section>
      </Reveal>

      {done ? (
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
            <label className="block space-y-1.5">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink">Full name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={60}
                placeholder="e.g. Priya Nair"
                disabled={busy}
                className="w-full rounded-xl border border-line bg-paper-soft px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
              />
            </label>

            <fieldset className="space-y-3" disabled={busy}>
              <legend className="text-xs font-black uppercase tracking-[0.14em] text-ink">
                Category <span className="font-semibold normal-case tracking-normal text-slate-500">— choose one</span>
              </legend>
              {groups.map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-sm font-bold text-ink-soft">{group}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {config.categories
                      .filter((c) => c.group === group)
                      .map((c) => (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                            category === c.id
                              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                              : 'border-line bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="category"
                            value={c.id}
                            checked={category === c.id}
                            onChange={() => setCategory(c.id)}
                            className="size-4 accent-emerald-600"
                          />
                          <span className="font-semibold text-ink">{c.format}</span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
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
              Your name is used only to organise the draw and is visible to the organisers only. One category per
              person.
            </p>
          </form>
        </Reveal>
      )}
    </div>
  );
}
