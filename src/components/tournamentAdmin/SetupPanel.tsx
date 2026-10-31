import { useState } from 'react';
import { BEST_OF_OPTIONS, MAX_POINTS_OPTIONS, SPORT_LABEL, type TennisRules } from '../../data/tournamentData';
import {
  DIVISION_LABEL,
  FORMAT_LABEL,
  TOURNAMENT_DIVISIONS,
  TOURNAMENT_FORMATS,
  categoryLabel,
  type BadmintonRules,
  type BadmintonStageRules,
  type StageRules,
  type Tournament,
  type TournamentCategory,
  type TournamentFormat
} from '../../data/tournament';
import { describeTennisRules } from '../../utils/tennisScoring';
import { buildCustomCategory, entryCount, syncCategories } from '../../utils/tournament';
import { Btn, Chip, CommitInput, ConfirmBtn, FieldLabel, Notice, Panel, inputBaseCls, inputCls } from './ui';

const STAGE_ROWS: Array<{ key: keyof StageRules; label: string }> = [
  { key: 'pool', label: 'Pool / qualifier' },
  { key: 'quarterfinal', label: 'Quarterfinal' },
  { key: 'semifinal', label: 'Semifinal' },
  { key: 'final', label: 'Final' }
];

/** Tournament basics, which categories exist, and per-stage scoring rules. */
export function SetupPanel({
  t,
  onChange
}: {
  t: Tournament;
  onChange: (next: Tournament) => void;
}) {
  const [blocked, setBlocked] = useState<string | null>(null);

  /**
   * Toggle a format/division. Deselecting is refused while it would drop a
   * category that still has entries or fixtures — clear its draw first.
   */
  const toggle = <K extends 'formats' | 'divisions'>(key: K, value: Tournament[K][number]) => {
    const list = t[key] as string[];
    const nextList = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    const next = { ...t, [key]: nextList };
    const categories = syncCategories(next);
    const dropped = t.categories.filter(
      (c) =>
        !categories.some((n) => n.id === c.id) &&
        (entryCount(c) > 0 || t.fixtures.some((f) => f.categoryId === c.id))
    );
    if (dropped.length > 0) {
      setBlocked(
        `${dropped.map(categoryLabel).join(', ')} still ${dropped.length === 1 ? 'has' : 'have'} entries or fixtures. Clear ${dropped.length === 1 ? 'its' : 'their'} draw on the Draw tab first.`
      );
      return;
    }
    setBlocked(null);
    onChange({ ...next, categories });
  };

  const setRules = (stage: keyof StageRules, patch: Partial<TennisRules>) =>
    onChange({ ...t, rules: { ...t.rules, [stage]: { ...t.rules[stage], ...patch } } });

  return (
    <div className="space-y-6">
      <Panel title="Tournament" subtitle={`Shown at the top of the ${SPORT_LABEL[t.sport]} page for residents.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <FieldLabel>Title</FieldLabel>
            <CommitInput value={t.title} maxLength={80} onCommit={(v) => onChange({ ...t, title: v.trim() || t.title })} />
          </label>
          <label className="block">
            <FieldLabel>Season year</FieldLabel>
            <CommitInput
              type="number"
              value={String(t.year)}
              onCommit={(v) => {
                const y = Math.trunc(Number(v));
                if (y >= 2020 && y <= 2100) onChange({ ...t, year: y });
              }}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Venue</FieldLabel>
            <CommitInput value={t.venue} maxLength={80} onCommit={(v) => onChange({ ...t, venue: v.trim() })} />
          </label>
          <label className="block">
            <FieldLabel>Points per win (pool table)</FieldLabel>
            <select
              value={t.pointsPerWin}
              onChange={(e) => onChange({ ...t, pointsPerWin: Number(e.target.value) })}
              className={inputCls}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <Panel
        title="Categories"
        subtitle="Quick picks: formats × divisions create categories like “Adults Singles”. Add custom categories (e.g. “Men's Singles <35”) below. Rename any category in place."
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>Formats</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TOURNAMENT_FORMATS.map((f) => (
                <Chip key={f} active={t.formats.includes(f)} onClick={() => toggle('formats', f)}>
                  {FORMAT_LABEL[f]}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Divisions (singles &amp; doubles)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TOURNAMENT_DIVISIONS.map((d) => (
                <Chip key={d} active={t.divisions.includes(d)} onClick={() => toggle('divisions', d)}>
                  {DIVISION_LABEL[d]}
                </Chip>
              ))}
            </div>
          </div>
          <CategoryList t={t} onChange={onChange} />
          {blocked ? <Notice tone="warn">{blocked}</Notice> : null}
        </div>
      </Panel>

      {t.sport === 'badminton' ? (
        <BadmintonRulesPanel rules={t.badmintonRules} onChange={(badmintonRules) => onChange({ ...t, badmintonRules })} />
      ) : (
      <Panel
        title="Scoring rules"
        subtitle="Applied when a match is started from the schedule. Golden point = at that deuce, the next point wins the game."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3">Win condition</th>
                <th className="py-2 pr-3">Games</th>
                <th className="py-2 pr-3">Golden point</th>
                <th className="py-2 pr-3">Tiebreak</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {STAGE_ROWS.map(({ key, label }) => {
                const r = t.rules[key];
                return (
                  <tr key={key} className="border-t border-slate-800">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-100">{label}</p>
                      <p className="text-[11px] text-slate-500 max-w-[14rem]">{describeTennisRules(r)}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={r.format}
                        onChange={(e) => setRules(key, { format: e.target.value === 'set' ? 'set' : 'race' })}
                        className={inputCls}
                        aria-label={`${label} win condition`}
                      >
                        <option value="race">First to N games</option>
                        <option value="set">Full set (win by 2)</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={r.gamesTarget}
                        onChange={(e) => setRules(key, { gamesTarget: Number(e.target.value) })}
                        className={inputCls}
                        aria-label={`${label} games`}
                      >
                        {[3, 4, 5, 6, 8].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={r.goldenDeuce ?? 'off'}
                        onChange={(e) =>
                          setRules(key, { goldenDeuce: e.target.value === 'off' ? null : Number(e.target.value) })
                        }
                        className={inputCls}
                        aria-label={`${label} golden point`}
                      >
                        <option value="off">Off (advantage)</option>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            On deuce #{n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300 mt-2">
                        <input
                          type="checkbox"
                          checked={r.tiebreak}
                          disabled={r.format !== 'set'}
                          onChange={(e) => setRules(key, { tiebreak: e.target.checked })}
                          className="accent-lime-400"
                        />
                        at {r.gamesTarget}-{r.gamesTarget}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      )}
    </div>
  );
}

/**
 * Every category with rename / format / delete, plus "add a custom one".
 * Quick-pick categories (formats × divisions) are removed by un-ticking their
 * chips above; custom ones have a Delete button.
 */
function CategoryList({ t, onChange }: { t: Tournament; onChange: (next: Tournament) => void }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('singles');
  const [error, setError] = useState<string | null>(null);

  const setCat = (id: string, patch: Partial<TournamentCategory>) =>
    onChange({ ...t, categories: t.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const add = () => {
    try {
      const cat = buildCustomCategory(name, format);
      if (t.categories.some((c) => categoryLabel(c).toLowerCase() === cat.name!.toLowerCase())) {
        throw new Error('A category with that name already exists.');
      }
      onChange({ ...t, categories: [...t.categories, cat] });
      setName('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the category.');
    }
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Categories</FieldLabel>
      {t.categories.length === 0 ? (
        <p className="text-xs text-slate-500">None yet — use the quick picks above, or add a custom category.</p>
      ) : (
        <ul className="space-y-1.5">
          {t.categories.map((c) => {
            const entries = entryCount(c);
            const fixtures = t.fixtures.filter((f) => f.categoryId === c.id).length;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700 px-2.5 py-1.5">
                <CommitInput
                  value={c.name ?? ''}
                  placeholder={categoryLabel({ ...c, name: undefined })}
                  maxLength={60}
                  onCommit={(v) => setCat(c.id, { name: v.trim() || undefined })}
                  className={`${inputBaseCls} py-1 flex-1 min-w-[12rem]`}
                  aria-label="Category name"
                />
                <select
                  value={c.format}
                  disabled={entries > 0}
                  title={entries > 0 ? 'Clear its entries on the Draw tab to change the format' : undefined}
                  onChange={(e) => setCat(c.id, { format: e.target.value as TournamentFormat })}
                  className={`${inputBaseCls} py-1 w-40 disabled:opacity-50`}
                  aria-label="Category format"
                >
                  {TOURNAMENT_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 w-28">
                  {entries} entr{entries === 1 ? 'y' : 'ies'} · {fixtures} match{fixtures === 1 ? '' : 'es'}
                </span>
                {c.custom ? (
                  <ConfirmBtn
                    small
                    onConfirm={() =>
                      onChange({
                        ...t,
                        categories: t.categories.filter((x) => x.id !== c.id),
                        fixtures: t.fixtures.filter((f) => f.categoryId !== c.id)
                      })
                    }
                    confirmLabel={entries + fixtures > 0 ? 'Delete with its draw?' : 'Delete?'}
                  >
                    Delete
                  </ConfirmBtn>
                ) : (
                  <span className="text-[10px] text-slate-500">quick pick</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          maxLength={60}
          placeholder="Custom category, e.g. Men's Singles <35"
          className={`${inputBaseCls} flex-1 min-w-[14rem]`}
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as TournamentFormat)}
          className={`${inputBaseCls} w-40`}
          aria-label="New category format"
        >
          {TOURNAMENT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
        <Btn onClick={add} disabled={!name.trim()}>
          Add category
        </Btn>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

const BADMINTON_STAGE_ROWS: Array<{ key: keyof BadmintonStageRules; label: string }> = [
  { key: 'pool', label: 'Pool / group' },
  { key: 'quarterfinal', label: 'Quarterfinal' },
  { key: 'semifinal', label: 'Semifinal' },
  { key: 'final', label: 'Final' }
];

/** Badminton: race-to points and best-of games per stage. */
function BadmintonRulesPanel({
  rules,
  onChange
}: {
  rules: BadmintonStageRules;
  onChange: (next: BadmintonStageRules) => void;
}) {
  const set = (stage: keyof BadmintonStageRules, patch: Partial<BadmintonRules>) =>
    onChange({ ...rules, [stage]: { ...rules[stage], ...patch } });
  return (
    <Panel
      title="Scoring rules"
      subtitle="Applied when a match is started from the schedule. Deuce/golden-point caps follow the usual NPL rules (Team Championship plays golden point at the race-to score)."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Race to</th>
              <th className="py-2 pr-3">Games</th>
            </tr>
          </thead>
          <tbody>
            {BADMINTON_STAGE_ROWS.map(({ key, label }) => (
              <tr key={key} className="border-t border-slate-800">
                <td className="py-3 pr-3">
                  <p className="font-bold text-slate-100">{label}</p>
                  <p className="text-[11px] text-slate-500">
                    {rules[key].maxPoints} points · {rules[key].bestOf === 3 ? 'best of 3 games' : 'one game'}
                  </p>
                </td>
                <td className="py-3 pr-3">
                  <div className="flex gap-1.5">
                    {MAX_POINTS_OPTIONS.map((p) => (
                      <Chip key={p} active={rules[key].maxPoints === p} onClick={() => set(key, { maxPoints: p })}>
                        {p}
                      </Chip>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <div className="flex gap-1.5">
                    {BEST_OF_OPTIONS.map((b) => (
                      <Chip key={b} active={rules[key].bestOf === b} onClick={() => set(key, { bestOf: b })}>
                        {b === 3 ? 'Best of 3' : 'Single game'}
                      </Chip>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
