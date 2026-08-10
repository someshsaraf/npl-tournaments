import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import type { CompletedMatch } from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import {
  computeTournamentStats,
  type HighlightMatch,
  type NamedCount,
  type SideRecord
} from '../utils/resultStats';

/**
 * Public tournament stats — story-first layout (headline → champions → drama → charts).
 * Live from completedMatches; pure compute via computeTournamentStats.
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
  const featured = stats.nailbiters[0] ?? stats.champions[0] ?? null;
  const widest = stats.avgMarginByCategory[stats.avgMarginByCategory.length - 1];
  const tightest = stats.avgMarginByCategory[0];

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">
            Results story
          </p>
          <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Stats</h1>
          <p className="text-sm text-slate-400 max-w-xl">
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
    <div className="space-y-10">
      {/* Hero */}
      <header className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">
            Results story
          </p>
          <h1 className="portal-display text-4xl sm:text-5xl text-white tracking-wide">
            NPL 2026 Stats
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Live from completed results · {stats.totalMatches} match
            {stats.totalMatches === 1 ? '' : 'es'} ·{' '}
            <Link to="/results" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              full results
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HeroStat value={String(stats.totalMatches)} label="Completed matches" />
          <HeroStat value={stats.totalPoints.toLocaleString()} label="Points played" />
          <HeroStat
            value={String(stats.nailbiterCount)}
            label="Nail-biters"
            tone="amber"
          />
          <HeroStat
            value={busiest ? String(busiest.count) : '—'}
            label={busiest ? `Busiest · ${busiest.name}` : 'Busiest day'}
            tone="sky"
          />
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300 mb-2">
            Headline
          </p>
          <p className="text-base sm:text-lg text-slate-100 leading-relaxed">{stats.headline}</p>
        </div>
      </header>

      {/* Featured match */}
      {featured ? (
        <section className="space-y-3">
          <SectionTitle
            title="Match of the tournament"
            subtitle="Closest finish or standout final from the live results"
          />
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/90">
              {featured.category}
              {featured.stage ? ` · ${featured.stage}` : ''}
            </p>
            <p className="portal-display mt-2 text-3xl sm:text-4xl text-white tracking-wide">
              {featured.winner}
            </p>
            <p className="mt-1 text-slate-300 text-sm sm:text-base">{featured.matchup}</p>
            <p className="mt-3 font-mono text-lg sm:text-xl text-amber-200">{featured.result}</p>
            {featured.when ? (
              <p className="mt-2 text-xs text-slate-500">{featured.when}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Champions */}
      {stats.champions.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle
            title="Category champions"
            subtitle="Every recorded Final — winner first, score second"
          />
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[32rem] text-sm text-left">
              <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Category</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold text-emerald-400">Champion</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Scoreline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/90 bg-slate-950/40">
                {stats.champions.map((c) => (
                  <tr key={`${c.category}-${c.winner}-${c.when}`} className="hover:bg-slate-900/60">
                    <td className="px-3 sm:px-4 py-3 text-slate-300 whitespace-nowrap">
                      {c.category}
                    </td>
                    <td className="px-3 sm:px-4 py-3 font-bold text-emerald-300">{c.winner}</td>
                    <td className="px-3 sm:px-4 py-3 font-mono text-amber-200/90 whitespace-nowrap">
                      {c.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Undefeated pills */}
      {stats.undefeated.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle title="Undefeated runs" subtitle="3+ matches, zero losses" />
          <div className="flex flex-wrap gap-2">
            {stats.undefeated.map((r) => (
              <span
                key={r.name}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-sm"
              >
                <span className="font-semibold text-slate-100">{r.name}</span>
                <span className="font-mono text-emerald-300">{r.wins}–0</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Nail-biters table */}
      {stats.nailbiters.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle
            title="Nail-biters"
            subtitle="Deuce finishes and games decided by 1–2 points"
          />
          <HighlightTable
            rows={stats.nailbiters}
            valueHeader="Margin"
            valueOf={(m) => (m.margin != null ? String(m.margin) : '—')}
            valueClass="text-amber-300"
          />
        </section>
      ) : null}

      {/* Two-column charts */}
      <section className="space-y-3">
        <SectionTitle title="Where the matches happened" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartPanel title="By category" caption="Completed match count">
            <HorizontalBars items={stats.byCategory} unit="" color="emerald" />
          </ChartPanel>
          <ChartPanel title="By day" caption="Completions logged that day">
            <HorizontalBars items={stats.byDay} unit="" color="sky" />
          </ChartPanel>
        </div>
      </section>

      {/* Blowouts + competitiveness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {stats.blowouts.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle
              title="Biggest blowouts"
              subtitle="Largest single-game point gap"
            />
            <HighlightTable
              rows={stats.blowouts}
              valueHeader="Δ"
              valueOf={(m) => (m.margin != null ? String(m.margin) : '—')}
              valueClass="text-rose-300"
              compact
            />
          </section>
        ) : null}

        {stats.avgMarginByCategory.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle
              title="Tightest categories"
              subtitle="Lower avg margin = closer matches"
            />
            <ChartPanel
              title="Avg closest-game margin"
              caption={
                tightest && widest
                  ? `${tightest.name} ~${tightest.avgMargin} · ${widest.name} ~${widest.avgMargin}`
                  : 'Points'
              }
            >
              <HorizontalBars
                items={stats.avgMarginByCategory.map((c) => ({
                  name: c.name,
                  count: c.avgMargin
                }))}
                unit=" pts"
                color="rose"
                format={(n) => n.toFixed(1)}
              />
            </ChartPanel>
          </section>
        ) : null}
      </div>

      {/* Most wins */}
      {stats.topWinners.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle title="Most wins" subtitle="By recorded winner name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stats.topWinners.slice(0, 8).map((w, i) => (
              <div
                key={w.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="portal-display text-xl text-slate-500 w-6 shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-slate-100 truncate">{w.name}</span>
                </div>
                <span className="font-mono text-amber-300 shrink-0">{w.count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Curiosities */}
      {stats.curiosities.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle title="Quick curiosities" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.curiosities.map((line) => (
              <div
                key={line}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-sm text-slate-200 leading-relaxed"
              >
                {line}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {stats.hotStreaks.length > 0 && stats.undefeated.length === 0 ? (
        <WinRateStrip records={stats.hotStreaks.slice(0, 6)} />
      ) : null}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="portal-display text-2xl sm:text-3xl text-white tracking-wide">{title}</h2>
      {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function HeroStat({
  value,
  label,
  tone = 'emerald'
}: {
  value: string;
  label: string;
  tone?: 'emerald' | 'amber' | 'sky';
}) {
  const valueClass =
    tone === 'amber' ? 'text-amber-300' : tone === 'sky' ? 'text-sky-300' : 'text-emerald-300';
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 sm:px-4 py-4">
      <p className={`portal-display text-3xl sm:text-4xl tracking-wide ${valueClass}`}>{value}</p>
      <p className="mt-1.5 text-[11px] sm:text-xs text-slate-400 leading-snug">{label}</p>
    </div>
  );
}

function ChartPanel({
  title,
  caption,
  children
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-300">{title}</p>
      {caption ? <p className="text-[11px] text-slate-500 mt-0.5 mb-4">{caption}</p> : <div className="mb-4" />}
      {children}
    </div>
  );
}

function HorizontalBars({
  items,
  unit,
  color,
  format
}: {
  items: NamedCount[] | Array<{ name: string; count: number }>;
  unit: string;
  color: 'emerald' | 'sky' | 'rose';
  format?: (n: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.count), 0.001);
  const bar =
    color === 'sky' ? 'bg-sky-500' : color === 'rose' ? 'bg-rose-500' : 'bg-emerald-500';
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(6, Math.round((100 * item.count) / max));
        return (
          <li key={item.name} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-slate-200 truncate font-medium">{item.name}</span>
              <span className="font-mono text-slate-400 shrink-0">
                {(format ? format(item.count) : String(item.count)) + unit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HighlightTable({
  rows,
  valueHeader,
  valueOf,
  valueClass,
  compact = false
}: {
  rows: HighlightMatch[];
  valueHeader: string;
  valueOf: (m: HighlightMatch) => string;
  valueClass: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[36rem] text-sm text-left">
        <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 sm:px-4 py-3 font-semibold">Event</th>
            <th className="px-3 sm:px-4 py-3 font-semibold">Match</th>
            <th className="px-3 sm:px-4 py-3 font-semibold">Score</th>
            <th className="px-3 sm:px-4 py-3 font-semibold">Winner</th>
            <th className="px-3 sm:px-4 py-3 font-semibold text-right">{valueHeader}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90 bg-slate-950/40">
          {rows.map((m) => (
            <tr key={`${m.category}-${m.matchup}-${m.result}-${m.when}`} className="hover:bg-slate-900/60">
              <td className={`px-3 sm:px-4 ${compact ? 'py-2.5' : 'py-3'} text-slate-400 whitespace-nowrap`}>
                {m.category}
                {m.stage ? (
                  <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                    {m.stage}
                  </span>
                ) : null}
              </td>
              <td className={`px-3 sm:px-4 ${compact ? 'py-2.5' : 'py-3'} text-slate-100 font-medium`}>
                {m.matchup}
              </td>
              <td className={`px-3 sm:px-4 ${compact ? 'py-2.5' : 'py-3'} font-mono text-slate-300 whitespace-nowrap`}>
                {m.result}
              </td>
              <td className={`px-3 sm:px-4 ${compact ? 'py-2.5' : 'py-3'} text-emerald-300 font-semibold`}>
                {m.winner}
              </td>
              <td
                className={`px-3 sm:px-4 ${compact ? 'py-2.5' : 'py-3'} font-mono text-right ${valueClass}`}
              >
                {valueOf(m)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WinRateStrip({ records }: { records: SideRecord[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Best win rates" subtitle="Minimum 3 appearances" />
      <div className="flex flex-wrap gap-2">
        {records.map((r) => (
          <span
            key={r.name}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3.5 py-1.5 text-sm"
          >
            <span className="font-semibold text-slate-100">{r.name}</span>
            <span className="font-mono text-slate-400">
              {r.wins}/{r.apps} · {r.pct}%
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
