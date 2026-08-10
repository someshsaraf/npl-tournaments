import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { BarChart3 } from 'lucide-react';
import { db } from '../firebase';
import type { CompletedMatch } from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import { computeTournamentStats } from '../utils/resultStats';

/**
 * Public tournament stats derived live from completedMatches.
 * Read-only Firebase; pure compute via computeTournamentStats.
 */
export default function StatsPage() {
  const [rows, setRows] = useState<CompletedMatch[]>([]);

  useEffect(() => {
    const completedRef = ref(db, 'completedMatches');
    const unsub = onValue(completedRef, (snap) => {
      setRows(sortCompletedMatches(Object.values(completedMatchesFromFirebase(snap.val()))));
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => computeTournamentStats(rows), [rows]);
  const busiest = stats.byDay[0];
  const tightestCat = stats.avgMarginByCategory[0];

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Stats</h1>
          <p className="text-sm text-slate-400">
            Highlights appear here once matches are completed and saved.
          </p>
        </header>
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No completed matches yet. Check{' '}
          <Link to="/results" className="text-emerald-400 hover:text-emerald-300 font-semibold">
            Results
          </Link>{' '}
          after games finish.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Stats</h1>
          <p className="text-sm text-slate-400">
            Live from completed results · {stats.totalMatches} match
            {stats.totalMatches === 1 ? '' : 'es'}
          </p>
        </div>
        <Link
          to="/results"
          className="inline-flex items-center gap-1.5 self-start text-xs font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
        >
          <BarChart3 className="size-3.5" aria-hidden />
          View all results
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard value={String(stats.totalMatches)} label="Completed matches" />
        <StatCard
          value={stats.totalPoints.toLocaleString()}
          label="Total points played"
        />
        <StatCard
          value={String(stats.nailbiterCount)}
          label="Nail-biters (deuce / ≤2)"
          accent="amber"
        />
        <StatCard
          value={busiest ? String(busiest.count) : '—'}
          label={busiest ? `Busiest day · ${busiest.name}` : 'Busiest day'}
          accent="indigo"
        />
      </div>

      {tightestCat ? (
        <p className="text-sm text-slate-300 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          Tightest category on average margin:{' '}
          <span className="font-semibold text-emerald-300">{tightestCat.name}</span>
          {' · '}
          ~{tightestCat.avgMargin} pts across {tightestCat.matches} match
          {tightestCat.matches === 1 ? '' : 'es'}.
        </p>
      ) : null}

      {stats.champions.length > 0 ? (
        <Section title="Category champions" subtitle="Matches marked Final">
          <ul className="divide-y divide-slate-800/80">
            {stats.champions.map((c) => (
              <li
                key={`${c.category}-${c.matchup}-${c.when}`}
                className="px-3 sm:px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1 sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-300/90">
                    {c.category}
                    {c.stage ? <span className="text-slate-600"> · {c.stage}</span> : null}
                  </p>
                  <p className="font-semibold text-slate-100 truncate">{c.matchup}</p>
                  <p className="text-xs text-slate-400">{c.result}</p>
                </div>
                <p className="sm:text-right text-sm font-bold text-emerald-400 sm:self-center">
                  {c.winner}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Matches by category">
          <BarList
            items={stats.byCategory.map((c) => ({
              label: c.name,
              value: c.count
            }))}
            max={stats.byCategory[0]?.count ?? 1}
          />
        </Section>
        <Section title="Matches by day">
          <BarList
            items={stats.byDay.map((d) => ({
              label: d.name,
              value: d.count
            }))}
            max={stats.byDay[0]?.count ?? 1}
            color="indigo"
          />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.undefeated.length > 0 ? (
          <Section title="Undefeated (3+ matches)" subtitle="Sides that never lost">
            <ul className="divide-y divide-slate-800/80">
              {stats.undefeated.map((r) => (
                <li
                  key={r.name}
                  className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-slate-100 truncate">{r.name}</span>
                  <span className="shrink-0 font-mono text-emerald-400">
                    {r.wins}–0
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : (
          <Section title="Win leaders">
            <ul className="divide-y divide-slate-800/80">
              {stats.topWinners.slice(0, 8).map((w) => (
                <li
                  key={w.name}
                  className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-slate-100 truncate">{w.name}</span>
                  <span className="shrink-0 font-mono text-emerald-400">{w.count}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Most wins" subtitle="By recorded winner name">
          <ul className="divide-y divide-slate-800/80">
            {stats.topWinners.slice(0, 10).map((w) => (
              <li
                key={w.name}
                className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium text-slate-100 truncate">{w.name}</span>
                <span className="shrink-0 font-mono text-amber-400">{w.count}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {stats.nailbiters.length > 0 ? (
        <Section title="Nail-biters" subtitle="Closest games and deuce finishes">
          <ul className="divide-y divide-slate-800/80">
            {stats.nailbiters.map((m) => (
              <li
                key={`${m.when}-${m.matchup}-${m.result}`}
                className="px-3 sm:px-4 py-3 space-y-0.5"
              >
                <p className="text-[11px] uppercase tracking-wide text-indigo-300/90">
                  {m.category}
                  {m.stage ? <span className="text-slate-600"> · {m.stage}</span> : null}
                </p>
                <p className="font-semibold text-slate-100">{m.matchup}</p>
                <p className="text-xs text-amber-300/90">
                  {m.result}
                  {m.margin != null ? ` · margin ${m.margin}` : ''}
                  {' · '}
                  Winner {m.winner}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {stats.blowouts.length > 0 ? (
        <Section title="Biggest blowouts" subtitle="Largest single-game point gap">
          <ul className="divide-y divide-slate-800/80">
            {stats.blowouts.map((m) => (
              <li
                key={`blow-${m.when}-${m.matchup}-${m.result}`}
                className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-300/90">
                    {m.category}
                  </p>
                  <p className="font-semibold text-slate-100 truncate">{m.matchup}</p>
                  <p className="text-xs text-slate-400">
                    {m.result} · Winner {m.winner}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-rose-300">
                  Δ {m.margin ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {stats.avgMarginByCategory.length > 0 ? (
        <Section
          title="Competitiveness by category"
          subtitle="Lower average margin = tighter matches"
        >
          <BarList
            items={stats.avgMarginByCategory.map((c) => ({
              label: `${c.name} (${c.matches})`,
              value: c.avgMargin,
              display: c.avgMargin.toFixed(1)
            }))}
            max={Math.max(...stats.avgMarginByCategory.map((c) => c.avgMargin), 1)}
            color="rose"
          />
        </Section>
      ) : null}
    </div>
  );
}

function StatCard({
  value,
  label,
  accent = 'emerald'
}: {
  value: string;
  label: string;
  accent?: 'emerald' | 'amber' | 'indigo';
}) {
  const valueClass =
    accent === 'amber'
      ? 'text-amber-300'
      : accent === 'indigo'
        ? 'text-indigo-300'
        : 'text-emerald-300';
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-3 sm:px-4 py-3.5">
      <p className={`portal-display text-2xl sm:text-3xl tracking-wide ${valueClass}`}>{value}</p>
      <p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-snug">{label}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
      <div className="px-3 sm:px-4 py-3 border-b border-slate-800/80">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-100">{title}</h2>
        {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BarList({
  items,
  max,
  color = 'emerald'
}: {
  items: Array<{ label: string; value: number; display?: string }>;
  max: number;
  color?: 'emerald' | 'indigo' | 'rose';
}) {
  const bar =
    color === 'indigo'
      ? 'bg-indigo-500'
      : color === 'rose'
        ? 'bg-rose-500'
        : 'bg-emerald-500';
  const safeMax = max > 0 ? max : 1;
  return (
    <ul className="px-3 sm:px-4 py-3 space-y-2.5">
      {items.map((item) => {
        const pct = Math.max(4, Math.round((100 * item.value) / safeMax));
        return (
          <li key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-300 truncate">{item.label}</span>
              <span className="font-mono text-slate-400 shrink-0">
                {item.display ?? String(item.value)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
