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
import { MatchCard } from '../components/ui/MatchCard';
import { EmptyState } from '../components/ui/EmptyState';

function splitTeams(row: CompletedMatch): [string, string] {
  if (row.details?.includes(' vs ')) {
    const [a, b] = row.details.split(' vs ');
    return [a, b];
  }
  return [row.player1 || row.teamA || 'Side A', row.player2 || row.teamB || 'Side B'];
}

/**
 * Goalkick latest-matches style results page.
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
    <div className="portal-page space-y-8">
      <PageHeader
        label="Standings"
        title="Match Results"
        description={`${filtered.length} completed match${filtered.length === 1 ? '' : 'es'} · newest first`}
      />

      {categories.length > 1 && (
        <FilterPills
          label="Category"
          options={categories}
          value={category}
          onChange={setCategory}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No Results Yet"
          description="Finished matches will appear here automatically."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((row) => {
            const id = row.fixtureId || row.id;
            const [teamA, teamB] = splitTeams(row);
            const when = [row.completedDate, row.completedTime].filter(Boolean).join(' · ');
            return (
              <MatchCard
                key={id}
                date={row.completedDate}
                time={when || row.completedTime}
                category={row.category}
                stage={row.stage}
                teamA={teamA}
                teamB={teamB}
                status="completed"
                winnerName={row.winnerName}
                result={row.result}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
