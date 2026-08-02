import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { CalendarX2 } from 'lucide-react';
import { db } from '../firebase';
import {
  FIXTURES,
  FIXTURE_DATES,
  type Fixture
} from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  mergeFixturesWithResults
} from '../utils/completedMatches';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterPills } from '../components/ui/FilterPills';
import { MatchListItem } from '../components/ui/MatchListItem';
import { EmptyState } from '../components/ui/EmptyState';

/**
 * Read-only public schedule with date/category filters and completed results.
 */
export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [fixtures, setFixtures] = useState<Fixture[]>(() =>
    mergeFixturesWithResults(FIXTURES, {})
  );

  useEffect(() => {
    const completedRef = ref(db, 'completedMatches');
    const unsub = onValue(completedRef, (snap) => {
      const byId = completedMatchesFromFirebase(snap.val());
      setFixtures(mergeFixturesWithResults(FIXTURES, byId));
    });
    return () => unsub();
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(FIXTURES.map((f) => f.category)))],
    []
  );
  const dates = useMemo(() => ['All', ...FIXTURE_DATES], []);

  const filtered = useMemo(() => {
    return fixtures.filter((f) => {
      const dateOk = selectedDate === 'All' || f.date === selectedDate;
      const catOk = selectedCategory === 'All' || f.category === selectedCategory;
      return dateOk && catOk;
    });
  }, [fixtures, selectedDate, selectedCategory]);

  const byDate = useMemo(() => {
    return filtered.reduce<Record<string, Fixture[]>>((acc, fixture) => {
      if (!acc[fixture.date]) acc[fixture.date] = [];
      acc[fixture.date].push(fixture);
      return acc;
    }, {});
  }, [filtered]);

  const completedCount = fixtures.filter((f) => f.status === 'completed').length;
  const dateKeys = Object.keys(byDate);

  return (
    <div className="portal-page space-y-6">
      <PageHeader
        title="Schedule"
        description={`${filtered.length} matches shown${completedCount > 0 ? ` · ${completedCount} completed overall` : ''}`}
      />

      <div className="portal-card p-4 sm:p-5 space-y-4">
        <FilterPills
          label="Filter by date"
          options={dates}
          value={selectedDate}
          onChange={setSelectedDate}
          variant="clay"
        />
        <FilterPills
          label="Filter by category"
          options={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div className="space-y-6">
        {dateKeys.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No fixtures match your filters"
            description="Try selecting a different date or category."
          />
        ) : (
          dateKeys.map((date) => {
            const dayFixtures = byDate[date];
            return (
              <section key={date} className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="portal-section-title">{date}</h2>
                  <span className="text-xs text-[var(--pine-muted)] font-medium">
                    {dayFixtures.length} match{dayFixtures.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <ul className="portal-list">
                  {dayFixtures.map((f) => (
                    <MatchListItem
                      key={f.id}
                      time={f.time}
                      category={f.category}
                      stage={f.stage}
                      details={f.details}
                      status={f.status === 'completed' ? 'completed' : 'scheduled'}
                      winnerName={f.winnerName}
                      result={f.result}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
