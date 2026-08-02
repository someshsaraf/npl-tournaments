import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { Trophy } from 'lucide-react';
import { db } from '../firebase';
import type { CompletedMatch } from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterPills } from '../components/ui/FilterPills';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';

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
      <PageHeader
        title="Results"
        description={`${filtered.length} completed match${filtered.length === 1 ? '' : 'es'}${rows.length > 0 ? ' · newest first' : ''}`}
      />

      {categories.length > 1 && (
        <FilterPills
          label="Filter by category"
          options={categories}
          value={category}
          onChange={setCategory}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No results yet"
          description="Finished matches will appear here automatically."
        />
      ) : (
        <ul className="portal-list">
          {filtered.map((row) => {
            const id = row.fixtureId || row.id;
            const when = [row.completedDate, row.completedTime].filter(Boolean).join(' ');
            return (
              <li key={id} className="portal-list-item">
                <div className="flex flex-col sm:grid sm:grid-cols-[7.5rem_1fr_auto] gap-2 sm:gap-4">
                  <span className="font-mono text-xs font-semibold text-[var(--pine-clay)] sm:pt-1">
                    {when || '—'}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--pine-sky)] truncate font-semibold">
                      {row.category || 'Match'}
                      {row.stage ? (
                        <>
                          <span className="text-[var(--pine-line)] mx-1">·</span>
                          <span className="text-[var(--pine-muted)] normal-case tracking-normal font-medium">
                            {row.stage}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className="font-semibold text-[var(--pine-ink)] leading-snug">
                      {row.details || `${row.player1 || row.teamA} vs ${row.player2 || row.teamB}`}
                    </p>
                    <p className="text-xs text-[var(--pine-leaf)] font-medium">
                      Winner: {row.winnerName || '—'}
                      {row.result ? ` · ${row.result}` : ''}
                      {row.isTrump ? ' · Trump' : ''}
                    </p>
                  </div>
                  <div className="sm:justify-self-end sm:self-center">
                    <StatusBadge status="final" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
