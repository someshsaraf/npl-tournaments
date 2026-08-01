import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import type { CompletedMatch } from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';

/**
 * Public results list — completed matches only (read-only Firebase).
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
    <div className="portal-page space-y-6">
      <header className="space-y-1">
        <h1 className="portal-display text-4xl sm:text-5xl text-[var(--pine-deep)]">
          Results
        </h1>
        <p className="text-sm text-[var(--pine-muted)]">
          {filtered.length} completed match{filtered.length === 1 ? '' : 'es'}
          {rows.length > 0 ? ' · newest first' : ''}
        </p>
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
                    ? 'bg-[var(--pine-deep)] text-[var(--pine-lime)] font-bold'
                    : 'bg-[var(--pine-paper)] text-[var(--pine-muted)] border border-[var(--pine-line)] hover:text-[var(--pine-deep)]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--pine-muted)] text-center py-12 rounded-2xl border border-[var(--pine-line)] bg-[var(--pine-paper)]">
          No results yet. Finished matches will appear here.
        </p>
      ) : (
        <ul className="rounded-2xl border border-[var(--pine-line)] overflow-hidden divide-y divide-[var(--pine-line)] bg-[var(--pine-paper)]">
          {filtered.map((row) => {
            const id = row.fixtureId || row.id;
            const when = [row.completedDate, row.completedTime].filter(Boolean).join(' ');
            return (
              <li
                key={id}
                className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr_auto] gap-1 sm:gap-3 px-3 sm:px-4 py-3.5 text-sm"
              >
                <span className="font-mono text-xs text-[var(--pine-clay)] sm:pt-0.5">
                  {when || '—'}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--pine-sky)] truncate font-semibold">
                    {row.category || 'Match'}
                    {row.stage ? (
                      <>
                        <span className="text-[var(--pine-line)]"> · </span>
                        <span className="text-[var(--pine-muted)] normal-case tracking-normal font-medium">
                          {row.stage}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="font-semibold text-[var(--pine-ink)] truncate">
                    {row.details || `${row.player1 || row.teamA} vs ${row.player2 || row.teamB}`}
                  </p>
                  <p className="text-xs text-[var(--pine-leaf)] font-medium">
                    Winner: {row.winnerName || '—'}
                    {row.result ? ` · ${row.result}` : ''}
                    {row.isTrump ? ' · Trump' : ''}
                  </p>
                </div>
                <div className="sm:justify-self-end sm:self-center">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--pine-leaf)]/15 text-[var(--pine-leaf)]">
                    Final
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
