import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { BarChart3 } from 'lucide-react';
import { db } from '../firebase';
import type { CompletedMatch } from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';

/**
 * Public results list — completed matches only (read-only Firebase).
 * Replaces the portal Score nav entry for online viewers.
 */
export default function ResultsPage() {
  const [rows, setRows] = useState<CompletedMatch[]>([]);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const completedRef = ref(db, 'completedMatches');
    const unsub = onValue(completedRef, (snap) => {
      setRows(sortCompletedMatches(Object.values(completedMatchesFromFirebase(snap.val()))));
    });
    return () => unsub();
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(rows.map((r) => r.category).filter(Boolean)))],
    [rows]
  );

  const filtered = useMemo(() => {
    if (category === 'All') return rows;
    return rows.filter((r) => r.category === category);
  }, [rows, category]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Results</h1>
          <p className="text-sm text-slate-400">
            {filtered.length} completed match{filtered.length === 1 ? '' : 'es'}
            {rows.length > 0 ? ` · newest first` : ''}
          </p>
        </div>
        {rows.length > 0 ? (
          <Link
            to="/stats"
            className="inline-flex items-center gap-1.5 self-start text-xs font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
          >
            <BarChart3 className="size-3.5" aria-hidden />
            Tournament stats
          </Link>
        ) : null}
      </header>

      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            if (typeof cat !== 'string' || !cat.trim()) return null;
            const active = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  active
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No results yet. Finished matches will appear here.
        </p>
      ) : (
        <ul className="rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80 bg-slate-900/40">
          {filtered.map((row) => {
            const id = row.fixtureId || row.id;
            const when = [row.completedDate, row.completedTime].filter(Boolean).join(' ');
            const stageLabel =
              typeof row.stage === 'string' && row.stage.trim() ? row.stage.trim() : '';
            const categoryLabel =
              typeof row.category === 'string' && row.category.trim()
                ? row.category.trim()
                : '';
            // Badge shows category (Exhibition, League, Boys Singles…), not a blanket "Final".
            const badgeLabel = categoryLabel || stageLabel || 'Match';
            const isFinalStage = /^final$/i.test(stageLabel);
            return (
              <li
                key={id}
                className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr_auto] gap-1 sm:gap-3 px-3 sm:px-4 py-3.5 text-sm"
              >
                <span className="font-mono text-xs text-amber-400/90 sm:pt-0.5">{when || '—'}</span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-300/90 truncate">
                    {categoryLabel || 'Match'}
                    {stageLabel ? (
                      <>
                        <span className="text-slate-600"> · </span>
                        <span className="text-slate-500 normal-case tracking-normal">
                          {stageLabel}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="font-semibold text-slate-100 truncate">
                    {row.details || `${row.player1 || row.teamA} vs ${row.player2 || row.teamB}`}
                  </p>
                  <p className="text-xs text-emerald-400/90">
                    Winner: {row.winnerName || '—'}
                    {row.result ? ` · ${row.result}` : ''}
                    {row.isTrump ? ' · Trump' : ''}
                  </p>
                </div>
                <div className="sm:justify-self-end sm:self-center">
                  <span
                    className={`inline-block max-w-[10rem] truncate text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${
                      isFinalStage
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                    }`}
                    title={badgeLabel}
                  >
                    {badgeLabel}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
