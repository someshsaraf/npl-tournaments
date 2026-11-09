import { useEffect, useMemo, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { onValue, ref, remove, update } from '../../lib/realtime';
import { db } from '../../db';
import {
  categoryFor,
  closesLabel,
  describeSelection,
  formatsOf,
  groupsOf,
  registrationCategories,
  registrationOpen,
  registrationsPath,
  type Registration,
  type RegistrationConfig,
  type RegistrationKey
} from '../../data/registration';
import { useRegistrations } from '../../hooks/useRegistrations';
import { RegistrationDatesPanel } from './RegistrationDatesPanel';
import { Btn, Chip, ConfirmBtn, Notice, Panel, inputBaseCls } from './ui';
import { SPORT_CARDS } from '../../data/sports';

type Row = Registration & { id: string };

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Who has registered (admins only — residents can't read this data). Change
 * a person's category, remove them, copy a category's names straight into
 * the Draw tab's Quick draw, or download everything as CSV.
 */
export function RegistrationsPanel({ sport }: { sport: RegistrationKey }) {
  const regs = useRegistrations();
  const config = regs.all[sport];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsub = onValue(
      ref(db, registrationsPath(sport)),
      (snap) => {
        const raw = (snap.val() ?? {}) as Record<string, Partial<Registration> & { category?: string }>;
        const list: Row[] = Object.entries(raw)
          .filter(([, r]) => typeof r?.name === 'string')
          .map(([id, r]) => ({ id, name: r.name!, categories: registrationCategories(r), createdAt: r.createdAt ?? '' }));
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRows(list);
      },
      (err) => setMsg({ tone: 'error', text: err.message })
    );
    return () => unsub();
  }, [sport]);

  const groupOf = useMemo(() => new Map(config?.categories.map((c) => [c.id, c.group]) ?? []), [config]);
  if (!config) return <Panel title="Registrations"><p className="text-sm text-slate-400">Registration isn't set up for this sport.</p></Panel>;

  const all = rows ?? [];
  const shown = filter === 'all' ? all : all.filter((r) => r.categories.includes(filter));
  const count = (id: string) => all.filter((r) => r.categories.includes(id)).length;
  const path = registrationsPath(sport);
  /** Save a new age group / events choice (and drop the old single-category field). */
  const saveChoice = (r: Row, group: string, formats: string[]) => {
    const categories = formats.map((f) => categoryFor(config, group, f)?.id).filter((x): x is string => !!x);
    if (categories.length === 0) {
      setMsg({ tone: 'error', text: `${r.name} needs at least one event — remove the registration instead.` });
      return;
    }
    update(ref(db, `${path}/${r.id}`), { categories, category: null }).catch(fail);
  };
  const fail = (err: unknown) => setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed.' });

  const copyNames = async (catId: string) => {
    const names = all.filter((r) => r.categories.includes(catId)).map((r) => r.name).reverse(); // oldest first
    try {
      await navigator.clipboard.writeText(names.join('\n'));
      setMsg({ tone: 'ok', text: `Copied ${names.length} name${names.length === 1 ? '' : 's'} — paste into Teams & Draw → Quick draw (pair doubles players as “A & B”).` });
    } catch {
      setMsg({ tone: 'error', text: 'Copy failed — select the names in the list instead.' });
    }
  };

  const downloadCsv = () => {
    const formats = formatsOf(config);
    const lines = [['Name', 'Age group', ...formats, 'Registered at'].join(',')];
    for (const r of [...all].reverse()) {
      const group = groupOf.get(r.categories[0] ?? '') ?? '';
      const ticks = formats.map((f) => (r.categories.includes(categoryFor(config, group, f)?.id ?? '') ? 'Yes' : ''));
      lines.push([r.name, group, ...ticks, r.createdAt].map(csvCell).join(','));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sport}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {regs.loading ? null : <RegistrationDatesPanel sport={sport} config={config} customised={!!regs.custom[sport]} />}
      <Panel
        title={`Registrations — ${all.length}`}
        subtitle={config.hidden ? `${config.title} · ${config.dates}. Hidden from residents — no new sign-ups. Visible to admins only.` : `${config.title} · ${config.dates}. ${registrationOpen(config) ? `Open until ${closesLabel(config)}` : `Closed on ${closesLabel(config)} — you can still add late entries from the form while signed in as staff`}. Visible to admins only. Residents register from the Register button on the ${SPORT_CARDS.find((c) => c.slug === sport || c.sport === sport)?.label ?? ''} page.`}
        actions={
          <>
            <Btn small onClick={downloadCsv} disabled={all.length === 0}>
              <Download className="size-3" aria-hidden /> CSV
            </Btn>
            <ConfirmBtn
              small
              disabled={all.length === 0}
              onConfirm={() => remove(ref(db, path)).then(() => setMsg({ tone: 'ok', text: 'All registrations deleted.' })).catch(fail)}
              confirmLabel={`Delete all ${all.length}?`}
            >
              Delete all
            </ConfirmBtn>
          </>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {config.categories.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5">
              <p className="text-2xl font-black text-slate-100 tabular-nums">{count(c.id)}</p>
              <p className="text-[11px] text-slate-400">{c.label}</p>
              <button
                type="button"
                onClick={() => void copyNames(c.id)}
                disabled={count(c.id) === 0}
                className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-lime-300 hover:text-lime-200 disabled:opacity-40"
              >
                <Copy className="size-3" aria-hidden /> Copy names
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            All · {all.length}
          </Chip>
          {config.categories.map((c) => (
            <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.label} · {count(c.id)}
            </Chip>
          ))}
        </div>

        {rows === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations {filter === 'all' ? 'yet' : 'in this category'}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Age group</th>
                  <th className="py-2 pr-3">Events</th>
                  <th className="py-2 pr-3">Registered</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="py-2 pr-3 font-semibold text-slate-100">{r.name}</td>
                    <RowChoice config={config} row={r} onSave={(g, f) => saveChoice(r, g, f)} />
                    <td className="py-2 pr-3 text-[11px] font-mono text-slate-400">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <ConfirmBtn small onConfirm={() => remove(ref(db, `${path}/${r.id}`)).catch(fail)} confirmLabel="Remove?">
                        Remove
                      </ConfirmBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </Panel>
    </div>
  );
}

/** Age group select + event tick boxes for one registration. */
function RowChoice({
  config,
  row,
  onSave
}: {
  config: RegistrationConfig;
  row: Row;
  onSave: (group: string, formats: string[]) => void;
}) {
  const cats = row.categories
    .map((id) => config.categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const group = cats[0]?.group ?? '';
  const chosen = cats.map((c) => c.format);
  return (
    <>
      <td className="py-2 pr-3">
        <select
          value={group}
          onChange={(e) => onSave(e.target.value, chosen)}
          className={`${inputBaseCls} py-1 w-48`}
          aria-label={`Age group for ${row.name}`}
          title={describeSelection(config, row.categories)}
        >
          {group ? null : <option value="">—</option>}
          {groupsOf(config).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <div className="flex gap-3">
          {formatsOf(config).map((f) => (
            <label key={f} className="inline-flex items-center gap-1.5 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={chosen.includes(f)}
                onChange={() => onSave(group, chosen.includes(f) ? chosen.filter((x) => x !== f) : [...chosen, f])}
                className="accent-lime-400"
                aria-label={`${f} for ${row.name}`}
              />
              {f}
            </label>
          ))}
        </div>
      </td>
    </>
  );
}
