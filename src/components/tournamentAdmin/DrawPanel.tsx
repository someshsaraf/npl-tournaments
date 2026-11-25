import { useState } from 'react';
import { Pencil, Users, X } from 'lucide-react';
import {
  ENTRY_SIZE,
  categoryLabel,
  type TournamentFormat,
  type Tournament,
  type TournamentCategory,
  type TournamentEntry,
  type TournamentPool
} from '../../data/tournament';
import { buildEntry, newId, resolvedKnockoutStart } from '../../utils/tournament';
import { Btn, ConfirmBtn, Notice, Panel, inputCls } from './ui';

/** buildEntry's hard cap on team size. */
const TEAM_HARD_MAX = 8;

const NOUN: Record<TournamentFormat, [string, string]> = {
  singles: ['player', 'players'],
  doubles: ['pair', 'pairs'],
  team: ['team', 'teams']
};

const countLabel = (format: TournamentFormat, n: number) => `${n} ${NOUN[format][n === 1 ? 0 : 1]}`;

/** Every entry in a category, whatever pools it was split into. */
const entriesOf = (cat: TournamentCategory) => cat.pools.filter((p) => !p.listOnly).flatMap((p) => p.entries);

type Finish = 'none' | 'final' | 'semifinal';
const FINISH: Record<Finish, { label: string; qualifiers: number }> = {
  none: { label: 'Round robin decides — top of the table wins', qualifiers: 1 },
  final: { label: 'Top 2 play a final', qualifiers: 2 },
  semifinal: { label: 'Top 4 play semifinals, then a final', qualifiers: 4 }
};

/**
 * Who plays in each category. Every category is one round robin (everyone
 * plays everyone), stored as a single pool so fixtures and tables work as
 * before; the Team Championship's teams are added after the chit draw.
 */
export function DrawPanel({
  t,
  onChange
}: {
  t: Tournament;
  onChange: (next: Tournament) => void;
}) {
  const [categoryId, setCategoryId] = useState(t.categories[0]?.id ?? '');
  const cat = t.categories.find((c) => c.id === categoryId) ?? t.categories[0];

  if (!cat) {
    return (
      <Panel title="Teams & Draw">
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
      <Panel title="Players by category" subtitle="Every category is a round robin — everyone plays everyone. Click a category to edit it.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {t.categories.map((c) => (
            <CategoryCard key={c.id} cat={c} active={c.id === cat.id} onSelect={() => setCategoryId(c.id)} />
          ))}
        </div>
      </Panel>

      {drawChangedSinceFixtures ? (
        <Notice tone="warn">
          The players in {categoryLabel(cat)} changed after fixtures were generated. Regenerate its fixtures on the
          Schedule tab so everyone is scheduled.
        </Notice>
      ) : null}

      <RoundRobinEditor
        cat={cat}
        onChange={setCat}
        onCombine={(next) =>
          onChange({
            ...t,
            categories: t.categories.map((c) => (c.id === next.id ? next : c)),
            fixtures: t.fixtures.filter((f) => f.categoryId !== next.id)
          })
        }
      />
    </div>
  );
}

/** Overview card: a category and the names in it. */
function CategoryCard({ cat, active, onSelect }: { cat: TournamentCategory; active: boolean; onSelect: () => void }) {
  const entries = entriesOf(cat);
  const pendingTeams = cat.format === 'team' && entries.length === 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`text-left rounded-xl border p-3 space-y-2 transition-colors ${
        active ? 'border-lime-400 bg-slate-800/80' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-black text-lime-300">{categoryLabel(cat)}</p>
        <span className="text-[10px] font-bold text-slate-500 shrink-0">{countLabel(cat.format, entries.length)}</span>
      </div>
      {pendingTeams ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-amber-300">
          <Users className="size-3.5" aria-hidden /> Teams by chit draw — pending
        </p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-500">No {NOUN[cat.format][1]} yet</p>
      ) : (
        <ul className="space-y-0.5">
          {entries.map((e) => (
            <li key={e.id} className="text-sm text-slate-200 leading-snug">
              {e.name}
              {cat.format === 'team' && e.players.length ? (
                <span className="block text-[11px] text-slate-400">{e.players.join(', ')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

/** Add, edit and remove a category's entries, and choose how it finishes. */
function RoundRobinEditor({
  cat,
  onChange,
  onCombine
}: {
  cat: TournamentCategory;
  onChange: (c: TournamentCategory) => void;
  onCombine: (c: TournamentCategory) => void;
}) {
  const label = categoryLabel(cat);
  const realPools = cat.pools.filter((p) => !p.listOnly);
  const entries = entriesOf(cat);
  const n = entries.length;
  const matches = (n * (n - 1)) / 2;

  // Single round-robin group; reuse the existing one so fixture links survive.
  const group: TournamentPool = realPools[0] ?? { id: newId('p'), name: 'Round robin', entries: [] };
  const setEntries = (next: TournamentEntry[]) =>
    onChange({ ...cat, pools: [{ ...group, name: 'Round robin', entries: next }, ...cat.pools.filter((p) => p.listOnly)] });

  const start = resolvedKnockoutStart(cat);
  const finish: Finish = start === 'final' ? 'final' : start === 'none' ? 'none' : 'semifinal';
  const setFinish = (f: Finish) => onChange({ ...cat, qualifiersPerPool: FINISH[f].qualifiers, knockoutStart: f });

  return (
    <Panel
      title={label}
      subtitle={`Round robin · ${countLabel(cat.format, n)}${n >= 2 ? ` · ${matches} match${matches === 1 ? '' : 'es'}` : ''}`}
    >
      {realPools.length > 1 ? (
        <Notice tone="warn">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto">
              {label} is still split into {realPools.length} pools. Combine them into one round robin (its fixtures are
              cleared — regenerate them on the Schedule tab).
            </span>
            <ConfirmBtn
              small
              tone="primary"
              onConfirm={() =>
                onCombine({ ...cat, pools: [{ ...realPools[0], name: 'Round robin', entries }, ...cat.pools.filter((p) => p.listOnly)] })
              }
              confirmLabel="Combine + clear fixtures?"
            >
              Combine into one round robin
            </ConfirmBtn>
          </div>
        </Notice>
      ) : null}

      {cat.format === 'team' && n === 0 ? (
        <Notice tone="warn">
          Teams will be formed by chit draw. After the draw, add each team here with its name and players.
        </Notice>
      ) : null}

      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            format={cat.format}
            entry={entry}
            onSave={(next) => setEntries(entries.map((e) => (e.id === entry.id ? next : e)))}
            onRemove={() => setEntries(entries.filter((e) => e.id !== entry.id))}
          />
        ))}
      </ul>
      <AddEntryForm format={cat.format} onAdd={(entry) => setEntries([...entries, entry])} />

      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300 border-t border-slate-800 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">After the round robin</span>
        <select value={finish} onChange={(e) => setFinish(e.target.value as Finish)} className={`${inputCls} sm:w-auto`}>
          {(Object.keys(FINISH) as Finish[]).map((f) => (
            <option key={f} value={f} disabled={f !== 'none' && n > 0 && n < FINISH[f].qualifiers}>
              {FINISH[f].label}
            </option>
          ))}
        </select>
      </label>
    </Panel>
  );
}

function EntryRow({
  format,
  entry,
  onSave,
  onRemove
}: {
  format: TournamentFormat;
  entry: TournamentEntry;
  onSave: (e: TournamentEntry) => void;
  onRemove: () => void;
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
  const { min, max } = ENTRY_SIZE.team;
  const teamShort = format === 'team' && (entry.players.length < min || entry.players.length > max);
  return (
    <li className="group flex items-start gap-2 rounded-lg bg-slate-800/60 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100 truncate">{entry.name}</p>
        {format === 'team' ? (
          <p className={`text-[11px] truncate ${teamShort ? 'text-amber-400' : 'text-slate-400'}`}>
            {entry.players.length > 0 ? entry.players.join(', ') : 'No players yet'}
            {teamShort ? ` · ${entry.players.length}/${min}-${max}` : ''}
          </p>
        ) : null}
      </div>
      <button type="button" onClick={() => setEditing(true)} className="text-slate-400 hover:text-white p-1" aria-label={`Edit ${entry.name}`}>
        <Pencil className="size-3.5" />
      </button>
      <button type="button" onClick={onRemove} className="text-slate-500 hover:text-red-300 p-1" aria-label={`Remove ${entry.name}`}>
        <X className="size-3.5" />
      </button>
    </li>
  );
}

function AddEntryForm({ format, onAdd }: { format: TournamentFormat; onAdd: (e: TournamentEntry) => void }) {
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
  format: TournamentFormat;
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
            placeholder={format === 'team' ? `Player ${i + 1}${i >= ENTRY_SIZE.team.min ? ' (optional)' : ''}` : `Player ${i + 1}`}
            maxLength={60}
            className={inputCls}
          />
        ))}
      </div>
      {format === 'team' && players.length < TEAM_HARD_MAX ? (
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
