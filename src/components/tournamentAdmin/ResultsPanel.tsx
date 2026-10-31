import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, remove, set } from '../../lib/realtime';
import { db } from '../../db';
import type { CompletedMatch } from '../../data/tournamentData';
import {
  STAGE_LABEL,
  categoryLabel,
  matchTypeForFormat,
  tennisStageForFixture,
  type Tournament,
  type TournamentFixture
} from '../../data/tournament';
import {
  completedMatchStorageKey,
  formatMatchDate,
  formatMatchTime,
  sortCompletedMatches,
  toFirebaseWritable
} from '../../utils/completedMatches';
import {
  compareFixtureTime,
  fixtureStageLabel,
  isByeFixture,
  resolveSide,
  resultFor,
  type TournamentContext
} from '../../utils/tournament';
import { Btn, ConfirmBtn, FieldLabel, Notice, Panel, inputBaseCls } from './ui';

/** What the score boxes mean for this sport. */
function scoreHint(t: Tournament): string {
  return t.sport === 'tennis' ? 'games won' : 'points (best-of-3: games won)';
}

function winnerFrom(a: number, b: number, picked: 1 | 2 | null): 1 | 2 | null {
  if (picked) return picked;
  if (a > b) return 1;
  if (b > a) return 2;
  return null;
}

/**
 * Every recorded result for this sport: edit the score / winner, delete it,
 * or record one by hand for a scheduled match that wasn't scored live.
 * Writes the same completedMatches rows the live scorer saves, so pool
 * tables and brackets update the same way.
 */
export function ResultsPanel({ t, ctx }: { t: Tournament; ctx: TournamentContext }) {
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const rows = useMemo(() => sortCompletedMatches(Object.values(ctx.results)), [ctx.results]);
  const fixtureById = ctx.fixturesById;

  const report = (p: Promise<void>, ok: string) =>
    p.then(() => setMsg({ tone: 'ok', text: ok })).catch((err: unknown) =>
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed.' })
    );

  return (
    <div className="space-y-6">
      <RecordResult t={t} ctx={ctx} onSaved={(text) => setMsg({ tone: 'ok', text })} />

      <Panel
        title="Recorded results"
        subtitle={`${rows.length} result${rows.length === 1 ? '' : 's'}. Scores are ${scoreHint(t)}. Changes show to residents straight away — results aren't part of the draft.`}
        actions={
          <Link
            to="/admin/results"
            className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700"
          >
            Export CSV / PDF
          </Link>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No results yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {rows.map((r) => (
              <ResultRow
                key={r.id}
                t={t}
                ctx={ctx}
                row={r}
                fixture={fixtureById.get(r.fixtureId) ?? null}
                onSave={(next) => report(set(ref(db, `completedMatches/${completedMatchStorageKey(r.id)}`), toFirebaseWritable(next)), 'Result updated.')}
                onDelete={() => report(remove(ref(db, `completedMatches/${completedMatchStorageKey(r.id)}`)), 'Result deleted.')}
              />
            ))}
          </ul>
        )}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </Panel>
    </div>
  );
}

function ResultRow({
  t,
  ctx,
  row,
  fixture,
  onSave,
  onDelete
}: {
  t: Tournament;
  ctx: TournamentContext;
  row: CompletedMatch;
  fixture: TournamentFixture | null;
  onSave: (next: CompletedMatch) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(String(row.score1));
  const [b, setB] = useState(String(row.score2));
  const [picked, setPicked] = useState<1 | 2 | null>(null);
  const nameA = row.player1 || row.teamA || 'Side A';
  const nameB = row.player2 || row.teamB || 'Side B';
  const cat = fixture ? t.categories.find((c) => c.id === fixture.categoryId) : null;
  const where = fixture ? `${cat ? categoryLabel(cat) : row.category} · ${fixtureStageLabel(ctx, fixture)}` : `${row.category || 'Ad-hoc'} · not on the schedule`;

  const save = () => {
    const s1 = Math.max(0, Math.trunc(Number(a)));
    const s2 = Math.max(0, Math.trunc(Number(b)));
    const w = winnerFrom(s1, s2, picked);
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || !w) return;
    onSave({
      ...row,
      score1: s1,
      score2: s2,
      winnerSide: w,
      winnerName: w === 1 ? nameA : nameB,
      result: `${s1}-${s2}`,
      ...(row.bestOf === 3 ? { gamesWon1: s1, gamesWon2: s2 } : {}),
      ...(row.tennis ? { tennis: { ...row.tennis, gamesWon1: s1, gamesWon2: s2 } } : {})
    });
    setEditing(false);
    setPicked(null);
  };

  const s1 = Number(a);
  const s2 = Number(b);
  const w = winnerFrom(s1, s2, picked);

  return (
    <li className="py-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-28 shrink-0 text-[11px] font-mono text-slate-400">
          {row.completedDate}
          <br />
          {row.completedTime}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-lime-300/80 truncate">{where}</p>
          <p className="text-sm text-slate-100 truncate">
            <span className={row.winnerSide === 1 ? 'font-black' : 'text-slate-400'}>{nameA}</span>{' '}
            <span className="text-slate-500">vs</span>{' '}
            <span className={row.winnerSide === 2 ? 'font-black' : 'text-slate-400'}>{nameB}</span>
            <span className="ml-2 font-mono text-emerald-300">{row.result}</span>
          </p>
        </div>
        {!editing ? (
          <div className="flex gap-2">
            <Btn small onClick={() => setEditing(true)}>
              Edit
            </Btn>
            <ConfirmBtn small onConfirm={onDelete} confirmLabel="Delete result?">
              Delete
            </ConfirmBtn>
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-lime-400/30 bg-slate-950/60 p-2.5">
          <label className="block">
            <FieldLabel>{nameA}</FieldLabel>
            <input type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} className={`${inputBaseCls} w-24`} />
          </label>
          <label className="block">
            <FieldLabel>{nameB}</FieldLabel>
            <input type="number" min={0} value={b} onChange={(e) => setB(e.target.value)} className={`${inputBaseCls} w-24`} />
          </label>
          {s1 === s2 ? (
            <label className="block">
              <FieldLabel>Winner (level score)</FieldLabel>
              <select
                value={picked ?? ''}
                onChange={(e) => setPicked(e.target.value === '1' ? 1 : e.target.value === '2' ? 2 : null)}
                className={`${inputBaseCls} w-44`}
              >
                <option value="">Pick…</option>
                <option value="1">{nameA}</option>
                <option value="2">{nameB}</option>
              </select>
            </label>
          ) : null}
          <Btn tone="primary" small onClick={save} disabled={!w}>
            Save
          </Btn>
          <Btn small onClick={() => setEditing(false)}>
            Cancel
          </Btn>
          {fixture && fixture.stage !== 'final' ? (
            <p className="w-full text-[11px] text-slate-500">Changing the winner also updates pool tables and the next knockout round.</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Enter a result by hand for a scheduled match whose sides are known. */
function RecordResult({ t, ctx, onSaved }: { t: Tournament; ctx: TournamentContext; onSaved: (text: string) => void }) {
  const open = useMemo(
    () =>
      t.fixtures
        .filter((f) => !isByeFixture(f) && !resultFor(ctx, f.id))
        .filter((f) => resolveSide(ctx, f.sideA).entry && resolveSide(ctx, f.sideB).entry)
        .sort(compareFixtureTime),
    [t.fixtures, ctx]
  );
  const [fixtureId, setFixtureId] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [picked, setPicked] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const f = open.find((x) => x.id === fixtureId) ?? null;
  const nameA = f ? resolveSide(ctx, f.sideA).label : 'Side A';
  const nameB = f ? resolveSide(ctx, f.sideB).label : 'Side B';

  const save = async () => {
    if (!f) return;
    const s1 = Math.trunc(Number(a));
    const s2 = Math.trunc(Number(b));
    const w = winnerFrom(s1, s2, picked);
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0 || !w) {
      setError('Enter both scores (and pick the winner if they are level).');
      return;
    }
    const cat = t.categories.find((c) => c.id === f.categoryId);
    const now = new Date();
    const badminton = t.badmintonRules[f.stage];
    const row: CompletedMatch = {
      id: f.id,
      fixtureId: f.id,
      category: cat ? categoryLabel(cat) : '',
      stage: f.stage === 'pool' ? fixtureStageLabel(ctx, f) : STAGE_LABEL[f.stage],
      details: `${nameA} vs ${nameB}`,
      scheduledDate: f.date,
      scheduledTime: f.time,
      teamA: nameA,
      teamB: nameB,
      player1: nameA,
      player2: nameB,
      score1: s1,
      score2: s2,
      maxPoints: t.sport === 'badminton' ? badminton.maxPoints : 11,
      winnerSide: w,
      winnerName: w === 1 ? nameA : nameB,
      result: `${s1}-${s2}`,
      status: 'completed',
      completedAt: now.toISOString(),
      completedDate: formatMatchDate(now),
      completedTime: formatMatchTime(now),
      isTrump: false,
      sport: t.sport,
      ...(t.sport === 'badminton' ? { bestOf: badminton.bestOf, ...(badminton.bestOf === 3 ? { gamesWon1: s1, gamesWon2: s2 } : {}) } : {}),
      ...(t.sport === 'tennis' && cat
        ? {
            tennis: {
              tennisStage: tennisStageForFixture(f.stage),
              matchType: matchTypeForFormat(cat.format),
              gamesWon1: s1,
              gamesWon2: s2,
              gameLog: []
            }
          }
        : {})
    };
    try {
      await set(ref(db, `completedMatches/${completedMatchStorageKey(f.id)}`), toFirebaseWritable(row));
      setFixtureId('');
      setA('');
      setB('');
      setPicked(null);
      setError(null);
      onSaved(`Recorded ${nameA} vs ${nameB}: ${s1}-${s2}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the result.');
    }
  };

  return (
    <Panel
      title="Record a result by hand"
      subtitle={`For a scheduled match that wasn't scored live. Scores are ${scoreHint(t)}. Uses the draft's fixtures — publish first if you just added the match.`}
    >
      {open.length === 0 ? (
        <p className="text-sm text-slate-500">Every match with known players already has a result.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-[16rem]">
            <FieldLabel>Match</FieldLabel>
            <select value={fixtureId} onChange={(e) => setFixtureId(e.target.value)} className={`${inputBaseCls} w-full`}>
              <option value="">Pick a match…</option>
              {open.map((x) => {
                const cat = t.categories.find((c) => c.id === x.categoryId);
                return (
                  <option key={x.id} value={x.id}>
                    {cat ? categoryLabel(cat) : ''} · {fixtureStageLabel(ctx, x)} — {resolveSide(ctx, x.sideA).label} vs{' '}
                    {resolveSide(ctx, x.sideB).label}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            <FieldLabel>{nameA}</FieldLabel>
            <input type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} disabled={!f} className={`${inputBaseCls} w-24`} />
          </label>
          <label className="block">
            <FieldLabel>{nameB}</FieldLabel>
            <input type="number" min={0} value={b} onChange={(e) => setB(e.target.value)} disabled={!f} className={`${inputBaseCls} w-24`} />
          </label>
          {f && a !== '' && a === b ? (
            <label className="block">
              <FieldLabel>Winner (level score)</FieldLabel>
              <select
                value={picked ?? ''}
                onChange={(e) => setPicked(e.target.value === '1' ? 1 : e.target.value === '2' ? 2 : null)}
                className={`${inputBaseCls} w-44`}
              >
                <option value="">Pick…</option>
                <option value="1">{nameA}</option>
                <option value="2">{nameB}</option>
              </select>
            </label>
          ) : null}
          <Btn tone="primary" onClick={() => void save()} disabled={!f || a === '' || b === ''}>
            Save result
          </Btn>
        </div>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Panel>
  );
}
