import React, { useState, useEffect, useRef } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { FIXTURES, INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';
import {
  applyDecrementScore,
  applyScorePoint,
  applySetServer,
  applySwapSides
} from '../utils/scoring';
import { buildCompletedMatch } from '../utils/completedMatches';
import { ServeRacket } from '../components/ServeRacket';

/**
 * Full-viewport scoreboard for court / audience.
 * Scores dominate the screen; controls sit in a compact footer strip.
 */
export const ScoreControl: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingSaveMatch, setPendingSaveMatch] = useState<MatchState | null>(null);
  const promptedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  const updateMatchState = (next: MatchState) => {
    setMatch(next);
    set(ref(db, 'currentMatch'), next).catch((err) => {
      console.error('Failed to sync match state to Firebase:', err);
    });
  };

  const winnerPromptKey = (m: MatchState): string =>
    `${m.currentMatchId}:${m.score1}-${m.score2}:w${m.gameWinner}`;

  const openSaveDialog = (finishedMatch: MatchState) => {
    if (!hasMatchWinner(finishedMatch)) return;
    const key = winnerPromptKey(finishedMatch);
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    setPendingSaveMatch(finishedMatch);
    setShowSaveDialog(true);
  };

  const handleScorePoint = (side: 1 | 2) => {
    const next = applyScorePoint(match, side);
    updateMatchState(next);
    if (hasMatchWinner(next)) openSaveDialog(next);
  };

  const handleDecrement = (side: 1 | 2) => {
    promptedKeyRef.current = null;
    setShowSaveDialog(false);
    setPendingSaveMatch(null);
    setSaveMessage(null);
    updateMatchState(applyDecrementScore(match, side));
  };

  const handleSetServer = (side: 1 | 2) => {
    updateMatchState(applySetServer(match, side));
  };

  const handleSwapSides = () => {
    updateMatchState(applySwapSides(match));
  };

  const saveCompletedMatch = async (matchToSave: MatchState) => {
    if (matchToSave.gameWinner !== 1 && matchToSave.gameWinner !== 2) {
      setSaveMessage('Finish the game before saving.');
      return false;
    }
    const fixtureId = matchToSave.currentMatchId?.trim();
    if (!fixtureId) {
      setSaveMessage('Missing fixture id.');
      return false;
    }

    setIsSavingResult(true);
    setSaveMessage(null);
    try {
      const fixture = FIXTURES.find((f) => f.id === fixtureId);
      const completed = buildCompletedMatch(matchToSave, fixture, new Date());
      await set(ref(db, `completedMatches/${fixtureId}`), completed);
      setSaveMessage(`Saved ${completed.result}`);
      setShowSaveDialog(false);
      setPendingSaveMatch(null);
      return true;
    } catch (err) {
      console.error('Failed to save completed match:', err);
      setSaveMessage('Failed to save result.');
      return false;
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleConfirmSave = async () => {
    await saveCompletedMatch(pendingSaveMatch ?? match);
  };

  const handleDismissSaveDialog = () => {
    setShowSaveDialog(false);
    setSaveMessage('Result not saved — use −1 then +1 again to reopen, or save from Admin.');
  };

  const hasWinner = hasMatchWinner(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const dialogMatch =
    pendingSaveMatch && hasMatchWinner(pendingSaveMatch) ? pendingSaveMatch : match;
  const dialogWinnerName =
    dialogMatch.gameWinner === 1
      ? dialogMatch.player1 || dialogMatch.teamA
      : dialogMatch.player2 || dialogMatch.teamB;
  const winnerName =
    match.gameWinner === 1
      ? match.player1 || match.teamA
      : match.player2 || match.teamB;

  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';

  return (
    <div
      className="bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        maxHeight: '100dvh'
      }}
    >
      {/* Compact status strip — one row, full width */}
      <header
        className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 border-b border-slate-800 bg-slate-950"
        style={{
          paddingTop: 'max(0.4rem, env(safe-area-inset-top))',
          paddingBottom: '0.4rem',
          minHeight: '2.75rem'
        }}
      >
        <div className="min-w-0 flex items-baseline gap-2 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider truncate">
            {match.category}
          </span>
          <span className="text-xs sm:text-sm font-black text-white truncate hidden xs:inline sm:inline">
            {match.stage}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          {hasWinner ? (
            <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/50 px-3 py-1 rounded-full whitespace-nowrap">
              WIN {winnerName} · {score1}-{score2}
            </span>
          ) : match.deuceActive ? (
            <span className="text-xs font-black text-red-400 bg-red-500/20 border border-red-500/50 px-3 py-1 rounded-full animate-pulse">
              DEUCE
            </span>
          ) : (
            <span className="text-[10px] sm:text-xs font-mono text-slate-500">
              {match.maxPoints ?? 11} PTS
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSwapSides}
            className="text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600/50 text-indigo-50 border border-indigo-400/40 active:scale-95"
          >
            ↔ Swap
          </button>
        </div>
      </header>

      {/* Score stage — fills all remaining viewport */}
      <main className="flex-1 min-h-0 grid grid-cols-2 relative">
        {/* Left */}
        <section
          className="flex flex-col min-h-0 min-w-0"
          style={{
            background: match.server === 1
              ? 'linear-gradient(180deg, rgba(67,56,202,0.35) 0%, rgba(2,6,23,1) 55%)'
              : 'rgba(2,6,23,1)',
            borderRight: '1px solid rgba(51,65,85,0.6)'
          }}
        >
          <div className="shrink-0 px-3 pt-3 flex items-center justify-between gap-2">
            <p className="text-base sm:text-2xl md:text-3xl font-black text-white truncate leading-none">
              {name1}
            </p>
            <button
              type="button"
              onClick={() => handleSetServer(1)}
              title={match.server === 1 ? 'Serving' : 'Set this side as server'}
              className={`shrink-0 p-1.5 rounded-xl transition-all active:scale-95 ${
                match.server === 1
                  ? 'bg-emerald-500/25 ring-2 ring-emerald-400/70'
                  : 'bg-slate-800/80 border border-slate-700'
              }`}
              aria-pressed={match.server === 1}
            >
              <ServeRacket
                active={match.server === 1}
                size={36}
                title={match.server === 1 ? 'Serving' : 'Set serve'}
              />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-indigo-300"
              style={{ fontSize: 'clamp(4.5rem, min(28vw, 42dvh), 16rem)' }}
            >
              {score1}
            </span>
          </div>
        </section>

        {/* Right */}
        <section
          className="flex flex-col min-h-0 min-w-0"
          style={{
            background: match.server === 2
              ? 'linear-gradient(180deg, rgba(190,24,93,0.35) 0%, rgba(2,6,23,1) 55%)'
              : 'rgba(2,6,23,1)'
          }}
        >
          <div className="shrink-0 px-3 pt-3 flex items-center justify-between gap-2">
            <p className="text-base sm:text-2xl md:text-3xl font-black text-white truncate leading-none">
              {name2}
            </p>
            <button
              type="button"
              onClick={() => handleSetServer(2)}
              title={match.server === 2 ? 'Serving' : 'Set this side as server'}
              className={`shrink-0 p-1.5 rounded-xl transition-all active:scale-95 ${
                match.server === 2
                  ? 'bg-emerald-500/25 ring-2 ring-emerald-400/70'
                  : 'bg-slate-800/80 border border-slate-700'
              }`}
              aria-pressed={match.server === 2}
            >
              <ServeRacket
                active={match.server === 2}
                size={36}
                title={match.server === 2 ? 'Serving' : 'Set serve'}
              />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-rose-300"
              style={{ fontSize: 'clamp(4.5rem, min(28vw, 42dvh), 16rem)' }}
            >
              {score2}
            </span>
          </div>
        </section>

        <div className="pointer-events-none absolute inset-y-[18%] left-1/2 -translate-x-1/2 flex items-center">
          <span className="text-slate-600 font-black tracking-[0.3em] text-xs sm:text-base bg-slate-950/70 px-2 py-1 rounded">
            VS
          </span>
        </div>
      </main>

      {/* Control dock — compact full-width */}
      <footer
        className="shrink-0 grid grid-cols-4 gap-2 px-2 sm:px-4 border-t border-slate-800 bg-slate-950"
        style={{
          paddingTop: '0.5rem',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
        }}
      >
        <button
          type="button"
          onClick={() => handleDecrement(1)}
          className="rounded-xl bg-slate-800 text-white font-black border border-slate-700 active:scale-95"
          style={{ fontSize: 'clamp(1.25rem, 3.5vw, 2rem)', padding: '0.85rem 0' }}
        >
          −1
        </button>
        <button
          type="button"
          onClick={() => handleScorePoint(1)}
          disabled={hasWinner}
          className="rounded-xl text-white font-black active:scale-95 disabled:opacity-35"
          style={{
            backgroundColor: '#4f46e5',
            fontSize: 'clamp(1.25rem, 3.5vw, 2rem)',
            padding: '0.85rem 0'
          }}
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => handleDecrement(2)}
          className="rounded-xl bg-slate-800 text-white font-black border border-slate-700 active:scale-95"
          style={{ fontSize: 'clamp(1.25rem, 3.5vw, 2rem)', padding: '0.85rem 0' }}
        >
          −1
        </button>
        <button
          type="button"
          onClick={() => handleScorePoint(2)}
          disabled={hasWinner}
          className="rounded-xl text-white font-black active:scale-95 disabled:opacity-35"
          style={{
            backgroundColor: '#e11d48',
            fontSize: 'clamp(1.25rem, 3.5vw, 2rem)',
            padding: '0.85rem 0'
          }}
        >
          +1
        </button>
      </footer>

      {saveMessage && (
        <p className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 text-[11px] text-slate-300 bg-slate-900/90 border border-slate-700 px-3 py-1 rounded-full z-40 pointer-events-none">
          {saveMessage}
        </p>
      )}

      {showSaveDialog && hasMatchWinner(dialogMatch) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-score-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="space-y-1 text-center">
              <h2 id="save-score-title" className="text-xl font-black text-emerald-400">
                Match complete
              </h2>
              <p className="text-sm text-slate-200">
                Winner: <strong className="text-white">{dialogWinnerName}</strong>
              </p>
              <p className="text-4xl font-black font-mono text-amber-300 py-2">
                {dialogMatch.score1 ?? 0}-{dialogMatch.score2 ?? 0}
              </p>
              <p className="text-xs text-slate-400">Save this result?</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDismissSaveDialog}
                disabled={isSavingResult}
                className="rounded-xl bg-slate-800 text-slate-200 font-bold text-sm py-3.5 border border-slate-700 disabled:opacity-50"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSavingResult}
                className="rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm py-3.5 disabled:opacity-50"
              >
                {isSavingResult ? 'Saving…' : 'Save result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreControl;
