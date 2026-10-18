import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  STAGE_LABEL,
  categoryLabel,
  type FixtureSide,
  type FixtureStage,
  type TennisTournament,
  type TournamentCategory,
  type TournamentFixture
} from '../../../data/tennisTournament';
import {
  autoSchedule,
  compareFixtureTime,
  fixtureStageLabel,
  generateCategoryFixtures,
  isByeFixture,
  newId,
  resolveSide,
  resultFor,
  type TournamentContext
} from '../../../utils/tennisTournament';
import { Btn, CommitInput, ConfirmBtn, FieldLabel, Notice, Panel, inputBaseCls, inputCls } from './ui';

const STAGES: FixtureStage[] = ['pool', 'quarterfinal', 'semifinal', 'final'];

/** Generate fixtures per category, lay them on a timetable, and hand-edit any of it. */
export function SchedulePanel({
  t,
  ctx,
  onChange
}: {
  t: TennisTournament;
  ctx: TournamentContext;
  onChange: (next: TennisTournament) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const regenerate = (cats: TournamentCategory[]) => {
    try {
      const ids = new Set(cats.map((c) => c.id));
      const fresh = cats.flatMap((c) => generateCategoryFixtures(c));
      onChange({ ...t, fixtures: [...t.fixtures.filter((f) => !ids.has(f.categoryId)), ...fresh] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate fixtures.');
    }
  };

  const setFixture = (id: string, patch: Partial<TournamentFixture>) =>
    onChange({ ...t, fixtures: t.fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  const drawn = t.categories.filter((c) => c.pools.some((p) => p.entries.length > 0));

  return (
    <div className="space-y-6">
      <Panel
        title="Generate fixtures"
        subtitle="Round robin inside every pool, then knockout rounds fed by pool finishers. Regenerating a category replaces its fixtures (dates/times included)."
        actions={
          drawn.length > 1 ? (
            <ConfirmBtn
              tone="primary"
              onConfirm={() => regenerate(drawn)}
              confirmLabel="Replace all fixtures?"
              disabled={drawn.length === 0}
            >
              Generate all
            </ConfirmBtn>
          ) : null
        }
      >
        {drawn.length === 0 ? (
          <p className="text-sm text-slate-400">Add entries on the Draw tab first.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drawn.map((c) => {
              const existing = t.fixtures.filter((f) => f.categoryId === c.id);
              const withResults = existing.filter((f) => resultFor(ctx, f.id)).length;
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">{categoryLabel(c)}</p>
                    <p className="text-[11px] text-slate-400">
                      {existing.length === 0 ? 'No fixtures' : `${existing.filter((f) => !isByeFixture(f)).length} matches`}
                      {withResults > 0 ? <span className="text-amber-400"> · {withResults} played</span> : null}
                    </p>
                  </div>
                  {existing.length === 0 ? (
                    <Btn small tone="primary" onClick={() => regenerate([c])}>
                      Generate
                    </Btn>
                  ) : (
                    <ConfirmBtn
                      small
                      tone="neutral"
                      onConfirm={() => regenerate([c])}
                      confirmLabel={withResults > 0 ? `Drop ${withResults} results?` : 'Replace?'}
                    >
                      Regenerate
                    </ConfirmBtn>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Panel>

      {t.fixtures.length > 0 ? <AutoSchedulePanel t={t} onChange={onChange} /> : null}

      {t.categories.map((c) => (
        <CategoryFixtures key={c.id} t={t} ctx={ctx} cat={c} onChange={onChange} setFixture={setFixture} />
      ))}
    </div>
  );
}

function AutoSchedulePanel({ t, onChange }: { t: TennisTournament; onChange: (next: TennisTournament) => void }) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('10:00');
  const [slot, setSlot] = useState('30');
  const [courts, setCourts] = useState('1, 2');
  const [scope, setScope] = useState('all');
  const [onlyUnscheduled, setOnlyUnscheduled] = useState(true);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const run = () => {
    const inScope = (f: TournamentFixture) =>
      (scope === 'all' || f.categoryId === scope || f.stage === scope) && (!onlyUnscheduled || !f.date || !f.time);
    try {
      const subset = t.fixtures.filter(inScope);
      const placed = autoSchedule(subset, {
        date,
        startTime,
        endTime,
        slotMinutes: Number(slot),
        courts: courts.split(',')
      });
      const byId = new Map(placed.map((f) => [f.id, f]));
      onChange({ ...t, fixtures: t.fixtures.map((f) => byId.get(f.id) ?? f) });
      setMsg({ tone: 'ok', text: `Scheduled ${placed.filter((f) => !isByeFixture(f)).length} matches.` });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Could not schedule.' });
    }
  };

  return (
    <Panel
      title="Auto-schedule"
      subtitle="Fills the courts slot by slot from the start date, rolling to the next day after the day's end time. Nobody is double-booked, and each knockout round starts after the previous one."
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block">
          <FieldLabel>First day</FieldLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <FieldLabel>Day starts</FieldLabel>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <FieldLabel>Day ends</FieldLabel>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <FieldLabel>Minutes / match</FieldLabel>
          <input type="number" min={5} step={5} value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <FieldLabel>Courts (comma)</FieldLabel>
          <input value={courts} onChange={(e) => setCourts(e.target.value)} className={inputCls} placeholder="1, 2" />
        </label>
        <label className="block">
          <FieldLabel>Which matches</FieldLabel>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputCls}>
            <option value="all">All categories</option>
            <optgroup label="Category">
              {t.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Stage">
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  All {STAGE_LABEL[s]}s
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={onlyUnscheduled}
            onChange={(e) => setOnlyUnscheduled(e.target.checked)}
            className="accent-lime-400"
          />
          Only matches without a date/time
        </label>
        <Btn tone="primary" onClick={run}>
          Auto-schedule
        </Btn>
        {msg ? <span className={`text-xs ${msg.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span> : null}
      </div>
    </Panel>
  );
}

function sideKey(s: FixtureSide): string {
  return s.kind === 'entry' ? `entry:${s.entryId}` : 'auto';
}

function CategoryFixtures({
  t,
  ctx,
  cat,
  onChange,
  setFixture
}: {
  t: TennisTournament;
  ctx: TournamentContext;
  cat: TournamentCategory;
  onChange: (next: TennisTournament) => void;
  setFixture: (id: string, patch: Partial<TournamentFixture>) => void;
}) {
  const fixtures = useMemo(
    () =>
      t.fixtures
        .filter((f) => f.categoryId === cat.id)
        .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || compareFixtureTime(a, b)),
    [t.fixtures, cat.id]
  );
  const entries = cat.pools.flatMap((p) => p.entries);
  if (fixtures.length === 0) return null;

  /** Pin a knockout side to an entry, or restore the generated placeholder ("auto"). */
  const pinSide = (f: TournamentFixture, which: 'A' | 'B', value: string) => {
    const sideKeyName = which === 'A' ? 'sideA' : 'sideB';
    const autoKeyName = which === 'A' ? 'autoSideA' : 'autoSideB';
    const auto = f[autoKeyName] ?? f[sideKeyName];
    if (value === 'auto') {
      const next: TournamentFixture = { ...f, [sideKeyName]: auto };
      delete next[autoKeyName];
      onChange({ ...t, fixtures: t.fixtures.map((x) => (x.id === f.id ? next : x)) });
      return;
    }
    const entryId = value.replace(/^entry:/, '');
    setFixture(f.id, { [sideKeyName]: { kind: 'entry', entryId }, [autoKeyName]: auto });
  };

  return (
    <Panel
      title={categoryLabel(cat)}
      subtitle={`${fixtures.filter((f) => !isByeFixture(f)).length} matches · ${fixtures.filter((f) => resultFor(ctx, f.id)).length} played`}
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
              <th className="py-2 px-1 w-20">Round</th>
              <th className="py-2 px-1">Side A</th>
              <th className="py-2 px-1">Side B</th>
              <th className="py-2 px-1 w-36">Date</th>
              <th className="py-2 px-1 w-28">Time</th>
              <th className="py-2 px-1 w-20">Court</th>
              <th className="py-2 px-1 w-10" />
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => {
              const result = resultFor(ctx, f.id);
              const bye = isByeFixture(f);
              const sideCell = (which: 'A' | 'B') => {
                const side = which === 'A' ? f.sideA : f.sideB;
                const auto = (which === 'A' ? f.autoSideA : f.autoSideB) ?? side;
                const resolved = resolveSide(ctx, side);
                if (f.stage === 'pool' || bye) {
                  return <span className={bye && side.kind === 'bye' ? 'text-slate-500 italic' : 'text-slate-100'}>{resolved.label}</span>;
                }
                const autoLabel = resolveSide(ctx, auto).label;
                return (
                  <select
                    value={side.kind === 'entry' && (which === 'A' ? f.autoSideA : f.autoSideB) ? sideKey(side) : 'auto'}
                    onChange={(e) => pinSide(f, which, e.target.value)}
                    className={`${inputCls} py-1.5`}
                    aria-label={`${fixtureStageLabel(ctx, f)} side ${which}`}
                  >
                    <option value="auto">Auto: {autoLabel}</option>
                    {entries.map((e) => (
                      <option key={e.id} value={`entry:${e.id}`}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                );
              };
              return (
                <tr key={f.id} className={`border-t border-slate-800 ${result ? 'bg-emerald-950/20' : ''}`}>
                  <td className="py-2 px-1">
                    <span className="text-xs font-black text-lime-300">{fixtureStageLabel(ctx, f)}</span>
                    {result ? <p className="text-[10px] text-emerald-300">{result.result}</p> : null}
                  </td>
                  <td className="py-2 px-1">{sideCell('A')}</td>
                  <td className="py-2 px-1">{sideCell('B')}</td>
                  {bye ? (
                    <td colSpan={3} className="py-2 px-1 text-xs text-slate-500">
                      Walkover — {resolveSide(ctx, f.sideA).isBye ? 'Side B' : 'Side A'} advances
                    </td>
                  ) : (
                    <>
                      <td className="py-2 px-1">
                        <input
                          type="date"
                          value={f.date}
                          onChange={(e) => setFixture(f.id, { date: e.target.value })}
                          className={`${inputCls} py-1.5`}
                          aria-label="Date"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="time"
                          value={f.time}
                          onChange={(e) => setFixture(f.id, { time: e.target.value })}
                          className={`${inputCls} py-1.5`}
                          aria-label="Time"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <CommitInput
                          value={f.court}
                          maxLength={30}
                          onCommit={(v) => setFixture(f.id, { court: v.trim() })}
                          className={`${inputCls} py-1.5`}
                          aria-label="Court"
                        />
                      </td>
                    </>
                  )}
                  <td className="py-2 px-1 text-right">
                    <ConfirmBtn
                      small
                      onConfirm={() => onChange({ ...t, fixtures: t.fixtures.filter((x) => x.id !== f.id) })}
                      confirmLabel="Delete?"
                    >
                      <Trash2 className="size-3" aria-label="Delete match" />
                    </ConfirmBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AddMatchRow
        cat={cat}
        onAdd={(f) => onChange({ ...t, fixtures: [...t.fixtures, f] })}
        nextOrder={Math.max(0, ...t.fixtures.map((f) => f.order)) + 1}
      />
    </Panel>
  );
}

/** Manually add an extra match (e.g. a play-off or a rescheduled tie). */
function AddMatchRow({
  cat,
  onAdd,
  nextOrder
}: {
  cat: TournamentCategory;
  onAdd: (f: TournamentFixture) => void;
  nextOrder: number;
}) {
  const entries = cat.pools.flatMap((p) => p.entries.map((e) => ({ e, pool: p })));
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [stage, setStage] = useState<FixtureStage>('pool');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!a || !b || a === b) {
      setError('Pick two different entries.');
      return;
    }
    const poolA = entries.find((x) => x.e.id === a)?.pool;
    const poolB = entries.find((x) => x.e.id === b)?.pool;
    if (stage === 'pool' && poolA?.id !== poolB?.id) {
      setError('A pool match needs two entries from the same pool.');
      return;
    }
    onAdd({
      id: newId(`lt-${cat.id}`),
      categoryId: cat.id,
      stage,
      ...(stage === 'pool' && poolA ? { poolId: poolA.id } : {}),
      sideA: { kind: 'entry', entryId: a },
      sideB: { kind: 'entry', entryId: b },
      date: '',
      time: '',
      court: '',
      order: nextOrder
    });
    setA('');
    setB('');
    setError(null);
  };

  if (entries.length < 2) return null;
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-800 pt-3">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2">Add match</span>
      <select value={stage} onChange={(e) => setStage(e.target.value as FixtureStage)} className={`${inputBaseCls} w-36`} aria-label="Round">
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </select>
      {[
        [a, setA],
        [b, setB]
      ].map(([value, set], i) => (
        <select
          key={i}
          value={value as string}
          onChange={(e) => (set as (v: string) => void)(e.target.value)}
          className={`${inputBaseCls} w-52`}
          aria-label={i === 0 ? 'Side A' : 'Side B'}
        >
          <option value="">{i === 0 ? 'Side A…' : 'Side B…'}</option>
          {entries.map(({ e, pool }) => (
            <option key={e.id} value={e.id}>
              {e.name} ({pool.name})
            </option>
          ))}
        </select>
      ))}
      <Btn small onClick={add}>
        Add
      </Btn>
      {error ? <span className="text-[11px] text-amber-300 pb-2">{error}</span> : null}
    </div>
  );
}
