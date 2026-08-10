import { useEffect, useState } from 'react';
import { ref, onValue, remove, set, get } from 'firebase/database';
import { db, YOUTUBE_LIVE_URL_PATH } from '../firebase';
import { BEST_OF_OPTIONS, INITIAL_MATCH, type CompletedMatch } from '../data/tournamentData';
import {
  applyCompletedMatchEdits,
  completedMatchStorageKey,
  completedMatchToEditInput,
  completedMatchesFromFirebase,
  datetimeLocalToIso,
  isoToDatetimeLocalValue,
  sortCompletedMatches,
  toFirebaseWritable,
  type CompletedMatchEditInput
} from '../utils/completedMatches';
import { exportScores } from '../utils/exportScores';
import type { ScoreExportFormat } from '../utils/exportScores';
import { AdminNav } from '../components/AdminNav';

const emptyEdit = (): CompletedMatchEditInput => ({
  category: '',
  stage: '',
  details: '',
  scheduledDate: '',
  scheduledTime: '',
  teamA: '',
  teamB: '',
  player1: '',
  player2: '',
  score1: 0,
  score2: 0,
  result: '',
  winnerSide: 1,
  isTrump: false,
  bestOf: 1,
  gamesWon1: 0,
  gamesWon2: 0,
  completedAt: new Date().toISOString()
});

/**
 * Admin results management — export, edit, delete, start fresh.
 * Moved off the main /admin schedule page.
 *
 * Concurrency: RTDB onValue listener; edit/save is last-write-wins per fixture.
 * Security: admin UI only (no auth layer in app); validates edits before write.
 * Input: edit form validated via applyCompletedMatchEdits.
 */
export default function AdminResultsPage() {
  const [completedById, setCompletedById] = useState<Record<string, CompletedMatch>>({});
  const [exportError, setExportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [freshStartMessage, setFreshStartMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CompletedMatchEditInput>(emptyEdit);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    const completedRef = ref(db, 'completedMatches');
    const unsub = onValue(completedRef, (snapshot) => {
      setCompletedById(completedMatchesFromFirebase(snapshot.val()));
    });
    return () => unsub();
  }, []);

  const completedRows = sortCompletedMatches(Object.values(completedById));

  const handleExportScores = async (format: ScoreExportFormat) => {
    setExportError(null);
    if (completedRows.length === 0) {
      setExportError('No completed matches to export yet.');
      return;
    }
    try {
      await exportScores(completedRows, format);
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleOpenEdit = (fixtureId: unknown) => {
    if (typeof fixtureId !== 'string' || !fixtureId.trim()) {
      setSaveError('Cannot edit: missing match id.');
      return;
    }
    const id = fixtureId.trim();
    const row = completedById[id];
    if (!row) {
      setSaveError('That completed match is no longer in the list.');
      return;
    }
    try {
      setEditDraft(completedMatchToEditInput(row));
      setEditingId(id);
      setEditError(null);
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not open editor.');
    }
  };

  const handleCloseEdit = () => {
    if (isSavingEdit) return;
    setEditingId(null);
    setEditError(null);
    setEditDraft(emptyEdit());
  };

  const patchEdit = <K extends keyof CompletedMatchEditInput>(
    key: K,
    value: CompletedMatchEditInput[K]
  ) => {
    setEditDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const existing = completedById[editingId];
    if (!existing) {
      setEditError('That completed match is no longer in the list.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      const updated = applyCompletedMatchEdits(existing, editDraft);
      const storageKey = completedMatchStorageKey(updated.fixtureId);
      await set(ref(db, `completedMatches/${storageKey}`), toFirebaseWritable(updated));
      setEditingId(null);
      setEditDraft(emptyEdit());
      setSaveError(null);
    } catch (err) {
      console.error('Failed to save completed match edit:', err);
      setEditError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteCompletedMatch = async (fixtureId: unknown) => {
    if (typeof fixtureId !== 'string' || !fixtureId.trim()) {
      setSaveError('Cannot delete: missing match id.');
      return;
    }
    const id = fixtureId.trim();
    if (!completedById[id]) {
      setSaveError('That completed match is no longer in the list.');
      return;
    }

    const row = completedById[id];
    const label = row?.details || row?.result || id;
    const ok = window.confirm(`Delete completed match?\n\n${label}\n\nThis cannot be undone.`);
    if (!ok) return;

    setSaveError(null);
    try {
      const storageKey = completedMatchStorageKey(id);
      await remove(ref(db, `completedMatches/${storageKey}`));
    } catch (err) {
      console.error('Failed to delete completed match:', err);
      setSaveError('Failed to delete completed match. Check connection and try again.');
    }
  };

  const handleConfirmFreshStart = async () => {
    setIsResettingAll(true);
    setFreshStartMessage(null);
    setSaveError(null);
    setExportError(null);
    try {
      let youtubeLiveUrl = '';
      const ytSnap = await get(ref(db, YOUTUBE_LIVE_URL_PATH));
      const ytVal = ytSnap.val();
      if (typeof ytVal === 'string') youtubeLiveUrl = ytVal;

      await remove(ref(db, 'completedMatches'));
      const resetMatch = { ...INITIAL_MATCH, youtubeLiveUrl };
      await set(ref(db, 'currentMatch'), resetMatch);
      setCompletedById({});
      setShowFreshStartConfirm(false);
      setFreshStartMessage('All completed matches cleared. Live scores reset.');
    } catch (err) {
      console.error('Failed to reset tournament data:', err);
      setFreshStartMessage('Failed to reset. Check connection and try again.');
    } finally {
      setIsResettingAll(false);
    }
  };

  const fieldClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:opacity-50';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">
      <AdminNav subtitle="Results" />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-indigo-300">Completed Matches</h1>
            <span className="text-xs text-slate-400 font-mono">{completedRows.length} recorded</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { format: 'csv' as const, label: 'CSV' },
                { format: 'excel' as const, label: 'Excel' },
                { format: 'json' as const, label: 'JSON' },
                { format: 'pdf' as const, label: 'PDF' }
              ] as const
            ).map(({ format, label }) => (
              <button
                key={format}
                type="button"
                onClick={() => void handleExportScores(format)}
                disabled={completedRows.length === 0}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Export {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFreshStartMessage(null);
                setShowFreshStartConfirm(true);
              }}
              disabled={isResettingAll}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-950/60 text-red-200 border border-red-500/40 hover:bg-red-900/70 hover:text-white disabled:opacity-50 transition-colors"
            >
              Start Fresh…
            </button>
          </div>
        </div>

        {exportError && <p className="text-[11px] text-red-400">{exportError}</p>}
        {saveError && (
          <p className="text-[11px] text-red-400" role="alert">
            {saveError}
          </p>
        )}
        {freshStartMessage && (
          <p
            className={`text-[11px] ${
              freshStartMessage.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {freshStartMessage}
          </p>
        )}

        {completedRows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No finished matches yet. After a game ends on the score desk, use{' '}
            <strong className="text-emerald-400">Save &amp; Share</strong>.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Completed</th>
                  <th className="px-3 py-2.5 font-semibold">Scheduled</th>
                  <th className="px-3 py-2.5 font-semibold">Category</th>
                  <th className="px-3 py-2.5 font-semibold">Match</th>
                  <th className="px-3 py-2.5 font-semibold">Result</th>
                  <th className="px-3 py-2.5 font-semibold">Winner</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedRows.map((row) => (
                  <tr key={row.fixtureId} className="border-t border-slate-800/80 hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 text-slate-200 whitespace-nowrap font-mono text-xs">
                      {row.completedDate} {row.completedTime}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {row.scheduledDate} {row.scheduledTime}
                    </td>
                    <td className="px-3 py-2.5 text-indigo-300 text-xs">{row.category}</td>
                    <td className="px-3 py-2.5 text-slate-100 text-xs max-w-[220px]">
                      <span className="line-clamp-2">{row.details}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-300 whitespace-nowrap">
                      {row.result}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-400 text-xs font-semibold">
                      {row.winnerName}
                      {row.isTrump ? <span className="ml-1 text-amber-400">★</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      {typeof row.snapshotUrl === 'string' &&
                      row.snapshotUrl.startsWith('https://') ? (
                        <a
                          href={row.snapshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/70"
                        >
                          Photo
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(row.fixtureId)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-950/50 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-900/70 hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCompletedMatch(row.fixtureId)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-950/50 text-red-300 border border-red-500/40 hover:bg-red-900/70 hover:text-white transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-result-title"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-2xl p-5 space-y-4">
            <div className="space-y-1 border-b border-slate-800 pb-3">
              <h2 id="edit-result-title" className="text-lg font-bold text-indigo-300">
                Edit result
              </h2>
              <p className="text-xs text-slate-500 font-mono">{editingId}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="sm:col-span-2">
                <span className={labelClass}>Match details</span>
                <input
                  className={fieldClass}
                  value={editDraft.details}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('details', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Category</span>
                <input
                  className={fieldClass}
                  value={editDraft.category}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('category', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Stage</span>
                <input
                  className={fieldClass}
                  value={editDraft.stage}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('stage', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Scheduled date</span>
                <input
                  className={fieldClass}
                  value={editDraft.scheduledDate}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('scheduledDate', e.target.value)}
                  placeholder="e.g. 31-Jul-26"
                />
              </label>
              <label>
                <span className={labelClass}>Scheduled time</span>
                <input
                  className={fieldClass}
                  value={editDraft.scheduledTime}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('scheduledTime', e.target.value)}
                  placeholder="e.g. 14:30"
                />
              </label>
              <label>
                <span className={labelClass}>Team A</span>
                <input
                  className={fieldClass}
                  value={editDraft.teamA}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('teamA', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Team B</span>
                <input
                  className={fieldClass}
                  value={editDraft.teamB}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('teamB', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Player / side A</span>
                <input
                  className={fieldClass}
                  value={editDraft.player1}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('player1', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Player / side B</span>
                <input
                  className={fieldClass}
                  value={editDraft.player2}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('player2', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Score 1</span>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={editDraft.score1}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('score1', Number(e.target.value))}
                />
              </label>
              <label>
                <span className={labelClass}>Score 2</span>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={editDraft.score2}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('score2', Number(e.target.value))}
                />
              </label>
              <label>
                <span className={labelClass}>Result (shown publicly)</span>
                <input
                  className={fieldClass}
                  value={editDraft.result}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('result', e.target.value)}
                  placeholder="e.g. 21-18 or 2-1 (21-19, 18-21, 21-15)"
                />
              </label>
              <label>
                <span className={labelClass}>Winner</span>
                <select
                  className={fieldClass}
                  value={editDraft.winnerSide}
                  disabled={isSavingEdit}
                  onChange={(e) =>
                    patchEdit('winnerSide', Number(e.target.value) === 2 ? 2 : 1)
                  }
                >
                  <option value={1}>
                    Side A{editDraft.player1 ? ` — ${editDraft.player1}` : ''}
                  </option>
                  <option value={2}>
                    Side B{editDraft.player2 ? ` — ${editDraft.player2}` : ''}
                  </option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Best of</span>
                <select
                  className={fieldClass}
                  value={editDraft.bestOf}
                  disabled={isSavingEdit}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patchEdit('bestOf', n === 3 ? 3 : 1);
                  }}
                >
                  {BEST_OF_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      Best of {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Games won (A)</span>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={editDraft.gamesWon1}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('gamesWon1', Number(e.target.value))}
                />
              </label>
              <label>
                <span className={labelClass}>Games won (B)</span>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={editDraft.gamesWon2}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('gamesWon2', Number(e.target.value))}
                />
              </label>
              <label>
                <span className={labelClass}>Completed at</span>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={isoToDatetimeLocalValue(editDraft.completedAt)}
                  disabled={isSavingEdit}
                  onChange={(e) => {
                    try {
                      patchEdit('completedAt', datetimeLocalToIso(e.target.value));
                      setEditError(null);
                    } catch (err) {
                      setEditError(
                        err instanceof Error ? err.message : 'Invalid completed time.'
                      );
                    }
                  }}
                />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-600"
                  checked={editDraft.isTrump}
                  disabled={isSavingEdit}
                  onChange={(e) => patchEdit('isTrump', e.target.checked)}
                />
                <span className="text-sm text-slate-300">Trump match ★</span>
              </label>
            </div>

            {editError ? (
              <p className="text-[11px] text-red-400" role="alert">
                {editError}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSavingEdit}
                className="rounded-xl bg-slate-800 text-slate-200 font-bold text-sm py-3.5 border border-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isSavingEdit}
                className="rounded-xl bg-indigo-600 text-white font-bold text-sm py-3.5 disabled:opacity-50 hover:bg-indigo-500"
              >
                {isSavingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFreshStartConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fresh-start-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-red-500/40 shadow-2xl p-5 space-y-4">
            <div className="space-y-2 text-center">
              <h2 id="fresh-start-title" className="text-xl font-black text-red-400">
                Start fresh?
              </h2>
              <p className="text-sm text-slate-300">
                This will permanently delete <strong className="text-white">all completed matches</strong>{' '}
                and reset the live scoreboard.
              </p>
              <p className="text-xs text-slate-500">Team rosters are kept. This cannot be undone.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowFreshStartConfirm(false)}
                disabled={isResettingAll}
                className="rounded-xl bg-slate-800 text-slate-200 font-bold text-sm py-3.5 border border-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmFreshStart()}
                disabled={isResettingAll}
                className="rounded-xl bg-red-600 text-white font-bold text-sm py-3.5 disabled:opacity-50 hover:bg-red-500"
              >
                {isResettingAll ? 'Clearing…' : 'Yes, clear everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
