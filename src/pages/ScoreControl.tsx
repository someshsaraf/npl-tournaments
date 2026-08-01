import React, { useState, useEffect, useRef } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import {
  FIXTURES,
  INITIAL_MATCH,
  BEST_OF_OPTIONS,
  SCORER_MAX_POINTS_OPTIONS,
  isBestOf,
  isMaxPoints
} from '../data/tournamentData';
import type { BestOf, MatchState, MaxPoints } from '../data/tournamentData';
import {
  formatGameScoresLine,
  formatGamesWonLabel,
  hasGameWinner,
  hasSeriesWinner,
  normalizeMatchState
} from '../utils/matchState';
import {
  applyDecrementScore,
  applyScorePoint,
  applySetMaxPoints,
  applySetServer,
  applyStartNextGame,
  applySwapSides,
  isGoldenPoint
} from '../utils/scoring';
import { buildCompletedMatch } from '../utils/completedMatches';
import { buildCustomMatchState } from '../utils/customMatch';
import { ServeRacket } from '../components/ServeRacket';
import { WinnerCelebration } from '../components/WinnerCelebration';
import { BrandBanner } from '../components/BrandBanner';
import { SeriesScoreStrip } from '../components/SeriesScoreStrip';
import { Bo3BigScores } from '../components/Bo3BigScores';
import { useMatchAnnouncer } from '../hooks/useMatchAnnouncer';

/**
 * Full-viewport scoreboard for court / audience.
 * Scores dominate the screen; controls sit in a compact footer strip.
 */
export const ScoreControl: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pendingSaveMatch, setPendingSaveMatch] = useState<MatchState | null>(null);
  const [resultSaved, setResultSaved] = useState(false);
  const [showNewMatchForm, setShowNewMatchForm] = useState(false);
  const [newPlayer1, setNewPlayer1] = useState('');
  const [newPlayer2, setNewPlayer2] = useState('');
  const [newMaxPoints, setNewMaxPoints] = useState<MaxPoints>(11);
  const [newBestOf, setNewBestOf] = useState<BestOf>(1);
  const [newMatchError, setNewMatchError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    winnerName: string;
    scoreLabel: string;
    subtitle: string;
    seriesOver: boolean;
  } | null>(null);
  const promptedKeyRef = useRef<string | null>(null);
  const { audioEnabled, speechSupported, enableAudio, disableAudio } = useMatchAnnouncer(match);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  // Celebrate when a game ends (BO1 or each game in BO3).
  useEffect(() => {
    if (!hasGameWinner(match)) return;
    const key = `${match.currentMatchId}:g${match.gameNumber}:${match.score1}-${match.score2}:w${match.gameWinner}`;
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    const seriesOver = hasSeriesWinner(match);
    if (seriesOver) {
      setPendingSaveMatch(match);
      setResultSaved(false);
    } else {
      setPendingSaveMatch(null);
    }
    const winName =
      match.gameWinner === 1
        ? match.player1 || match.teamA || 'Winner'
        : match.player2 || match.teamB || 'Winner';
    const gamesLine = formatGameScoresLine(match);
    const subtitle =
      match.bestOf === 3
        ? seriesOver
          ? `Match ${formatGamesWonLabel(match)}${gamesLine ? ` · ${gamesLine}` : ''}`
          : `Game won · Series ${formatGamesWonLabel(match)}${gamesLine ? ` · ${gamesLine}` : ''}`
        : '';
    setCelebration({
      winnerName: winName,
      scoreLabel: `${match.score1 ?? 0}-${match.score2 ?? 0}`,
      subtitle,
      seriesOver
    });
  }, [match]);

  const updateMatchState = (next: MatchState) => {
    setMatch(next);
    set(ref(db, 'currentMatch'), next).catch((err) => {
      console.error('Failed to sync match state to Firebase:', err);
    });
  };

  const handleScorePoint = (side: 1 | 2) => {
    let current = match;
    if (
      current.bestOf === 3 &&
      hasGameWinner(current) &&
      !hasSeriesWinner(current)
    ) {
      try {
        current = applyStartNextGame(current);
      } catch (err) {
        setSaveMessage(err instanceof Error ? err.message : 'Could not start next game.');
        return;
      }
    }
    updateMatchState(applyScorePoint(current, side));
  };

  const handleDecrement = (side: 1 | 2) => {
    promptedKeyRef.current = null;
    setPendingSaveMatch(null);
    setCelebration(null);
    setResultSaved(false);
    setSaveMessage(null);
    updateMatchState(applyDecrementScore(match, side));
  };

  const handleSetServer = (side: 1 | 2) => {
    updateMatchState(applySetServer(match, side));
  };

  const handleSwapSides = () => {
    updateMatchState(applySwapSides(match));
  };

  const handleSetMaxPoints = (points: 11 | 15 | 21) => {
    promptedKeyRef.current = null;
    setCelebration(null);
    setResultSaved(false);
    updateMatchState(applySetMaxPoints(match, points));
  };

  const saveCompletedMatch = async (matchToSave: MatchState) => {
    if (!hasSeriesWinner(matchToSave)) {
      setSaveMessage('Finish the match (series) before saving.');
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
      setResultSaved(true);
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

  const openNewMatchForm = () => {
    setNewMatchError(null);
    setNewPlayer1('');
    setNewPlayer2('');
    setNewMaxPoints(isMaxPoints(match.maxPoints) ? match.maxPoints : 11);
    setNewBestOf(isBestOf(match.bestOf) ? match.bestOf : 1);
    setShowNewMatchForm(true);
    setCelebration(null);
  };

  const handleStartNextGame = () => {
    try {
      const next = applyStartNextGame(match);
      promptedKeyRef.current = null;
      setCelebration(null);
      setPendingSaveMatch(null);
      setSaveMessage(null);
      updateMatchState(next);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Could not start next game.');
    }
  };

  /**
   * Start a fresh custom match from the scorer after a finished game.
   * Concurrency: single Firebase write; Security: names sanitized in buildCustomMatchState.
   */
  const handleStartNewMatch = () => {
    setNewMatchError(null);
    try {
      const next = buildCustomMatchState(match, {
        sideA: newPlayer1,
        sideB: newPlayer2,
        maxPoints: newMaxPoints,
        bestOf: newBestOf,
        category: match.category?.trim() || 'Exhibition',
        stage: 'Custom'
      });
      promptedKeyRef.current = null;
      setPendingSaveMatch(null);
      setCelebration(null);
      setResultSaved(false);
      setSaveMessage(null);
      setShowNewMatchForm(false);
      updateMatchState(next);
    } catch (err) {
      setNewMatchError(err instanceof Error ? err.message : 'Could not start match.');
    }
  };

  const hasWinner = hasGameWinner(match);
  const seriesOver = hasSeriesWinner(match);
  const scoreButtonsLocked = seriesOver || (hasWinner && match.bestOf !== 3);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
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
      {/* Brand banner — centered top */}
      <div
        className="shrink-0 flex justify-center border-b border-slate-800/80 bg-slate-950"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.45rem'
        }}
      >
        <BrandBanner size="sm" />
      </div>

      {/* Status + controls strip */}
      <header
        className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 border-b border-slate-800 bg-slate-950"
        style={{
          paddingTop: '0.35rem',
          paddingBottom: '0.35rem',
          minHeight: '2.35rem'
        }}
      >
        <div className="min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 truncate block">
            {match.category}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 min-w-0">
          {hasWinner ? (
            <>
              <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/50 px-3 py-1 rounded-full whitespace-nowrap">
                {seriesOver ? 'MATCH' : 'GAME'} WIN {winnerName} · {score1}-{score2}
              </span>
              {!celebration && !showNewMatchForm && !seriesOver && match.bestOf === 3 && (
                <button
                  type="button"
                  onClick={handleStartNextGame}
                  className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-full bg-amber-400 text-slate-950 active:scale-95"
                >
                  Next Game
                </button>
              )}
              {!celebration && !showNewMatchForm && seriesOver && (
                <button
                  type="button"
                  onClick={openNewMatchForm}
                  className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-full bg-violet-500 text-slate-950 active:scale-95"
                >
                  New Match
                </button>
              )}
            </>
          ) : isGoldenPoint(match) ? (
            <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-400/50 px-3 py-1 rounded-full animate-pulse">
              GOLDEN POINT
            </span>
          ) : match.deuceActive ? (
            <span className="text-xs font-black text-red-400 bg-red-500/20 border border-red-500/50 px-3 py-1 rounded-full animate-pulse">
              DEUCE
            </span>
          ) : (
            <span className="text-[10px] sm:text-xs font-mono text-slate-500">
              {match.maxPoints ?? 11} PTS
              {match.bestOf === 3 ? ` · BO3 G${match.gameNumber ?? 1}` : ''} · {match.stage}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {seriesOver && !showNewMatchForm && (
            <button
              type="button"
              onClick={openNewMatchForm}
              className="text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-lg bg-violet-500 text-slate-950 border border-violet-300 active:scale-95"
            >
              New Match
            </button>
          )}
          {!seriesOver && hasWinner && match.bestOf === 3 && !showNewMatchForm && (
            <button
              type="button"
              onClick={handleStartNextGame}
              className="text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 border border-amber-300 active:scale-95"
            >
              Next Game
            </button>
          )}
          {speechSupported && (
            <button
              type="button"
              onClick={() => (audioEnabled ? disableAudio() : enableAudio())}
              title={
                audioEnabled
                  ? 'Announcements on — tap to mute'
                  : 'Tap to enable score announcements'
              }
              className={`text-[10px] sm:text-xs font-black px-2 py-1 rounded-lg border active:scale-95 ${
                audioEnabled
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              aria-pressed={audioEnabled}
            >
              {audioEnabled ? 'Audio On' : 'Audio'}
            </button>
          )}
          {SCORER_MAX_POINTS_OPTIONS.map((pts) => (
            <button
              key={pts}
              type="button"
              onClick={() => handleSetMaxPoints(pts)}
              title={`Race to ${pts}`}
              className={`text-[10px] sm:text-xs font-black px-2 py-1 rounded-lg border active:scale-95 ${
                (match.maxPoints ?? 11) === pts
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {pts}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSwapSides}
            className="text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600/50 text-indigo-50 border border-indigo-400/40 active:scale-95"
          >
            ↔ Swap
          </button>
        </div>
      </header>

      <SeriesScoreStrip match={match} size="sm" className="shrink-0 py-1 px-2 border-b border-slate-800/80" />

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
            {match.server === 1 ? (
              <span
                className="shrink-0 p-1.5 rounded-xl bg-emerald-500/25 ring-2 ring-emerald-400/70"
                title="Serving"
              >
                <ServeRacket active size={36} title="Serving" />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSetServer(1)}
                title="Set this side as server"
                className="shrink-0 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
              >
                SET SERVE
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            {match.bestOf === 3 ? (
              <Bo3BigScores match={match} side={1} variant="scorer" />
            ) : (
              <span
                className="font-black font-mono tabular-nums leading-none select-none text-indigo-300"
                style={{ fontSize: 'clamp(4.5rem, min(28vw, 42dvh), 16rem)' }}
              >
                {score1}
              </span>
            )}
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
            {match.server === 2 ? (
              <span
                className="shrink-0 p-1.5 rounded-xl bg-emerald-500/25 ring-2 ring-emerald-400/70"
                title="Serving"
              >
                <ServeRacket active size={36} title="Serving" />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSetServer(2)}
                title="Set this side as server"
                className="shrink-0 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
              >
                SET SERVE
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            {match.bestOf === 3 ? (
              <Bo3BigScores match={match} side={2} variant="scorer" />
            ) : (
              <span
                className="font-black font-mono tabular-nums leading-none select-none text-rose-300"
                style={{ fontSize: 'clamp(4.5rem, min(28vw, 42dvh), 16rem)' }}
              >
                {score2}
              </span>
            )}
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
          disabled={scoreButtonsLocked}
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
          disabled={scoreButtonsLocked}
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

      {celebration && (
        <WinnerCelebration
          winnerName={celebration.winnerName}
          scoreLabel={celebration.scoreLabel}
          subtitle={celebration.subtitle}
          onDismiss={() => {
            setCelebration(null);
            if (hasSeriesWinner(match) && !resultSaved) {
              setSaveMessage('Result not saved — use New Match, or save from Admin.');
            }
          }}
          onSave={hasSeriesWinner(match) ? handleConfirmSave : undefined}
          isSaving={isSavingResult}
          alreadySaved={resultSaved}
          onNextGame={
            !hasSeriesWinner(match) && match.bestOf === 3 ? handleStartNextGame : undefined
          }
          onNewMatch={hasSeriesWinner(match) ? openNewMatchForm : undefined}
        />
      )}

      {showNewMatchForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-match-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-violet-500/40 shadow-2xl p-5 space-y-4">
            <div className="text-center space-y-1">
              <h2 id="new-match-title" className="text-xl font-black text-violet-300">
                Start New Match
              </h2>
              <p className="text-xs text-slate-400">Enter players, points, and best-of format</p>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Player 1
              </span>
              <input
                type="text"
                value={newPlayer1}
                onChange={(e) => setNewPlayer1(e.target.value)}
                maxLength={80}
                autoFocus
                placeholder="Side A name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Player 2
              </span>
              <input
                type="text"
                value={newPlayer2}
                onChange={(e) => setNewPlayer2(e.target.value)}
                maxLength={80}
                placeholder="Side B name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Points
              </span>
              <div className="flex items-center gap-2">
                {SCORER_MAX_POINTS_OPTIONS.map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setNewMaxPoints(pts)}
                    className={`flex-1 text-sm font-black py-3 rounded-xl border active:scale-95 ${
                      newMaxPoints === pts
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Match length
              </span>
              <div className="flex items-center gap-2">
                {BEST_OF_OPTIONS.map((bo) => (
                  <button
                    key={bo}
                    type="button"
                    onClick={() => setNewBestOf(bo)}
                    className={`flex-1 text-sm font-black py-3 rounded-xl border active:scale-95 ${
                      newBestOf === bo
                        ? 'bg-violet-400 text-slate-950 border-violet-300'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Best of {bo}
                  </button>
                ))}
              </div>
            </div>

            {newMatchError && (
              <p className="text-xs text-red-400 text-center" role="alert">
                {newMatchError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowNewMatchForm(false);
                  setNewMatchError(null);
                }}
                className="rounded-xl bg-slate-800 text-slate-200 font-bold text-sm py-3.5 border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartNewMatch}
                className="rounded-xl bg-violet-500 text-slate-950 font-black text-sm py-3.5 hover:bg-violet-400"
              >
                Start Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreControl;
