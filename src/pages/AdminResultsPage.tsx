import { useEffect, useState } from 'react';
import { ref, onValue, remove, set, get } from 'firebase/database';
import { db, YOUTUBE_LIVE_URL_PATH } from '../firebase';
import { INITIAL_MATCH, type CompletedMatch } from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import { exportScores } from '../utils/exportScores';
import type { ScoreExportFormat } from '../utils/exportScores';
import { AdminNav } from '../components/AdminNav';

/**
 * Admin results management — export, delete, start fresh.
 * Moved off the main /admin schedule page.
 */
export default function AdminResultsPage() {
  const [completedById, setCompletedById] = useState<Record<string, CompletedMatch>>({});
  const [exportError, setExportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [freshStartMessage, setFreshStartMessage] = useState<string | null>(null);

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
      await remove(ref(db, `completedMatches/${id}`));
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
