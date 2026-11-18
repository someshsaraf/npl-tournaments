import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db';
import { onValue, ref, remove, set, update } from '../../lib/realtime';
import {
  normalizeVilla,
  predictionCategories,
  predictionVotes,
  predictionsOpenPath,
  predictionsPath,
  type PredictionVote
} from '../../data/predictions';
import type { PublishedTournament } from '../../data/tournament';
import type { Sport } from '../../data/tournamentData';
import { usePredictions } from '../../hooks/usePredictions';
import { Btn, ConfirmBtn, Notice, Panel, inputBaseCls } from './ui';

/**
 * Winner predictions for one sport: open/close voting per category, watch
 * the meter, and delete wrong votes (villa → pick is admin-only). Candidates
 * come from the published tournament, so publish the draw first.
 */
export function PredictionsPanel({ sport, published }: { sport: Sport; published: PublishedTournament | null }) {
  const categories = useMemo(() => predictionCategories(published), [published]);
  const { tallies, open } = usePredictions(sport);
  const [votes, setVotes] = useState<PredictionVote[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onValue(ref(db, predictionsPath(sport)), (snap) => setVotes(predictionVotes(snap.val()))), [sport]);

  const fail = (err: unknown) => {
    console.error('Predictions update failed:', err);
    setError('Change failed — check your connection.');
  };
  const setOpen = (categoryId: string, on: boolean) =>
    set(ref(db, `${predictionsOpenPath(sport)}/${categoryId}`), on ? true : null).catch(fail);
  const setAll = (on: boolean) =>
    update(ref(db, predictionsOpenPath(sport)), Object.fromEntries(categories.map((c) => [c.id, on ? true : null]))).catch(fail);

  const needle = normalizeVilla(filter) ?? filter.trim().toUpperCase();

  if (!published) {
    return (
      <Panel title="Predictions" subtitle="Residents predict each category's winner, one vote per villa.">
        <Notice tone="warn">Publish the tournament first — residents vote for the players and teams in the published draw.</Notice>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Predictions"
        subtitle="Residents predict each category's winner — one vote per villa per category (and one per phone). Votes can't be changed; delete a wrong one below and that villa can vote again. Villa numbers are only visible here."
        actions={
          categories.length ? (
            <>
              <Btn small onClick={() => setAll(true)}>
                Open all
              </Btn>
              <Btn small onClick={() => setAll(false)}>
                Close all
              </Btn>
            </>
          ) : undefined
        }
      >
        {categories.length === 0 ? (
          <Notice tone="warn">No category in the published draw has two or more players/teams yet.</Notice>
        ) : null}
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          Find villa
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. 101" className={`${inputBaseCls} w-32`} />
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Panel>

      {categories.map((c) => {
        const counts = tallies[c.id] ?? {};
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const isOpen = open.has(c.id);
        const name = (id: string) => c.candidates.find((x) => x.id === id)?.name ?? '(no longer in draw)';
        const rows = votes.filter((v) => v.categoryId === c.id && (!needle || v.villa.includes(needle)));
        return (
          <Panel
            key={c.id}
            title={c.label}
            subtitle={`${total} vote${total === 1 ? '' : 's'} · ${isOpen ? 'voting open' : 'voting closed'}`}
            actions={
              <>
                <Btn small tone={isOpen ? 'neutral' : 'primary'} onClick={() => setOpen(c.id, !isOpen)}>
                  {isOpen ? 'Close voting' : 'Open voting'}
                </Btn>
                {total > 0 ? (
                  <ConfirmBtn small onConfirm={() => remove(ref(db, `${predictionsPath(sport)}/${c.id}`)).catch(fail)} confirmLabel="Delete all votes?">
                    Clear votes
                  </ConfirmBtn>
                ) : null}
              </>
            }
          >
            <ul className="space-y-1">
              {[...c.candidates]
                .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
                .map((x) => {
                  const n = counts[x.id] ?? 0;
                  const pct = total ? Math.round((n / total) * 100) : 0;
                  return (
                    <li key={x.id} className="relative overflow-hidden rounded-lg bg-slate-800/60">
                      <span className="absolute inset-y-0 left-0 bg-lime-400/25" style={{ width: `${pct}%` }} aria-hidden />
                      <span className="relative flex justify-between gap-3 px-3 py-1.5 text-sm">
                        <span className="font-semibold text-slate-100">{x.name}</span>
                        <span className="tabular-nums text-slate-300">
                          {pct}% ({n})
                        </span>
                      </span>
                    </li>
                  );
                })}
            </ul>
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="py-1 pr-3">Villa</th>
                      <th className="py-1 pr-3">Pick</th>
                      <th className="py-1 pr-3">When</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => (
                      <tr key={v.villa} className="border-t border-slate-800">
                        <td className="py-1.5 pr-3 font-bold text-slate-100">{v.villa}</td>
                        <td className="py-1.5 pr-3 text-slate-300">{name(v.pick)}</td>
                        <td className="py-1.5 pr-3 text-xs text-slate-500 whitespace-nowrap">
                          {v.at ? new Date(v.at).toLocaleString() : ''}
                        </td>
                        <td className="py-1.5 text-right">
                          <ConfirmBtn
                            small
                            onConfirm={() => remove(ref(db, `${predictionsPath(sport)}/${c.id}/${v.villa}`)).catch(fail)}
                            confirmLabel="Delete vote?"
                          >
                            Delete
                          </ConfirmBtn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : needle && total > 0 ? (
              <p className="text-xs text-slate-500">No vote from villa {needle} here.</p>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}
