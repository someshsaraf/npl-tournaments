import React, { useState, useEffect, useRef } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { FIXTURES, INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';
import {
  applyDecrementScore,
  applyResetScores,
  applyScorePoint,
  applySetServer
} from '../utils/scoring';
import { buildCompletedMatch } from '../utils/completedMatches';

/**
 * Lightweight score-only controller for court use.
 * Syncs the same Firebase `currentMatch` as Admin / Live / Overlay.
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
    updateMatchState(applyDecrementScore(match, side));
  };

  const handleSetServer = (side: 1 | 2) => {
    updateMatchState(applySetServer(match, side));
  };

  const handleReset = () => {
    promptedKeyRef.current = null;
    setShowSaveDialog(false);
    setPendingSaveMatch(null);
    setSaveMessage(null);
    updateMatchState(applyResetScores(match));
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
      setSaveMessage(`Saved ${completed.result} · ${completed.completedDate} ${completed.completedTime}`);
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
    const toSave = pendingSaveMatch ?? match;
    await saveCompletedMatch(toSave);
  };

  const handleDismissSaveDialog = () => {
    setShowSaveDialog(false);
    setSaveMessage('Result not saved yet — tap Complete & Save when ready.');
  };

  const hasWinner = hasMatchWinner(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const servingSide = (match.servingSide ?? 'right').toUpperCase();
  const dialogMatch = pendingSaveDialogMatch(pendingSaveMatch, match);
  const dialogWinnerName =
    dialogMatch.gameWinner === 1
      ? dialogMatch.player1 || dialogMatch.teamA
      : dialogMatch.player2 || dialogMatch.teamB;

  const sideCard = (side: 1 | 2) => {
    const isServer = match.server === side;
    const name = side === 1 ? (match.player1 || match.teamA) : (match.player2 || match.teamB);
    const team = side === 1 ? match.teamA : match.teamB;
    const score = side === 1 ? score1 : score2;

    return (
      <div
        className={`rounded-2xl border p-4 sm:p-5 space-y-4 transition-all ${
          isServer ? 'shadow-lg' : 'bg-slate-900/80 border-slate-800'
        }`}
        style={
          isServer
            ? {
                backgroundColor: side === 1 ? 'rgba(49,46,129,0.35)' : 'rgba(136,19,55,0.35)',
                borderColor: side === 1 ? 'rgba(99,102,241,0.7)' : 'rgba(244,63,94,0.7)'
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 truncate">{team}</p>
            <p className="text-base sm:text-lg font-bold text-white truncate">{name}</p>
          </div>
          <button
            type="button"
            onClick={() => handleSetServer(side)}
            className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md ${
              isServer
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {isServer ? `Serving (${servingSide})` : 'Set Serve'}
          </button>
        </div>

        <p
          className={`text-center font-black font-mono tabular-nums leading-none ${
            side === 1 ? 'text-indigo-300' : 'text-rose-300'
          }`}
          style={{ fontSize: 'clamp(3.5rem, 18vw, 6rem)' }}
        >
          {score}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleDecrement(side)}
            className="rounded-xl bg-slate-800 text-white text-2xl font-black py-5 active:scale-95 transition-transform border border-slate-700"
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => handleScorePoint(side)}
            disabled={hasWinner}
            className="rounded-xl text-white text-2xl font-black py-5 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: side === 1 ? '#4f46e5' : '#e11d48' }}
          >
            +1
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans max-w-3xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider truncate">
            {match.category}
          </p>
          <h1 className="text-xl font-black text-white truncate">{match.stage}</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Target {match.maxPoints ?? 11} · ID {match.currentMatchId}
          </p>
        </div>
      </header>

      {(match.deuceActive || hasWinner) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-bold ${
            hasWinner
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/40 text-red-300 animate-pulse'
          }`}
        >
          {hasWinner
            ? `Winner: ${
                match.gameWinner === 1
                  ? match.player1 || match.teamA
                  : match.player2 || match.teamB
              } (${score1}-${score2})`
            : 'DEUCE — win by 2'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sideCard(1)}
        {sideCard(2)}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {hasWinner && (
          <button
            type="button"
            onClick={() => {
              setPendingSaveMatch(match);
              setShowSaveDialog(true);
            }}
            disabled={isSavingResult}
            className="flex-1 min-w-[140px] bg-emerald-500 text-slate-950 font-bold text-sm px-4 py-3 rounded-xl disabled:opacity-50"
          >
            {isSavingResult ? 'Saving…' : 'Complete & Save'}
          </button>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 min-w-[140px] bg-slate-800 text-slate-200 font-bold text-sm px-4 py-3 rounded-xl border border-slate-700"
        >
          Reset Scores
        </button>
      </div>

      {saveMessage && (
        <p className="text-xs text-slate-400 text-center">{saveMessage}</p>
      )}

      {showSaveDialog && hasMatchWinner(dialogMatch) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-score-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="space-y-1">
              <h2 id="save-score-title" className="text-lg font-black text-emerald-400">
                Match complete
              </h2>
              <p className="text-sm text-slate-200">
                Winner: <strong className="text-white">{dialogWinnerName}</strong>
              </p>
              <p className="text-2xl font-black font-mono text-amber-300">
                {dialogMatch.score1 ?? 0}-{dialogMatch.score2 ?? 0}
              </p>
              <p className="text-xs text-slate-400">
                Save this result to completed matches?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDismissSaveDialog}
                disabled={isSavingResult}
                className="rounded-xl bg-slate-800 text-slate-200 font-bold text-sm py-3 border border-slate-700 disabled:opacity-50"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSavingResult}
                className="rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm py-3 disabled:opacity-50"
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

function pendingSaveDialogMatch(
  pending: MatchState | null,
  current: MatchState
): MatchState {
  return pending && hasMatchWinner(pending) ? pending : current;
}

export default ScoreControl;
