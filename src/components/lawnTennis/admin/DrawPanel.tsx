import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  ENTRY_SIZE,
  STAGE_LABEL,
  categoryLabel,
  type KnockoutStart,
  type TennisFormat,
  type TennisTournament,
  type TournamentCategory,
  type TournamentEntry,
  type TournamentPool
} from '../../../data/tennisTournament';
import {
  buildEntry,
  distributeIntoPools,
  entryCount,
  newId,
  parseEntryLines,
  poolName,
  resolvedKnockoutStart,
  suggestPoolCount
} from '../../../utils/tennisTournament';
import { Btn, Chip, CommitInput, ConfirmBtn, FieldLabel, Notice, Panel, inputCls } from './ui';

const PASTE_HINT: Record<TennisFormat, string> = {
  singles: 'One player per line\nRahul Mehta\nPriya Nair\n…',
  doubles: 'One pair per line\nRahul & Priya\nAmit / Neha\n…',
  team: 'One team per line — Team name: players\nAces: Rahul, Priya, Amit\nSmashers: Neha, Ravi, Sam, Jo\n…'
};

/** Entries, pools and qualification for each category. */
export function DrawPanel({
  t,
  onChange
}: {
  t: TennisTournament;
  onChange: (next: TennisTournament) => void;
}) {
  const [categoryId, setCategoryId] = useState(t.categories[0]?.id ?? '');
  const cat = t.categories.find((c) => c.id === categoryId) ?? t.categories[0];

  if (!cat) {
    return (
      <Panel title="Draw">
        <p className="text-sm text-slate-400">Pick formats and divisions on the Setup tab first.</p>
      </Panel>
    );
  }

  const setCat = (next: TournamentCategory) =>
    onChange({ ...t, categories: t.categories.map((c) => (c.id === next.id ? next : c)) });

  const fixtureEntryIds = new Set(
    t.fixtures
      .filter((f) => f.categoryId === cat.id)
      .flatMap((f) => [f.sideA, f.sideB])
      .flatMap((s) => (s.kind === 'entry' ? [s.entryId] : []))
  );
  const hasFixtures = t.fixtures.some((f) => f.categoryId === cat.id);
  const allEntryIds = cat.pools.flatMap((p) => p.entries.map((e) => e.id));
  const drawChangedSinceFixtures =
    hasFixtures &&
    (allEntryIds.some((id) => !fixtureEntryIds.has(id)) || [...fixtureEntryIds].some((id) => !allEntryIds.includes(id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {t.categories.map((c) => (
          <Chip key={c.id} active={c.id === cat.id} onClick={() => setCategoryId(c.id)}>
            {categoryLabel(c)} <span className="opacity-60">· {entryCount(c)}</span>
          </Chip>
        ))}
      </div>

      {drawChangedSinceFixtures ? (
        <Notice tone="warn">
          The draw for {categoryLabel(cat)} changed after fixtures were generated. Regenerate its fixtures on the
          Schedule tab so every entry is scheduled.
        </Notice>
      ) : null}

      <QualifyingPanel cat={cat} onChange={setCat} />
      <QuickDrawPanel cat={cat} onChange={setCat} hasEntries={entryCount(cat) > 0} />

      <Panel
        title={`${categoryLabel(cat)} pools`}
        subtitle={`${cat.pools.length} pool${cat.pools.length === 1 ? '' : 's'} · ${entryCount(cat)} ${
          cat.format === 'team' ? 'teams' : cat.format === 'doubles' ? 'pairs' : 'players'
        }. Pools of 3-4 work best.`}
        actions={
          <>
            <Btn
              small
              onClick={() =>
                setCat({ ...cat, pools: [...cat.pools, { id: newId('p'), name: poolName(cat.pools.length), entries: [] }] })
              }
            >
              <Plus className="size-3" aria-hidden /> Add pool
            </Btn>
            <ConfirmBtn
              small
              disabled={cat.pools.length === 0}
              onConfirm={() => {
                onChange({
                  ...t,
                  categories: t.categories.map((c) => (c.id === cat.id ? { ...cat, pools: [] } : c)),
                  fixtures: t.fixtures.filter((f) => f.categoryId !== cat.id)
                });
              }}
              confirmLabel="Clear pools + fixtures?"
            >
              Clear draw
            </ConfirmBtn>
          </>
        }
      >
        {cat.pools.length === 0 ? (
          <p className="text-sm text-slate-500">No pools yet — use Quick draw above, or Add pool.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cat.pools.map((pool) => (
              <PoolCard key={pool.id} cat={cat} pool={pool} onChange={setCat} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function QualifyingPanel({ cat, onChange }: { cat: TournamentCategory; onChange: (c: TournamentCategory) => void }) {
  const start = resolvedKnockoutStart(cat);
  const qualifiers = cat.pools.length * cat.qualifiersPerPool;
  return (
    <Panel title="Qualifying" subtitle="Who advances from the pools, and which knockout round they enter.">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <FieldLabel>Advance per pool</FieldLabel>
          <select
            value={cat.qualifiersPerPool}
            onChange={(e) => onChange({ ...cat, qualifiersPerPool: Number(e.target.value) })}
            className={inputCls}
          >
            <option value={1}>Pool winner only</option>
            <option value={2}>Top 2</option>
            <option value={3}>Top 3</option>
          </select>
        </label>
        <label className="block">
          <FieldLabel>Knockout starts at</FieldLabel>
          <select
            value={cat.knockoutStart}
            onChange={(e) => onChange({ ...cat, knockoutStart: e.target.value as KnockoutStart })}
            className={inputCls}
          >
            <option value="auto">Auto (from qualifier count)</option>
            <option value="quarterfinal">Quarterfinals</option>
            <option value="semifinal">Semifinals</option>
            <option value="final">Final</option>
            <option value="none">No knockout (pool decides)</option>
          </select>
        </label>
        <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-xs text-slate-300 self-end">
          {qualifiers} qualifier{qualifiers === 1 ? '' : 's'} →{' '}
          <span className="font-bold text-lime-300">{start === 'none' ? 'no knockout' : STAGE_LABEL[start]}</span>
          {start !== 'none' && qualifiers > 0 && qualifiers < { quarterfinal: 8, semifinal: 4, final: 2 }[start] ? (
            <span className="text-slate-500"> (top seeds get byes)</span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function QuickDrawPanel({
  cat,
  onChange,
  hasEntries
}: {
  cat: TournamentCategory;
  onChange: (c: TournamentCategory) => void;
  hasEntries: boolean;
}) {
  const [text, setText] = useState('');
  const [poolCountInput, setPoolCountInput] = useState('');
  const [teamCount, setTeamCount] = useState('4');
  const [errors, setErrors] = useState<string[]>([]);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const poolCount = Number(poolCountInput) || suggestPoolCount(lines);

  const draw = () => {
    const { entries, errors: errs } = parseEntryLines(cat.format, text);
    setErrors(errs);
    if (errs.length > 0 || entries.length === 0) return;
    // A single pool can't feed a bracket with its winner alone — default to top 2 → Final.
    onChange({
      ...cat,
      pools: distributeIntoPools(entries, poolCount),
      qualifiersPerPool: poolCount === 1 ? 2 : cat.qualifiersPerPool
    });
    setText('');
  };

  const createTeams = () => {
    const n = Math.max(2, Math.min(32, Math.trunc(Number(teamCount)) || 0));
    const teams: TournamentEntry[] = Array.from({ length: n }, (_, i) => ({
      id: newId('e'),
      name: `Team ${i + 1}`,
      players: []
    }));
    const pools = Number(poolCountInput) || 1;
    onChange({
      ...cat,
      pools: distributeIntoPools(teams, pools),
      qualifiersPerPool: pools === 1 ? 2 : cat.qualifiersPerPool
    });
  };

  return (
    <Panel
      title="Quick draw"
      subtitle="Paste every entry, choose the number of pools, and they're spread evenly in the order pasted (paste seeds first to keep them apart)."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={PASTE_HINT[cat.format]}
          className={`${inputCls} font-mono`}
          aria-label="Entries to draw"
        />
        <div className="space-y-3">
          <label className="block">
            <FieldLabel>Number of pools</FieldLabel>
            <input
              type="number"
              min={1}
              max={26}
              value={poolCountInput}
              placeholder={`${suggestPoolCount(lines)} (suggested)`}
              onChange={(e) => setPoolCountInput(e.target.value)}
              className={inputCls}
            />
          </label>
          <p className="text-[11px] text-slate-500">
            {lines} entr{lines === 1 ? 'y' : 'ies'} → {poolCount} pool{poolCount === 1 ? '' : 's'} of ~
            {Math.ceil(lines / Math.max(1, poolCount)) || 0}
          </p>
          <MaybeConfirm confirm={hasEntries} tone="primary" onRun={draw} disabled={lines === 0} confirmLabel="Replace current pools?">
            Draw pools
          </MaybeConfirm>
        </div>
      </div>
      {cat.format === 'team' ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-800 pt-4">
          <label className="block w-40">
            <FieldLabel>Or: number of teams</FieldLabel>
            <input
              type="number"
              min={2}
              max={32}
              value={teamCount}
              onChange={(e) => setTeamCount(e.target.value)}
              className={inputCls}
            />
          </label>
          <MaybeConfirm confirm={hasEntries} onRun={createTeams} confirmLabel="Replace current teams?">
            Create blank teams
          </MaybeConfirm>
          <p className="text-[11px] text-slate-500 pb-2">Then name each team and add its 3-4 players below.</p>
        </div>
      ) : null}
      {errors.length > 0 ? (
        <Notice tone="error">
          <p className="font-bold mb-1">Fix these lines and draw again:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </Panel>
  );
}

/** Plain button, or a two-step confirm when the action would overwrite something. */
function MaybeConfirm({
  confirm,
  onRun,
  confirmLabel,
  tone = 'neutral',
  disabled,
  children
}: {
  confirm: boolean;
  onRun: () => void;
  confirmLabel: string;
  tone?: 'primary' | 'neutral';
  disabled?: boolean;
  children: ReactNode;
}) {
  return confirm ? (
    <ConfirmBtn onConfirm={onRun} confirmLabel={confirmLabel} tone={tone} disabled={disabled}>
      {children}
    </ConfirmBtn>
  ) : (
    <Btn onClick={onRun} tone={tone} disabled={disabled}>
      {children}
    </Btn>
  );
}

function PoolCard({
  cat,
  pool,
  onChange
}: {
  cat: TournamentCategory;
  pool: TournamentPool;
  onChange: (c: TournamentCategory) => void;
}) {
  const setPool = (next: TournamentPool) =>
    onChange({ ...cat, pools: cat.pools.map((p) => (p.id === pool.id ? next : p)) });

  const moveEntry = (entry: TournamentEntry, toPoolId: string) =>
    onChange({
      ...cat,
      pools: cat.pools.map((p) =>
        p.id === pool.id
          ? { ...p, entries: p.entries.filter((e) => e.id !== entry.id) }
          : p.id === toPoolId
            ? { ...p, entries: [...p.entries, entry] }
            : p
      )
    });

  const size = pool.entries.length;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <CommitInput
          value={pool.name}
          maxLength={40}
          onCommit={(v) => setPool({ ...pool, name: v.trim() || pool.name })}
          className="flex-1 bg-transparent border-b border-slate-700 text-base font-black text-lime-300 focus:outline-none focus:border-lime-400"
          aria-label="Pool name"
        />
        <span className={`text-[10px] font-bold ${size >= 3 && size <= 4 ? 'text-slate-500' : 'text-amber-400'}`}>
          {size} {size === 1 ? 'entry' : 'entries'}
        </span>
        <ConfirmBtn
          small
          onConfirm={() => onChange({ ...cat, pools: cat.pools.filter((p) => p.id !== pool.id) })}
          confirmLabel="Delete?"
        >
          <Trash2 className="size-3" aria-label="Delete pool" />
        </ConfirmBtn>
      </div>
      <ul className="space-y-1.5">
        {pool.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            format={cat.format}
            entry={entry}
            pools={cat.pools}
            currentPoolId={pool.id}
            onSave={(next) => setPool({ ...pool, entries: pool.entries.map((e) => (e.id === entry.id ? next : e)) })}
            onRemove={() => setPool({ ...pool, entries: pool.entries.filter((e) => e.id !== entry.id) })}
            onMove={(toPoolId) => moveEntry(entry, toPoolId)}
          />
        ))}
      </ul>
      <AddEntryForm format={cat.format} onAdd={(entry) => setPool({ ...pool, entries: [...pool.entries, entry] })} />
    </div>
  );
}

function EntryRow({
  format,
  entry,
  pools,
  currentPoolId,
  onSave,
  onRemove,
  onMove
}: {
  format: TennisFormat;
  entry: TournamentEntry;
  pools: TournamentPool[];
  currentPoolId: string;
  onSave: (e: TournamentEntry) => void;
  onRemove: () => void;
  onMove: (poolId: string) => void;
}) {
  const [editing, setEditing] = useState(format === 'team' && entry.players.length === 0);
  if (editing) {
    return (
      <li>
        <EntryForm
          format={format}
          initial={entry}
          submitLabel="Save"
          onSubmit={(next) => {
            onSave({ ...next, id: entry.id });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  const teamShort = format === 'team' && (entry.players.length < 3 || entry.players.length > 4);
  return (
    <li className="group flex items-start gap-2 rounded-lg bg-slate-800/60 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100 truncate">{entry.name}</p>
        {format === 'team' ? (
          <p className={`text-[11px] truncate ${teamShort ? 'text-amber-400' : 'text-slate-400'}`}>
            {entry.players.length > 0 ? entry.players.join(', ') : 'No players yet'}
            {teamShort ? ` · ${entry.players.length}/3-4` : ''}
          </p>
        ) : null}
      </div>
      {pools.length > 1 ? (
        <select
          value=""
          onChange={(e) => e.target.value && onMove(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 px-1 py-1 max-w-[5.5rem]"
          aria-label={`Move ${entry.name} to another pool`}
        >
          <option value="">Move…</option>
          {pools
            .filter((p) => p.id !== currentPoolId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      ) : null}
      <button type="button" onClick={() => setEditing(true)} className="text-slate-400 hover:text-white p-1" aria-label={`Edit ${entry.name}`}>
        <Pencil className="size-3.5" />
      </button>
      <button type="button" onClick={onRemove} className="text-slate-500 hover:text-red-300 p-1" aria-label={`Remove ${entry.name}`}>
        <X className="size-3.5" />
      </button>
    </li>
  );
}

function AddEntryForm({ format, onAdd }: { format: TennisFormat; onAdd: (e: TournamentEntry) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs font-bold text-slate-400 hover:text-lime-300 hover:border-lime-400/50"
      >
        + Add {format === 'team' ? 'team' : format === 'doubles' ? 'pair' : 'player'}
      </button>
    );
  }
  return (
    <EntryForm
      format={format}
      submitLabel="Add"
      keepOpen
      onSubmit={(e) => onAdd(e)}
      onCancel={() => setOpen(false)}
    />
  );
}

/** Player inputs sized to the format: 1 (singles), 2 (doubles), team name + up to 6 players. */
function EntryForm({
  format,
  initial,
  submitLabel,
  keepOpen,
  onSubmit,
  onCancel
}: {
  format: TennisFormat;
  initial?: TournamentEntry;
  submitLabel: string;
  keepOpen?: boolean;
  onSubmit: (e: TournamentEntry) => void;
  onCancel: () => void;
}) {
  const slots = format === 'team' ? Math.max(ENTRY_SIZE.team.max, initial?.players.length ?? 0) : ENTRY_SIZE[format].max;
  const blank = () => Array.from({ length: slots }, (_, i) => initial?.players[i] ?? '');
  const [players, setPlayers] = useState<string[]>(blank);
  const [teamName, setTeamName] = useState(initial?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    try {
      const entry = buildEntry(format, players, teamName);
      onSubmit(entry);
      setError(null);
      if (keepOpen) {
        setPlayers(Array.from({ length: slots }, () => ''));
        setTeamName('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid entry');
    }
  };

  return (
    <div
      className="rounded-lg border border-lime-400/40 bg-slate-900 p-2.5 space-y-2"
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') onCancel();
      }}
    >
      {format === 'team' ? (
        <input
          autoFocus
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name"
          maxLength={60}
          className={inputCls}
        />
      ) : null}
      <div className={`grid gap-2 ${format === 'singles' ? '' : 'grid-cols-2'}`}>
        {players.map((p, i) => (
          <input
            key={i}
            autoFocus={format !== 'team' && i === 0}
            value={p}
            onChange={(e) => setPlayers(players.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={format === 'team' ? `Player ${i + 1}${i >= 3 ? ' (optional)' : ''}` : `Player ${i + 1}`}
            maxLength={60}
            className={inputCls}
          />
        ))}
      </div>
      {format === 'team' && players.length < 6 ? (
        <button
          type="button"
          onClick={() => setPlayers([...players, ''])}
          className="text-[11px] font-bold text-slate-400 hover:text-lime-300"
        >
          + another player
        </button>
      ) : null}
      {error ? <p className="text-[11px] text-amber-300">{error}</p> : null}
      <div className="flex gap-2">
        <Btn tone="primary" small onClick={submit}>
          {submitLabel}
        </Btn>
        <Btn small onClick={onCancel}>
          {keepOpen ? 'Done' : 'Cancel'}
        </Btn>
      </div>
    </div>
  );
}
