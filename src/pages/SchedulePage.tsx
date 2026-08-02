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
import { MatchCard } from '../components/ui/MatchCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SectionHeading } from '../components/ui/SectionHeading';

function splitTeams(details: string): [string, string] {
  const parts = details.split(' vs ');
  return [parts[0] || details, parts[1] || 'TBD'];
}

/**
 * Goalkick match-schedule-dark style fixture list.
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
    <div className="portal-page space-y-8">
      <PageHeader
        label="Fixtures"
        title="Match Schedule"
        description={`${filtered.length} matches shown${completedCount > 0 ? ` · ${completedCount} completed` : ''}`}
      />

      <div className="portal-card p-5 sm:p-6 space-y-5 gk-stripe">
        <FilterPills
          label="Date"
          options={dates}
          value={selectedDate}
          onChange={setSelectedDate}
          variant="clay"
        />
        <FilterPills
          label="Category"
          options={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div className="space-y-8">
        {dateKeys.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No Fixtures Found"
            description="Try selecting a different date or category."
          />
        ) : (
          dateKeys.map((date) => {
            const dayFixtures = byDate[date];
            return (
              <section key={date} className="space-y-4">
                <SectionHeading
                  label={`${dayFixtures.length} Matches`}
                  title={date}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dayFixtures.map((f) => {
                    const [teamA, teamB] = splitTeams(f.details);
                    const done = f.status === 'completed';
                    return (
                      <MatchCard
                        key={f.id}
                        date={f.date}
                        time={f.time}
                        category={f.category}
                        stage={f.stage}
                        teamA={teamA}
                        teamB={teamB}
                        status={done ? 'completed' : 'scheduled'}
                        winnerName={f.winnerName}
                        result={f.result}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
