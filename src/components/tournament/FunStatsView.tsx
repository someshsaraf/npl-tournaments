import { useMemo, type ReactNode } from 'react';
import { Flame, Hourglass, Medal, Repeat, Sparkles, TrendingUp, Trophy, Zap } from 'lucide-react';
import type { CompletedMatch } from '../../data/tournamentData';
import {
  computeTennisFunStats,
  type FunHighlight,
  type FunLeader,
  type FunMatch
} from '../../utils/tennisFunStats';

/**
 * "Fun stats" tab on the Lawn Tennis page — worked out live from the
 * recorded scores, so it fills in as matches finish.
 */
export function FunStatsView({ results }: { results: Record<string, CompletedMatch> }) {
  const stats = useMemo(() => computeTennisFunStats(Object.values(results)), [results]);

  if (stats.matches === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper-soft px-6 py-12 text-center space-y-2">
        <Sparkles className="size-8 mx-auto text-emerald-600" aria-hidden />
        <p className="portal-display text-3xl text-ink tracking-wide">Fun stats coming soon</p>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Marathon matches, deuce dramas, comebacks and more — they appear here as soon as the first matches are played.
        </p>
      </div>
    );
  }

  const highlights: Array<{ icon: ReactNode; title: string; h: FunHighlight | null; tone: string }> = [
    { icon: <Hourglass className="size-4" aria-hidden />, title: 'Marathon match', h: stats.marathon, tone: 'sky' },
    { icon: <Repeat className="size-4" aria-hidden />, title: 'Deuce drama', h: stats.deuceDrama, tone: 'amber' },
    { icon: <TrendingUp className="size-4" aria-hidden />, title: 'Great escape', h: stats.comeback, tone: 'emerald' },
    { icon: <Flame className="size-4" aria-hidden />, title: 'On fire', h: stats.streak, tone: 'rose' }
  ];
  const shown = highlights.filter((x) => x.h);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile value={stats.matches} label={stats.matches === 1 ? 'Match played' : 'Matches played'} />
        <Tile value={stats.games} label="Games played" />
        <Tile value={stats.points} label="Points played" />
        <Tile value={stats.deuces} label="Deuces" tone="amber" />
        <Tile value={stats.goldenPoints} label="Golden points" tone="amber" />
        <Tile value={stats.nailBiters} label="Won by a single game" tone="rose" />
      </div>

      {shown.length ? (
        <section className="space-y-3">
          <Heading title="Highlights" />
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((x) => (
              <HighlightCard key={x.title} icon={x.icon} title={x.title} h={x.h!} tone={x.tone} />
            ))}
          </div>
        </section>
      ) : null}

      {stats.mostLoveGames.length || stats.mostGoldenPoints.length || stats.unbeaten.length ? (
        <section className="space-y-3">
          <Heading title="Hall of fame" />
          <div className="grid gap-3 sm:grid-cols-3">
            <LeaderCard
              icon={<Zap className="size-4" aria-hidden />}
              title="Love-game kings"
              caption="Games won without dropping a point"
              leaders={stats.mostLoveGames}
            />
            <LeaderCard
              icon={<Sparkles className="size-4" aria-hidden />}
              title="Nerves of steel"
              caption="Golden points won"
              leaders={stats.mostGoldenPoints}
            />
            <LeaderCard
              icon={<Medal className="size-4" aria-hidden />}
              title="Still unbeaten"
              caption="Two or more wins, no losses"
              leaders={stats.unbeaten.map((r) => ({ name: r.name, count: r.won }))}
              unit={(n) => `${n}–0`}
            />
          </div>
        </section>
      ) : null}

      {stats.bagels.length ? (
        <section className="space-y-3">
          <Heading title="Bagels 🥯" subtitle="Won without losing a single game" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.bagels.map((m, i) => (
              <li key={i} className="rounded-xl border border-line bg-white px-4 py-3">
                <MatchLine m={m} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <Heading title="Win–loss records" subtitle="Every player and pair, across all categories" />
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-bold">Player</th>
                <th className="px-3 py-2 text-right font-bold">Won</th>
                <th className="px-3 py-2 text-right font-bold">Lost</th>
                <th className="px-4 py-2 text-right font-bold whitespace-nowrap">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.records.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-2 font-semibold text-ink">
                    {r.name}
                    {r.lost === 0 && r.won > 0 ? <Trophy className="inline size-3.5 ml-1.5 text-amber-500" aria-label="unbeaten" /> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">{r.won}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.lost}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500 whitespace-nowrap">
                    {r.gamesWon}–{r.gamesLost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const TONES: Record<string, { text: string; box: string }> = {
  emerald: { text: 'text-emerald-700', box: 'border-emerald-200 bg-emerald-50' },
  amber: { text: 'text-amber-700', box: 'border-amber-200 bg-amber-50' },
  sky: { text: 'text-sky-700', box: 'border-sky-200 bg-sky-50' },
  rose: { text: 'text-rose-700', box: 'border-rose-200 bg-rose-50' }
};

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="portal-display text-2xl sm:text-3xl text-ink tracking-wide">{title}</h2>
      {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function Tile({ value, label, tone = 'emerald' }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-soft px-3 sm:px-4 py-4">
      <p className={`portal-display text-3xl sm:text-4xl tracking-wide tabular-nums ${TONES[tone].text}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug">{label}</p>
    </div>
  );
}

function MatchLine({ m }: { m: FunMatch }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-ink">
        <span className={m.winner === m.sideA ? 'font-black' : ''}>{m.sideA}</span>
        <span className="text-slate-400 font-normal"> vs </span>
        <span className={m.winner === m.sideB ? 'font-black' : ''}>{m.sideB}</span>
        {m.result ? <span className="ml-2 text-slate-500 font-normal tabular-nums">{m.result}</span> : null}
      </p>
      <p className="text-xs text-slate-500">{[m.category, m.stage].filter(Boolean).join(' · ')}</p>
    </div>
  );
}

function HighlightCard({ icon, title, h, tone }: { icon: ReactNode; title: string; h: FunHighlight; tone: string }) {
  const t = TONES[tone];
  return (
    <article className={`rounded-2xl border ${t.box} p-4 sm:p-5 space-y-3`}>
      <p className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] ${t.text}`}>
        {icon}
        {title}
      </p>
      <p className="flex items-baseline gap-2 flex-wrap">
        <span className={`portal-display text-5xl leading-none ${t.text}`}>{h.value}</span>
        <span className="text-sm font-semibold text-ink">{h.label}</span>
      </p>
      <MatchLine m={h.match} />
    </article>
  );
}

function LeaderCard({
  icon,
  title,
  caption,
  leaders,
  unit = (n) => String(n)
}: {
  icon: ReactNode;
  title: string;
  caption: string;
  leaders: FunLeader[];
  unit?: (n: number) => string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4 space-y-2">
      <div>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
          {icon}
          {title}
        </p>
        <p className="text-xs text-slate-500">{caption}</p>
      </div>
      {leaders.length ? (
        <ol className="space-y-1">
          {leaders.map((l) => (
            <li key={l.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-ink truncate">{l.name}</span>
              <span className="tabular-nums font-bold text-emerald-700">{unit(l.count)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-400">Nobody yet.</p>
      )}
    </article>
  );
}
