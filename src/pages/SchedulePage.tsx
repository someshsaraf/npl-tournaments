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
 * No writes; staff editing stays on /admin.
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
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Schedule</h1>
        <p className="text-sm text-slate-400">
          {filtered.length} matches shown
          {completedCount > 0 ? ` · ${completedCount} completed overall` : ''}
        </p>
      </header>

      <div className="space-y-3">
        <FilterRow
          label="Date"
          options={dates}
          value={selectedDate}
          onChange={setSelectedDate}
          activeClass="bg-amber-400 text-slate-950"
        />
        <FilterRow
          label="Category"
          options={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
          activeClass="bg-emerald-500 text-slate-950"
        />
      </div>

      <div className="space-y-6">
        {Object.keys(byDate).length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">No fixtures for this filter.</p>
        )}
        {Object.entries(byDate).map(([date, dayFixtures]) => (
          <section key={date} className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="text-sm font-bold text-amber-400">{date}</h2>
              <span className="text-[11px] text-slate-500">{dayFixtures.length} matches</span>
            </div>
            <ul className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80 bg-slate-900/40">
              {dayFixtures.map((f) => {
                const done = f.status === 'completed';
                return (
                  <li
                    key={f.id}
                    className="grid grid-cols-1 sm:grid-cols-[4.5rem_1fr_auto] gap-1 sm:gap-3 px-3 sm:px-4 py-3 text-sm"
                  >
                    <span className="font-mono text-xs text-slate-400 sm:pt-0.5">{f.time}</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-indigo-300/90 truncate">
                        {f.category}
                        <span className="text-slate-600"> · </span>
                        <span className="text-slate-500 normal-case tracking-normal">{f.stage}</span>
                      </p>
                      <p className="font-semibold text-slate-100 truncate">{f.details}</p>
                      {done && f.winnerName ? (
                        <p className="text-xs text-emerald-400/90">
                          Winner: {f.winnerName}
                          {f.result ? ` · ${f.result}` : ''}
                        </p>
                      ) : null}
                    </div>
                    <div className="sm:justify-self-end sm:self-center">
                      <span
                        className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${
                          done
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
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
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
                  ? `${activeClass} font-bold shadow-md`
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80'
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
