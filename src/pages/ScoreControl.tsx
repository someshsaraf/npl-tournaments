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

/**
 * Full-screen score controller for court / audience display.
 * Syncs Firebase `currentMatch`. Save prompt appears when a winner is reached.
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
    if (hasMatchWinner(next)) {
      openSaveDialog(next);
    }
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
    setSaveMessage('Result not saved — reopen by scoring again after a −1 correction, or from Admin.');
  };

  const hasWinner = hasMatchWinner(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const servingSide = (match.servingSide ?? 'right').toUpperCase();
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

  const sidePanel = (side: 1 | 2) => {
    const isServer = match.server === side;
    const name = side === 1 ? (match.player1 || match.teamA) : (match.player2 || match.teamB);
    const team = side === 1 ? match.teamA : match.teamB;
    const score = side === 1 ? score1 : score2;
    const scoreColor = side === 1 ? '#a5b4fc' : '#fda4af';
    const btnColor = side === 1 ? '#4f46e5' : '#e11d48';

    return (
      <div
        className="flex flex-col min-h-0 h-full border-slate-800"
        style={{
          background: isServer
            ? side === 1
              ? 'linear-gradient(180deg, rgba(49,46,129,0.55) 0%, rgba(2,6,23,0.95) 100%)'
              : 'linear-gradient(180deg, rgba(136,19,55,0.55) 0%, rgba(2,6,23,0.95) 100%)'
            : 'transparent',
          borderRight: side === 1 ? '1px solid rgba(51,65,85,0.8)' : undefined,
          borderLeft: side === 2 ? '1px solid rgba(51,65,85,0.8)' : undefined
        }}
      >
        <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 text-left">
            <p className="text-xs sm:text-sm uppercase tracking-widest text-slate-400 truncate">
              {team}
            </p>
            <p className="text-lg sm:text-3xl lg:text-4xl font-black text-white truncate leading-tight">
              {name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSetServer(side)}
            className={`shrink-0 text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg ${
              isServer
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 border border-slate-700'
            }`}
          >
            {isServer ? `SERVE ${servingSide}` : 'SET SERVE'}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-2 min-h-0">
          <p
            className="font-black font-mono tabular-nums leading-none select-none"
            style={{
              color: scoreColor,
              fontSize: 'clamp(5rem, 22vw, 14rem)'
            }}
          >
            {score}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => handleDecrement(side)}
            className="rounded-2xl bg-slate-800/90 text-white font-black active:scale-95 transition-transform border border-slate-700"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', padding: 'clamp(0.75rem, 2vh, 1.5rem) 0' }}
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => handleScorePoint(side)}
            disabled={hasWinner}
            className="rounded-2xl text-white font-black active:scale-95 transition-transform disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              backgroundColor: btnColor,
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              padding: 'clamp(0.75rem, 2vh, 1.5rem) 0'
            }}
          >
            +1
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-800 bg-slate-950/95 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider truncate">
            {match.category}
          </p>
          <p className="text-sm sm:text-lg font-black text-white truncate">{match.stage}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSwapSides}
            className="text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600/40 text-indigo-100 border border-indigo-500/50 hover:bg-indigo-600/60 active:scale-95 transition-all"
            title="Swap court sides"
          >
            ↔ Swap
          </button>
          {match.deuceActive && !hasWinner && (
            <span className="text-[10px] sm:text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/40 px-2 py-1 rounded-full animate-pulse">
              DEUCE
            </span>
          )}
          {hasWinner && (
            <span className="text-[10px] sm:text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-2 py-1 rounded-full max-w-[40vw] truncate">
              WIN · {winnerName}
            </span>
          )}
          <span className="text-[10px] sm:text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-full">
            {match.maxPoints ?? 11}P
          </span>
        </div>
      </div>

      {/* Full-bleed scoreboard */}
      <div className="flex-1 min-h-0 grid grid-cols-2 relative">
        {sidePanel(1)}
        {sidePanel(2)}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
          <span className="text-slate-600 font-black text-sm sm:text-xl tracking-widest bg-slate-950/80 px-2 py-1 rounded">
            VS
          </span>
        </div>
      </div>

      {saveMessage && (
        <p className="shrink-0 text-center text-[11px] text-slate-400 py-1.5 border-t border-slate-800">
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
