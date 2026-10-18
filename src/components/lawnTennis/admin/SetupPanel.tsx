import { useState } from 'react';
import type { TennisRules } from '../../../data/tournamentData';
import {
  DIVISION_LABEL,
  FORMAT_LABEL,
  TENNIS_DIVISIONS,
  TENNIS_FORMATS,
  categoryLabel,
  type StageRules,
  type TennisTournament
} from '../../../data/tennisTournament';
import { describeTennisRules } from '../../../utils/tennisScoring';
import { entryCount, syncCategories } from '../../../utils/tennisTournament';
import { Chip, CommitInput, FieldLabel, Notice, Panel, inputCls } from './ui';

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
  t: TennisTournament;
  onChange: (next: TennisTournament) => void;
}) {
  const [blocked, setBlocked] = useState<string | null>(null);

  /**
   * Toggle a format/division. Deselecting is refused while it would drop a
   * category that still has entries or fixtures — clear its draw first.
   */
  const toggle = <K extends 'formats' | 'divisions'>(key: K, value: TennisTournament[K][number]) => {
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
      <Panel title="Tournament" subtitle="Shown in the Lawn Tennis hero for residents.">
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
        subtitle="Pick the match formats being played, and which divisions play singles/doubles. The Team Championship has no divisions."
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>Formats</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TENNIS_FORMATS.map((f) => (
                <Chip key={f} active={t.formats.includes(f)} onClick={() => toggle('formats', f)}>
                  {FORMAT_LABEL[f]}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Divisions (singles &amp; doubles)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TENNIS_DIVISIONS.map((d) => (
                <Chip key={d} active={t.divisions.includes(d)} onClick={() => toggle('divisions', d)}>
                  {DIVISION_LABEL[d]}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Resulting categories</FieldLabel>
            {t.categories.length === 0 ? (
              <p className="text-xs text-slate-500">None yet — pick at least one format (and a division for singles/doubles).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {t.categories.map((c) => (
                  <span key={c.id} className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs text-slate-200">
                    {categoryLabel(c)}
                    <span className="ml-1.5 text-slate-500">{entryCount(c)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {blocked ? <Notice tone="warn">{blocked}</Notice> : null}
        </div>
      </Panel>

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
    </div>
  );
}
