import React, { useState, useEffect } from 'react';
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

  const handleScorePoint = (side: 1 | 2) => {
    updateMatchState(applyScorePoint(match, side));
  };

  const handleDecrement = (side: 1 | 2) => {
    updateMatchState(applyDecrementScore(match, side));
  };

  const handleSetServer = (side: 1 | 2) => {
    updateMatchState(applySetServer(match, side));
  };

  const handleReset = () => {
    setSaveMessage(null);
    updateMatchState(applyResetScores(match));
  };

  const handleCompleteMatch = async () => {
    if (match.gameWinner !== 1 && match.gameWinner !== 2) {
      setSaveMessage('Finish the game before saving.');
      return;
    }
    const fixtureId = match.currentMatchId?.trim();
    if (!fixtureId) {
      setSaveMessage('Missing fixture id.');
      return;
    }

    setIsSavingResult(true);
    setSaveMessage(null);
    try {
      const fixture = FIXTURES.find((f) => f.id === fixtureId);
      const completed = buildCompletedMatch(match, fixture, new Date());
      await set(ref(db, `completedMatches/${fixtureId}`), completed);
      setSaveMessage(`Saved ${completed.result} · ${completed.completedDate} ${completed.completedTime}`);
    } catch (err) {
      console.error('Failed to save completed match:', err);
      setSaveMessage('Failed to save result.');
    } finally {
      setIsSavingResult(false);
    }
  };

  const hasWinner = hasMatchWinner(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const servingSide = (match.servingSide ?? 'right').toUpperCase();

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
            onClick={handleCompleteMatch}
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
    </div>
  );
};

export default ScoreControl;
