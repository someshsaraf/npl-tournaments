import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { db } from '../../db';
import { push, ref, remove, set, update } from '../../lib/realtime';
import { groupByYear, pastWinnersPath, type PastWinner } from '../../data/pastWinners';
import { categoryLabel, type Tournament } from '../../data/tournament';
import { SPORT_LABEL } from '../../data/tournamentData';
import { usePastWinners } from '../../hooks/usePastWinners';
import { Btn, CommitInput, ConfirmBtn, FieldLabel, Notice, Panel, inputCls } from './ui';

/**
 * Champions from earlier seasons. Saved straight to the data store (not the
 * draft), so they show on the resident page immediately — no Publish needed.
 */
export function PastWinnersPanel({ t }: { t: Tournament }) {
  const { sport } = t;
  const { loaded, winners } = usePastWinners(sport);
  const [year, setYear] = useState(String(t.year - 1));
  const [category, setCategory] = useState('');
  const [winner, setWinner] = useState('');
  const [runnerUp, setRunnerUp] = useState('');
  const [score, setScore] = useState('');
  const [error, setError] = useState<string | null>(null);

  const suggestions = [
    ...new Set([...t.categories.map((c) => categoryLabel(c)), ...winners.map((w) => w.category)].filter(Boolean))
  ];
  const yearNum = Number(year);
  const canAdd = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 && (winner.trim() !== '' || category.trim() !== '');

  const fail = (err: unknown) => {
    console.error('Saving past winners failed:', err);
    setError('Changes are not saving — check your connection.');
  };

  const add = () => {
    if (!canAdd) return;
    setError(null);
    const sameYear = winners.filter((w) => w.year === yearNum);
    const entry: Omit<PastWinner, 'id'> = {
      year: yearNum,
      category: category.trim(),
      winner: winner.trim(),
      runnerUp: runnerUp.trim(),
      score: score.trim(),
      order: Math.max(0, ...sameYear.map((w) => w.order)) + 1
    };
    set(push(ref(db, pastWinnersPath(sport))), entry).catch(fail);
    setWinner('');
    setRunnerUp('');
    setScore('');
  };

  // One click: a blank row per category of this tournament for the chosen
  // year (skipping ones already there), then fill in the names below.
  const existing = new Set(winners.filter((w) => w.year === yearNum).map((w) => w.category.toLowerCase()));
  const missing = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100
    ? suggestions.filter((c) => t.categories.some((tc) => categoryLabel(tc) === c) && !existing.has(c.toLowerCase()))
    : [];
  const addCategories = () => {
    if (missing.length === 0) return;
    setError(null);
    const start = Math.max(0, ...winners.filter((w) => w.year === yearNum).map((w) => w.order));
    const values: Record<string, Omit<PastWinner, 'id'>> = {};
    missing.forEach((category, i) => {
      values[push(ref(db, pastWinnersPath(sport))).key!] = {
        year: yearNum,
        category,
        winner: '',
        runnerUp: '',
        score: '',
        order: start + i + 1
      };
    });
    update(ref(db, pastWinnersPath(sport)), values).catch(fail);
  };

  const edit = (w: PastWinner, patch: Partial<Omit<PastWinner, 'id'>>) => {
    update(ref(db, `${pastWinnersPath(sport)}/${w.id}`), patch).catch(fail);
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Add a past winner"
        subtitle={`Champions from earlier ${SPORT_LABEL[sport]} seasons. They appear on the resident page straight away — no need to publish.`}
      >
        <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr_1fr_120px]">
          <label>
            <FieldLabel>Year</FieldLabel>
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel>Category</FieldLabel>
            <input
              list="past-winner-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Men's Singles"
              maxLength={80}
              className={inputCls}
            />
            <datalist id="past-winner-categories">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <FieldLabel>Winner</FieldLabel>
            <input
              value={winner}
              onChange={(e) => setWinner(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Name (or pair: A & B)"
              maxLength={80}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel>Runner-up (optional)</FieldLabel>
            <input
              value={runnerUp}
              onChange={(e) => setRunnerUp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              maxLength={80}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel>Final score</FieldLabel>
            <input
              value={score}
              onChange={(e) => setScore(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="e.g. 6–4"
              maxLength={40}
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="primary" onClick={add} disabled={!canAdd}>
            <Trophy className="size-3.5" aria-hidden /> Add winner
          </Btn>
          {loaded && missing.length > 0 ? (
            <Btn onClick={addCategories}>
              Add this tournament's categories for {yearNum} ({missing.length})
            </Btn>
          ) : null}
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Panel>

      <Panel title="Past winners" subtitle="Click a field to edit it; changes save when you leave the field. Rows without a winner stay hidden from residents.">
        {!loaded ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : winners.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <div className="space-y-5">
            {groupByYear(winners).map((g) => (
              <div key={g.year} className="space-y-2">
                <h3 className="text-sm font-black text-slate-200">{g.year}</h3>
                {g.winners.map((w) => (
                  <div key={w.id} className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_1fr_110px_auto] items-center">
                    <CommitInput
                      type="number"
                      aria-label="Year"
                      value={String(w.year)}
                      onCommit={(v) => {
                        const n = Number(v);
                        if (Number.isInteger(n) && n >= 1990 && n <= 2100) edit(w, { year: n });
                      }}
                    />
                    <CommitInput aria-label="Category" placeholder="Category" maxLength={80} value={w.category} onCommit={(v) => edit(w, { category: v.trim() })} />
                    <CommitInput
                      aria-label="Winner"
                      placeholder="Winner"
                      maxLength={80}
                      value={w.winner}
                      onCommit={(v) => edit(w, { winner: v.trim() })}
                    />
                    <CommitInput aria-label="Runner-up" placeholder="Runner-up" maxLength={80} value={w.runnerUp} onCommit={(v) => edit(w, { runnerUp: v.trim() })} />
                    <CommitInput aria-label="Final score" placeholder="Score" maxLength={40} value={w.score} onCommit={(v) => edit(w, { score: v.trim() })} />
                    <ConfirmBtn
                      small
                      onConfirm={() => remove(ref(db, `${pastWinnersPath(sport)}/${w.id}`)).catch(fail)}
                      confirmLabel="Delete?"
                    >
                      Delete
                    </ConfirmBtn>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
