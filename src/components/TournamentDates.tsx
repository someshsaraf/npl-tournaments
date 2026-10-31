/**
 * Calendar-style date tiles, grouped by weekend — the tournament dates at a
 * glance. `tone="dark"` sits on a photo hero; `tone="light"` on a pale card.
 */
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const month = new Intl.DateTimeFormat('en-GB', { month: 'short' });

function parts(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return { day: d.getDate(), weekday: weekday.format(d), month: month.format(d) };
}

export function TournamentDates({ weekends, tone = 'light' }: { weekends: string[][]; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3" role="list" aria-label="Tournament dates">
      {weekends.map((days, i) => (
        <div key={days[0]} role="listitem" className="space-y-1.5">
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${dark ? 'text-lime-300' : 'text-emerald-700'}`}>
            Weekend {i + 1}
          </p>
          <div className="flex gap-1.5">
            {days.map((iso) => {
              const p = parts(iso);
              return (
                <div
                  key={iso}
                  className={`w-14 sm:w-16 overflow-hidden rounded-xl text-center shadow-sm ${
                    dark ? 'bg-white/95 ring-1 ring-white/40' : 'bg-white ring-1 ring-emerald-200'
                  }`}
                >
                  <p className="bg-emerald-600 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{p.weekday}</p>
                  <p className="portal-display text-3xl sm:text-4xl leading-none pt-1.5 text-slate-900">{p.day}</p>
                  <p className="pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{p.month}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
