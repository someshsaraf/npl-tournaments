import { useEffect, useMemo, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { onValue, ref, remove, set } from '../../lib/realtime';
import { db } from '../../db';
import type { Sport } from '../../data/tournamentData';
import { REGISTRATIONS, registrationsPath, type Registration } from '../../data/registration';
import { Btn, Chip, ConfirmBtn, Notice, Panel, inputBaseCls } from './ui';

type Row = Registration & { id: string };

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Who has registered (admins only — residents can't read this data). Change
 * a person's category, remove them, copy a category's names straight into
 * the Draw tab's Quick draw, or download everything as CSV.
 */
export function RegistrationsPanel({ sport }: { sport: Sport }) {
  const config = REGISTRATIONS[sport];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsub = onValue(
      ref(db, registrationsPath(sport)),
      (snap) => {
        const raw = (snap.val() ?? {}) as Record<string, Partial<Registration>>;
        const list: Row[] = Object.entries(raw)
          .filter(([, r]) => typeof r?.name === 'string')
          .map(([id, r]) => ({ id, name: r.name!, category: r.category ?? '', createdAt: r.createdAt ?? '' }));
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRows(list);
      },
      (err) => setMsg({ tone: 'error', text: err.message })
    );
    return () => unsub();
  }, [sport]);

  const labelOf = useMemo(() => new Map(config?.categories.map((c) => [c.id, c.label]) ?? []), [config]);
  if (!config) return <Panel title="Registrations"><p className="text-sm text-slate-400">Registration isn't set up for this sport.</p></Panel>;

  const all = rows ?? [];
  const shown = filter === 'all' ? all : all.filter((r) => r.category === filter);
  const count = (id: string) => all.filter((r) => r.category === id).length;
  const path = registrationsPath(sport);
  const fail = (err: unknown) => setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed.' });

  const copyNames = async (catId: string) => {
    const names = all.filter((r) => r.category === catId).map((r) => r.name).reverse(); // oldest first
    try {
      await navigator.clipboard.writeText(names.join('\n'));
      setMsg({ tone: 'ok', text: `Copied ${names.length} name${names.length === 1 ? '' : 's'} — paste into Teams & Draw → Quick draw (pair doubles players as “A & B”).` });
    } catch {
      setMsg({ tone: 'error', text: 'Copy failed — select the names in the list instead.' });
    }
  };

  const downloadCsv = () => {
    const lines = ['Name,Category,Registered at'];
    for (const r of [...all].reverse()) lines.push([r.name, labelOf.get(r.category) ?? r.category, r.createdAt].map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sport}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Panel
        title={`Registrations — ${all.length}`}
        subtitle={`${config.title} · ${config.dates}. Visible to admins only. Residents register from the Register button on the ${sport === 'tennis' ? 'Lawn Tennis' : 'Badminton'} page.`}
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
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Registered</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="py-2 pr-3 font-semibold text-slate-100">{r.name}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={r.category}
                        onChange={(e) => set(ref(db, `${path}/${r.id}/category`), e.target.value).catch(fail)}
                        className={`${inputBaseCls} py-1 w-56`}
                        aria-label={`Category for ${r.name}`}
                      >
                        {config.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
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
