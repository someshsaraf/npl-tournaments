import { useMemo, useState } from 'react';
import { Trophy, Users } from 'lucide-react';
import type { MatchState } from '../../data/tournamentData';
import {
  STAGE_LABEL,
  categoryLabel,
  type FixtureStage,
  type TournamentCategory
} from '../../data/tennisTournament';
import {
  compareFixtureTime,
  fixtureStatus,
  formatFixtureDate,
  isByeFixture,
  isPoolComplete,
  poolStandings,
  resolveSide,
  type FixtureStatus,
  type TournamentContext
} from '../../utils/tennisTournament';
import { describeTennisRules } from '../../utils/tennisScoring';
import { FixtureCard } from './FixtureCard';

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'live', label: 'Live' },
  { key: 'completed', label: 'Completed' }
];

function CategoryPicker({
  categories,
  value,
  onChange,
  allowAll = true
}: {
  categories: TournamentCategory[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  const options = allowAll ? [{ id: 'all', label: 'All categories' }] : [];
  for (const c of categories) options.push({ id: c.id, label: categoryLabel(c) });
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            value === o.id ? 'bg-emerald-600 text-white' : 'bg-white border border-line text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Day-by-day schedule with upcoming / live / completed filtering. */
export function TennisScheduleView({ ctx, live }: { ctx: TournamentContext; live: MatchState | null }) {
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const withStatus = useMemo(
    () =>
      ctx.tournament.fixtures
        .filter((f) => !isByeFixture(f))
        .map((f) => ({ f, s: fixtureStatus(ctx, f, live) as FixtureStatus }))
        .sort((x, y) => compareFixtureTime(x.f, y.f)),
    [ctx, live]
  );

  const counts = useMemo(() => {
    const c = { all: 0, upcoming: 0, live: 0, completed: 0 };
    for (const { f, s } of withStatus) {
      if (category !== 'all' && f.categoryId !== category) continue;
      c.all += 1;
      if (s === 'upcoming' || s === 'live' || s === 'completed') c[s] += 1;
    }
    return c;
  }, [withStatus, category]);

  const byDate = useMemo(() => {
    const map = new Map<string, typeof withStatus>();
    for (const row of withStatus) {
      if (category !== 'all' && row.f.categoryId !== category) continue;
      if (status !== 'all' && row.s !== status) continue;
      const key = row.f.date;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [withStatus, category, status]);

  return (
    <div className="space-y-4">
      <CategoryPicker
        categories={ctx.tournament.categories.filter((c) => ctx.tournament.fixtures.some((f) => f.categoryId === c.id))}
        value={category}
        onChange={setCategory}
      />
      <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatus(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              status === s.key ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {s.label}
            <span className="ml-1 opacity-60 tabular-nums">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {byDate.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
          No {status === 'all' ? '' : `${status} `}matches here.
        </p>
      ) : (
        byDate.map(([date, rows]) => (
          <section key={date || 'tbd'} className="space-y-2">
            <h3 className="sticky top-16 z-10 -mx-1 px-1 py-1.5 bg-white/90 backdrop-blur text-xs font-black uppercase tracking-[0.14em] text-ink">
              {formatFixtureDate(date)}
              <span className="ml-2 font-semibold text-slate-400 normal-case tracking-normal">
                {rows.length} match{rows.length === 1 ? '' : 'es'}
              </span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map(({ f }) => (
                <FixtureCard key={f.id} ctx={ctx} fixture={f} live={live} showCategory={category === 'all'} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/** Pool tables + each pool's matches. */
export function TennisPoolsView({ ctx, live }: { ctx: TournamentContext; live: MatchState | null }) {
  const cats = ctx.tournament.categories.filter((c) => c.pools.length > 0);
  const [category, setCategory] = useState(cats[0]?.id ?? '');
  const cat = cats.find((c) => c.id === category) ?? cats[0];
  if (!cat) {
    return <Empty text="Pools haven't been drawn yet." />;
  }
  return (
    <div className="space-y-4">
      <CategoryPicker categories={cats} value={cat.id} onChange={setCategory} allowAll={false} />
      <p className="text-xs text-slate-500">
        {ctx.tournament.pointsPerWin} points per win. Ties broken on game difference, then games won, then
        head-to-head. Top {cat.qualifiersPerPool === 1 ? 'finisher' : `${cat.qualifiersPerPool} finishers`} of
        each pool advance.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {cat.pools.map((pool) => {
          const rows = poolStandings(ctx, pool.id);
          const complete = isPoolComplete(ctx, pool.id);
          const matches = ctx.tournament.fixtures
            .filter((f) => f.stage === 'pool' && f.poolId === pool.id)
            .sort(compareFixtureTime);
          return (
            <section key={pool.id} className="rounded-2xl border border-line bg-white overflow-hidden">
              <header className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">
                <h3 className="portal-display text-2xl tracking-wide leading-none">{pool.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {complete ? 'Complete' : `${matches.filter((m) => fixtureStatus(ctx, m, live) === 'completed').length}/${matches.length} played`}
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-line">
                      <th className="text-left font-bold px-4 py-2">{cat.format === 'team' ? 'Team' : cat.format === 'doubles' ? 'Pair' : 'Player'}</th>
                      <th className="font-bold px-2 py-2 w-8">P</th>
                      <th className="font-bold px-2 py-2 w-8">W</th>
                      <th className="font-bold px-2 py-2 w-8">L</th>
                      <th className="font-bold px-2 py-2 w-12" title="Games won–lost">Games</th>
                      <th className="font-bold px-3 py-2 w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const qualifies = i < cat.qualifiersPerPool && r.played > 0;
                      return (
                        <tr key={r.entry.id} className={`border-b border-line/60 last:border-0 ${qualifies ? 'bg-lime-50' : ''}`}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`tabular-nums text-xs w-4 ${qualifies ? 'text-emerald-700 font-black' : 'text-slate-400'}`}>
                                {i + 1}
                              </span>
                              <span className="truncate font-semibold text-ink">{r.entry.name}</span>
                            </div>
                            {cat.format === 'team' && r.entry.players.length > 0 ? (
                              <p className="pl-6 text-[11px] text-slate-500 truncate">{r.entry.players.join(', ')}</p>
                            ) : null}
                          </td>
                          <td className="text-center tabular-nums text-slate-600">{r.played}</td>
                          <td className="text-center tabular-nums text-slate-600">{r.won}</td>
                          <td className="text-center tabular-nums text-slate-600">{r.lost}</td>
                          <td className="text-center tabular-nums text-slate-600">
                            {r.gamesFor}–{r.gamesAgainst}
                          </td>
                          <td className="text-center tabular-nums font-black text-ink px-3">{r.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {matches.length > 0 ? (
                <div className="p-3 border-t border-line bg-paper-soft grid gap-2">
                  {matches.map((f) => (
                    <FixtureCard key={f.id} ctx={ctx} fixture={f} live={live} showCategory={false} compact />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

const KO_ORDER: FixtureStage[] = ['quarterfinal', 'semifinal', 'final'];

/** Knockout bracket — one column per round. */
export function TennisBracketView({ ctx, live }: { ctx: TournamentContext; live: MatchState | null }) {
  const cats = ctx.tournament.categories.filter((c) =>
    ctx.tournament.fixtures.some((f) => f.categoryId === c.id && f.stage !== 'pool')
  );
  const [category, setCategory] = useState(cats[0]?.id ?? '');
  const cat = cats.find((c) => c.id === category) ?? cats[0];
  if (!cat) return <Empty text="Knockout rounds will appear once the draw is made." />;

  const rounds = KO_ORDER.map((stage) => ({
    stage,
    fixtures: ctx.tournament.fixtures
      .filter((f) => f.categoryId === cat.id && f.stage === stage)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  })).filter((r) => r.fixtures.length > 0);

  const final = rounds.find((r) => r.stage === 'final')?.fixtures[0];
  const champion = final
    ? resolveSide(ctx, { kind: 'winnerOf', fixtureId: final.id })
    : null;

  return (
    <div className="space-y-4">
      <CategoryPicker categories={cats} value={cat.id} onChange={setCategory} allowAll={false} />
      {champion?.entry ? (
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-lime-200 px-4 py-3 shadow">
          <Trophy className="size-7 text-amber-700 shrink-0" aria-hidden />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
              {categoryLabel(cat)} champion
            </p>
            <p className="portal-display text-3xl text-slate-900 tracking-wide leading-none">{champion.entry.name}</p>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {rounds.map((round) => (
            <div key={round.stage} className="w-64 flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-ink mb-2">{STAGE_LABEL[round.stage]}</h3>
              <div className="flex-1 flex flex-col justify-around gap-3">
                {round.fixtures.map((f) => (
                  <div key={f.id}>
                    <FixtureCard ctx={ctx} fixture={f} live={live} showCategory={false} compact />
                    {f.date ? (
                      <p className="mt-1 text-[10px] text-slate-400 font-mono">{formatFixtureDate(f.date)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tournament rules generated from the admin's configuration. */
export function TennisRulesView({ ctx }: { ctx: TournamentContext }) {
  const t = ctx.tournament;
  const stages: Array<{ key: keyof typeof t.rules; label: string; hint: string }> = [
    { key: 'pool', label: 'Pool (qualifier) matches', hint: 'Everyone plays everyone in their pool.' },
    { key: 'quarterfinal', label: 'Quarterfinals', hint: '' },
    { key: 'semifinal', label: 'Semifinals', hint: '' },
    { key: 'final', label: 'Finals', hint: '' }
  ];
  const usedStages = new Set(t.fixtures.map((f) => f.stage));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-line bg-white p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-ink">
          <Trophy className="size-4 text-emerald-600" aria-hidden /> Match format
        </h3>
        <ul className="space-y-3">
          {stages
            .filter((s) => s.key === 'pool' || usedStages.has(s.key as FixtureStage) || usedStages.size === 0)
            .map((s) => (
              <li key={s.key} className="space-y-0.5">
                <p className="text-sm font-bold text-ink">{s.label}</p>
                <p className="text-sm text-ink-soft">{describeTennisRules(t.rules[s.key])}</p>
                {s.hint ? <p className="text-xs text-slate-500">{s.hint}</p> : null}
              </li>
            ))}
        </ul>
        <p className="text-xs text-slate-500 border-t border-line pt-3">
          "First to 4" means at 3-3 in games, whoever wins the next game wins the match. A golden point is
          sudden death: whoever wins that point wins the game.
        </p>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-ink">
          <Users className="size-4 text-emerald-600" aria-hidden /> Categories &amp; qualifying
        </h3>
        <ul className="space-y-2 text-sm text-ink-soft">
          {t.categories.map((c) => (
            <li key={c.id}>
              <span className="font-bold text-ink">{categoryLabel(c)}</span> — {c.pools.length} pool
              {c.pools.length === 1 ? '' : 's'}, top {c.qualifiersPerPool} per pool advance
              {c.format === 'team' ? '. Teams of 3–4 players.' : '.'}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 border-t border-line pt-3">
          Each match won earns {t.pointsPerWin} points in the pool table.
        </p>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">{text}</p>
  );
}
