import { useEffect, useState } from 'react';
import { ref, onValue, remove, set, get } from 'firebase/database';
import { db, YOUTUBE_LIVE_URL_PATH } from '../firebase';
import { INITIAL_MATCH, type CompletedMatch } from '../data/tournamentData';
import {
  completedMatchStorageKey,
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import { exportScores } from '../utils/exportScores';
import type { ScoreExportFormat } from '../utils/exportScores';
import { AdminShell } from '../components/AdminShell';

/**
 * Admin results management — export, delete, start fresh.
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

  return (
    <AdminShell subtitle="Results">
      <section className="admin-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-[var(--admin-line)] pb-3">
          <div className="flex items-center gap-3">
            <h1 className="admin-display text-xl text-[var(--admin-lime)]">Completed Matches</h1>
            <span className="text-xs text-[var(--admin-muted)] font-mono">
              {completedRows.length} recorded
            </span>
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
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-black/25 text-[var(--admin-ink)] border border-[var(--admin-line)] hover:bg-black/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[var(--admin-clay)]/15 text-[var(--admin-clay)] border border-[var(--admin-clay)]/40 hover:bg-[var(--admin-clay)]/25 disabled:opacity-50 transition-colors"
            >
              Start Fresh…
            </button>
          </div>
        </div>

        {exportError && <p className="text-[11px] text-[var(--admin-clay)]">{exportError}</p>}
        {saveError && (
          <p className="text-[11px] text-[var(--admin-clay)]" role="alert">
            {saveError}
          </p>
        )}
        {freshStartMessage && (
          <p
            className={`text-[11px] ${
              freshStartMessage.startsWith('Failed')
                ? 'text-[var(--admin-clay)]'
                : 'text-[var(--admin-teal)]'
            }`}
          >
            {freshStartMessage}
          </p>
        )}

        {completedRows.length === 0 ? (
          <p className="text-sm text-[var(--admin-muted)] text-center py-8">
            No finished matches yet. Results auto-save when a series ends on the score desk.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto rounded-xl border border-[var(--admin-line)]">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-[var(--admin-bg)] text-[11px] uppercase tracking-wider text-[var(--admin-muted)]">
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
                  <tr
                    key={row.fixtureId}
                    className="border-t border-[var(--admin-line)] hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2.5 text-[var(--admin-ink)] whitespace-nowrap font-mono text-xs">
                      {row.completedDate} {row.completedTime}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--admin-muted)] whitespace-nowrap font-mono text-xs">
                      {row.scheduledDate} {row.scheduledTime}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--admin-teal)] text-xs">{row.category}</td>
                    <td className="px-3 py-2.5 text-[var(--admin-ink)] text-xs max-w-[220px]">
                      <span className="line-clamp-2">{row.details}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[var(--admin-lime)] whitespace-nowrap">
                      {row.result}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--admin-teal)] text-xs font-semibold">
                      {row.winnerName}
                      {row.isTrump ? (
                        <span className="ml-1 text-[var(--admin-clay)]">★</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      {typeof row.snapshotUrl === 'string' &&
                      row.snapshotUrl.startsWith('https://') ? (
                        <a
                          href={row.snapshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[var(--admin-teal)]/15 text-[var(--admin-teal)] border border-[var(--admin-teal)]/40 hover:bg-[var(--admin-teal)]/25"
                        >
                          Photo
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleDeleteCompletedMatch(row.fixtureId)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[var(--admin-clay)]/15 text-[var(--admin-clay)] border border-[var(--admin-clay)]/40 hover:bg-[var(--admin-clay)]/25 transition-colors"
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
      </section>

      {showFreshStartConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fresh-start-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--admin-panel)] border border-[var(--admin-clay)]/40 shadow-2xl p-5 space-y-4">
            <div className="space-y-2 text-center">
              <h2 id="fresh-start-title" className="text-xl font-black text-[var(--admin-clay)]">
                Start fresh?
              </h2>
              <p className="text-sm text-[var(--admin-ink)]">
                This will permanently delete{' '}
                <strong className="text-white">all completed matches</strong> and reset the live
                scoreboard.
              </p>
              <p className="text-xs text-[var(--admin-muted)]">
                Team rosters are kept. This cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowFreshStartConfirm(false)}
                disabled={isResettingAll}
                className="rounded-xl bg-black/30 text-[var(--admin-ink)] font-bold text-sm py-3.5 border border-[var(--admin-line)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmFreshStart()}
                disabled={isResettingAll}
                className="rounded-xl bg-[var(--admin-clay)] text-white font-bold text-sm py-3.5 disabled:opacity-50 hover:brightness-110"
              >
                {isResettingAll ? 'Clearing…' : 'Yes, clear everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
