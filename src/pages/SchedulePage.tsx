import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
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

  return (
    <div className="portal-page space-y-6">
      <header className="space-y-1">
        <h1 className="portal-display text-4xl sm:text-5xl text-[var(--pine-deep)]">
          Schedule
        </h1>
        <p className="text-sm text-[var(--pine-muted)]">
          {filtered.length} matches shown
          {completedCount > 0 ? ` · ${completedCount} completed overall` : ''}
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-[var(--pine-line)] bg-[var(--pine-paper)] p-4 sm:p-5">
        <FilterRow
          label="Date"
          options={dates}
          value={selectedDate}
          onChange={setSelectedDate}
          activeClass="bg-[var(--pine-clay)] text-white"
        />
        <FilterRow
          label="Category"
          options={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
          activeClass="bg-[var(--pine-deep)] text-[var(--pine-lime)]"
        />
      </div>

      <div className="space-y-7">
        {Object.keys(byDate).length === 0 && (
          <p className="text-sm text-[var(--pine-muted)] text-center py-10">
            No fixtures for this filter.
          </p>
        )}
        {Object.entries(byDate).map(([date, dayFixtures]) => (
          <section key={date} className="space-y-2">
            <div className="flex items-center justify-between pb-1">
              <h2 className="portal-display text-xl text-[var(--pine-deep)]">{date}</h2>
              <span className="text-[11px] text-[var(--pine-muted)] font-medium">
                {dayFixtures.length} matches
              </span>
            </div>
            <ul className="rounded-2xl border border-[var(--pine-line)] overflow-hidden divide-y divide-[var(--pine-line)] bg-[var(--pine-paper)]">
              {dayFixtures.map((f) => {
                const done = f.status === 'completed';
                return (
                  <li
                    key={f.id}
                    className="grid grid-cols-1 sm:grid-cols-[4.5rem_1fr_auto] gap-1 sm:gap-3 px-3 sm:px-4 py-3.5 text-sm"
                  >
                    <span className="font-mono text-xs text-[var(--pine-muted)] sm:pt-0.5">
                      {f.time}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-[var(--pine-sky)] truncate font-semibold">
                        {f.category}
                        <span className="text-[var(--pine-line)]"> · </span>
                        <span className="text-[var(--pine-muted)] normal-case tracking-normal font-medium">
                          {f.stage}
                        </span>
                      </p>
                      <p className="font-semibold text-[var(--pine-ink)] truncate">{f.details}</p>
                      {done && f.winnerName ? (
                        <p className="text-xs text-[var(--pine-leaf)] font-medium">
                          Winner: {f.winnerName}
                          {f.result ? ` · ${f.result}` : ''}
                        </p>
                      ) : null}
                    </div>
                    <div className="sm:justify-self-end sm:self-center">
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                          done
                            ? 'bg-[var(--pine-leaf)]/15 text-[var(--pine-leaf)]'
                            : 'bg-[var(--pine-mist)] text-[var(--pine-muted)]'
                        }`}
                      >
                        {done ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

type FilterRowProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  activeClass: string;
};

function FilterRow({ label, options, value, onChange, activeClass }: FilterRowProps) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const safeValue = typeof value === 'string' ? value : 'All';

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-[var(--pine-muted)] uppercase tracking-wider">
        {label}
      </p>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {options.map((opt) => {
          if (typeof opt !== 'string' || !opt.trim()) return null;
          const active = opt === safeValue;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                active
                  ? `${activeClass} font-bold`
                  : 'bg-white text-[var(--pine-muted)] border border-[var(--pine-line)] hover:text-[var(--pine-deep)]'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
