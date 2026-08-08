import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import {
  FIXTURES,
  INITIAL_MATCH,
  SCORER_MAX_POINTS_OPTIONS
} from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
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
import {
  buildCompletedMatch,
  completedMatchStorageKey,
  toFirebaseWritable
} from '../utils/completedMatches';
import { ServeRacket } from '../components/ServeRacket';
import { ServingBadge } from '../components/ServingBadge';
import { WinnerCelebration } from '../components/WinnerCelebration';
import { BetweenMatchAd } from '../components/BetweenMatchAd';
import { BrandBanner } from '../components/BrandBanner';
import { SeriesScoreStrip } from '../components/SeriesScoreStrip';
import { useMatchAnnouncer } from '../hooks/useMatchAnnouncer';
import { useBetweenMatchAd } from '../hooks/useBetweenMatchAd';
import { captureAndPersistScoreSnapshot } from '../utils/scoreSnapshot';

/**
 * Admin scoring desk (/admin/score) — like /scorer with slightly smaller type.
 * On save: persist result, snapshot to Storage photos/, offer WhatsApp share, return to /admin.
 */
export const AdminScorePage: React.FC = () => {
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pendingSaveMatch, setPendingSaveMatch] = useState<MatchState | null>(null);
  const [resultSaved, setResultSaved] = useState(false);
  const [celebration, setCelebration] = useState<{
    winnerName: string;
    opponentName: string;
    scoreLabel: string;
    subtitle: string;
    seriesOver: boolean;
    gameScores: { score1: number; score2: number; winner: 1 | 2 }[];
    seriesLabel: string;
    matchWinner: 1 | 2 | null;
  } | null>(null);
  const promptedKeyRef = useRef<string | null>(null);
  const autoSavedKeyRef = useRef<string | null>(null);
  const { audioEnabled, speechSupported, enableAudio, disableAudio } = useMatchAnnouncer(match);
  const { showAd, maybeStartAdAfterCelebration, dismissAd } = useBetweenMatchAd(match);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  /**
   * Auto-persist when the series ends — do not rely on tapping Save & Share.
   * Concurrency: one write per match-id+score key via autoSavedKeyRef.
   */
  useEffect(() => {
    if (!hasSeriesWinner(match)) return;
    const fixtureId =
      typeof match.currentMatchId === 'string' ? match.currentMatchId.trim() : '';
    if (!fixtureId) return;

    const key = `${fixtureId}:${match.score1}-${match.score2}:mw${match.matchWinner}:gw${match.gameWinner}:g${match.gameNumber}`;
    if (autoSavedKeyRef.current === key) return;
    autoSavedKeyRef.current = key;

    const matchToSave = match;
    void (async () => {
      try {
        const storageKey = completedMatchStorageKey(fixtureId);
        const fixture = FIXTURES.find((f) => f.id === fixtureId);
        const completed = buildCompletedMatch(matchToSave, fixture, new Date());
        await set(
          ref(db, `completedMatches/${storageKey}`),
          toFirebaseWritable(completed)
        );
        setPendingSaveMatch(matchToSave);
        setResultSaved(true);
        setSaveMessage(`Saved ${completed.result}`);
      } catch (err) {
        console.error('Auto-save completed match failed:', err);
        autoSavedKeyRef.current = null;
        setResultSaved(false);
        setSaveMessage('Auto-save failed — tap Save & Share to retry.');
      }
    })();
  }, [match]);

  // Celebrate when a game ends (BO1 or each game in BO3).
  useEffect(() => {
    if (!hasGameWinner(match)) return;
    const key = `${match.currentMatchId}:g${match.gameNumber}:${match.score1}-${match.score2}:w${match.gameWinner}`;
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    const seriesOver = hasSeriesWinner(match);
    if (seriesOver) {
      setPendingSaveMatch(match);
    } else {
      setPendingSaveMatch(null);
    }
    const side1 = match.player1 || match.teamA || 'Side A';
    const side2 = match.player2 || match.teamB || 'Side B';
    const winName = match.gameWinner === 1 ? side1 : side2;
    const oppName = match.gameWinner === 1 ? side2 : side1;
    const gamesLine = formatGameScoresLine(match);
    const subtitle =
      match.bestOf === 3
        ? seriesOver
          ? `Match ${formatGamesWonLabel(match)}${gamesLine ? ` · ${gamesLine}` : ''}`
          : `Game won · Series ${formatGamesWonLabel(match)}${gamesLine ? ` · ${gamesLine}` : ''}`
        : '';
    const rawScores = Array.isArray(match.gameScores) ? match.gameScores : [];
    setCelebration({
      winnerName: winName,
      opponentName: oppName,
      scoreLabel: `${match.score1 ?? 0}-${match.score2 ?? 0}`,
      subtitle,
      seriesOver,
      gameScores: match.bestOf === 3 ? rawScores : [],
      seriesLabel: match.bestOf === 3 ? formatGamesWonLabel(match) : '',
      matchWinner:
        match.matchWinner === 1 || match.matchWinner === 2
          ? match.matchWinner
          : seriesOver && (match.gameWinner === 1 || match.gameWinner === 2)
            ? match.gameWinner
            : null
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
    autoSavedKeyRef.current = null;
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
    autoSavedKeyRef.current = null;
    setCelebration(null);
    setResultSaved(false);
    updateMatchState(applySetMaxPoints(match, points));
  };

  /**
   * Edit on-court display names. Caps length; syncs player + team labels.
   * Concurrency: single Firebase write via updateMatchState.
   */
  const handlePlayerNameChange = (side: 1 | 2, raw: unknown) => {
    if (side !== 1 && side !== 2) return;
    if (typeof raw !== 'string') return;
    const next = raw.replace(/\s+/g, ' ').slice(0, 80);
    const label = next.trim() || (side === 1 ? 'Side A' : 'Side B');
    if (side === 1) {
      updateMatchState({ ...match, player1: next, teamA: label });
    } else {
      updateMatchState({ ...match, player2: next, teamB: label });
    }
  };

  /**
   * Ensure result is in Firebase, optionally share, then return to /admin.
   * Auto-save usually already persisted; this retries + opens the share sheet.
   */
  const saveCompletedMatch = async (matchToSave: MatchState, share = true) => {
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
      const storageKey = completedMatchStorageKey(fixtureId);
      const fixture = FIXTURES.find((f) => f.id === fixtureId);
      const completedBase = buildCompletedMatch(matchToSave, fixture, new Date());
      await set(
        ref(db, `completedMatches/${storageKey}`),
        toFirebaseWritable(completedBase)
      );
      autoSavedKeyRef.current = `${fixtureId}:${matchToSave.score1}-${matchToSave.score2}:mw${matchToSave.matchWinner}:gw${matchToSave.gameWinner}:g${matchToSave.gameNumber}`;
      setResultSaved(true);
      setCelebration(null);
      setSaveMessage(
        share ? `Saved ${completedBase.result} — opening share…` : `Saved ${completedBase.result}`
      );

      if (share) {
        try {
          const snap = await captureAndPersistScoreSnapshot(matchToSave, {
            share: true,
            upload: true
          });
          const snapshotUrl = snap.downloadUrl || undefined;
          const snapshotPath = snap.storagePath || undefined;
          if (snapshotUrl || snapshotPath) {
            await set(
              ref(db, `completedMatches/${storageKey}`),
              toFirebaseWritable({
                ...completedBase,
                ...(snapshotUrl ? { snapshotUrl } : {}),
                ...(snapshotPath ? { snapshotPath } : {})
              })
            );
          }
        } catch (snapErr) {
          console.error('Score snapshot/share failed (result already saved):', snapErr);
          setSaveMessage('Result saved; share failed — check Results list.');
        }
      }

      navigate('/admin/results');
      return true;
    } catch (err) {
      console.error('Failed to save completed match:', err);
      setSaveMessage(
        err instanceof Error ? `Failed to save: ${err.message}` : 'Failed to save result.'
      );
      return false;
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleConfirmSave = async () => {
    await saveCompletedMatch(pendingSaveMatch ?? match, true);
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

  const hasWinner = hasGameWinner(match);
  const seriesOver = hasSeriesWinner(match);
  const scoreButtonsLocked = seriesOver || (hasWinner && match.bestOf !== 3);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';
  const winnerName = match.gameWinner === 1 ? name1 : name2;
  const opponentName = match.gameWinner === 1 ? name2 : name1;
  const isBo3 = match.bestOf === 3;

  const saveShareLabel = isSavingResult
    ? resultSaved
      ? 'Sharing…'
      : 'Saving…'
    : resultSaved
      ? 'Share Result'
      : 'Save & Share';

  const postMatchLinks = (
    <>
      <button
        type="button"
        onClick={() => void handleConfirmSave()}
        disabled={isSavingResult}
        className="rounded-lg bg-emerald-500 text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-wide px-2.5 py-1.5 disabled:opacity-50"
      >
        {saveShareLabel}
      </button>
      <Link
        to="/admin/results"
        className="rounded-lg border border-emerald-500/40 bg-emerald-400/15 text-emerald-200 text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1.5 hover:bg-emerald-400/25"
      >
        View Results
      </Link>
      <Link
        to="/admin"
        className="rounded-lg border border-amber-500/40 bg-amber-400/15 text-amber-200 text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1.5 hover:bg-amber-400/25"
      >
        Admin Schedule
      </Link>
    </>
  );

  const scorerOptionButtons = (
    <>
      {seriesOver && (
        <button
          type="button"
          onClick={() => void handleConfirmSave()}
          disabled={isSavingResult}
          className="text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 border border-emerald-300 active:scale-95 disabled:opacity-50"
        >
          {saveShareLabel}
        </button>
      )}
      {!seriesOver && hasWinner && isBo3 && (
        <button
          type="button"
          onClick={handleStartNextGame}
          className="text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 border border-amber-300 active:scale-95"
        >
          Next Game
        </button>
      )}
      <Link
        to="/admin"
        className="text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-lg bg-slate-800 text-amber-300 border border-amber-500/40 active:scale-95"
      >
        Admin
      </Link>
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
    </>
  );

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
        className="shrink-0 flex flex-col items-center gap-1.5 border-b border-slate-800/80 bg-slate-950 px-3"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.45rem'
        }}
      >
        <BrandBanner size="sm" subtitle="Admin scoring" />
        {seriesOver ? (
          <nav
            className="flex flex-wrap items-center justify-center gap-1.5"
            aria-label="After match"
          >
            {postMatchLinks}
          </nav>
        ) : null}
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
              <span className="text-sm sm:text-base font-black text-emerald-200 bg-emerald-500/20 border border-emerald-500/50 px-3 py-1.5 rounded-xl text-center leading-snug max-w-[min(92vw,40rem)]">
                <span className="block whitespace-nowrap truncate">
                  {seriesOver ? 'MATCH' : 'GAME'} WIN {winnerName}
                </span>
                <span className="block text-white font-black truncate">
                  def. {opponentName}
                </span>
                <span className="block text-emerald-300/90 text-[0.85em]">
                  {score1}-{score2}
                </span>
              </span>
              {!celebration && !seriesOver && isBo3 && (
                <button
                  type="button"
                  onClick={handleStartNextGame}
                  className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-full bg-amber-400 text-slate-950 active:scale-95"
                >
                  Next Game
                </button>
              )}
              {!celebration && seriesOver && (
                <button
                  type="button"
                  onClick={() => void handleConfirmSave()}
                  disabled={isSavingResult}
                  className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-full bg-emerald-500 text-slate-950 active:scale-95 disabled:opacity-50"
                >
                  {saveShareLabel}
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
          ) : isBo3 ? null : (
            <span className="text-[10px] sm:text-xs font-mono text-slate-500">
              {match.maxPoints ?? 11} PTS · {match.stage}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {!isBo3 ? scorerOptionButtons : null}
        </div>
      </header>

      {isBo3 ? (
        <div className="shrink-0 flex items-center gap-2 px-2 py-1 border-b border-slate-800/80 bg-slate-950">
          <SeriesScoreStrip match={match} size="sm" className="flex-1 min-w-0 py-0" trailing={scorerOptionButtons} />
        </div>
      ) : null}

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
          <div className="shrink-0 px-3 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Player 1 name</span>
                <input
                  type="text"
                  value={match.player1 ?? ''}
                  onChange={(e) => handlePlayerNameChange(1, e.target.value)}
                  maxLength={80}
                  placeholder={name1}
                  className="w-full min-w-0 bg-transparent text-sm sm:text-xl md:text-2xl font-black text-white truncate leading-none border border-transparent hover:border-slate-600 focus:border-indigo-400 focus:bg-slate-900/60 rounded-lg px-1.5 py-1 outline-none"
                  aria-label="Edit player 1 name"
                />
              </label>
              {match.server === 1 ? (
                <span className="shrink-0" title="Serving">
                  <ServeRacket active size={28} title="Serving" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetServer(1)}
                  title="Set this side as server"
                  className="shrink-0 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
                >
                  SET SERVE
                </button>
              )}
            </div>
            {match.server === 1 ? (
              <ServingBadge size="md" className="self-start" />
            ) : null}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-indigo-300"
              style={{ fontSize: 'clamp(3.25rem, min(22vw, 32dvh), 11rem)' }}
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
          <div className="shrink-0 px-3 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Player 2 name</span>
                <input
                  type="text"
                  value={match.player2 ?? ''}
                  onChange={(e) => handlePlayerNameChange(2, e.target.value)}
                  maxLength={80}
                  placeholder={name2}
                  className="w-full min-w-0 bg-transparent text-sm sm:text-xl md:text-2xl font-black text-white truncate leading-none border border-transparent hover:border-slate-600 focus:border-rose-400 focus:bg-slate-900/60 rounded-lg px-1.5 py-1 outline-none"
                  aria-label="Edit player 2 name"
                />
              </label>
              {match.server === 2 ? (
                <span className="shrink-0" title="Serving">
                  <ServeRacket active size={28} title="Serving" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetServer(2)}
                  title="Set this side as server"
                  className="shrink-0 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
                >
                  SET SERVE
                </button>
              )}
            </div>
            {match.server === 2 ? (
              <ServingBadge size="md" className="self-start" />
            ) : null}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-rose-300"
              style={{ fontSize: 'clamp(3.25rem, min(22vw, 32dvh), 11rem)' }}
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
          style={{ fontSize: 'clamp(1.05rem, 3vw, 1.65rem)', padding: '0.7rem 0' }}
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
            fontSize: 'clamp(1.05rem, 3vw, 1.65rem)',
            padding: '0.7rem 0'
          }}
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => handleDecrement(2)}
          className="rounded-xl bg-slate-800 text-white font-black border border-slate-700 active:scale-95"
          style={{ fontSize: 'clamp(1.05rem, 3vw, 1.65rem)', padding: '0.7rem 0' }}
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
            fontSize: 'clamp(1.05rem, 3vw, 1.65rem)',
            padding: '0.7rem 0'
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

      {celebration && !showAd && (
        <WinnerCelebration
          winnerName={celebration.winnerName}
          opponentName={celebration.opponentName}
          scoreLabel={celebration.scoreLabel}
          subtitle={celebration.subtitle}
          gameScores={celebration.gameScores}
          seriesLabel={celebration.seriesLabel}
          matchWinner={celebration.matchWinner}
          onDismiss={() => {
            setCelebration(null);
            maybeStartAdAfterCelebration();
            if (hasSeriesWinner(match)) {
              setSaveMessage(
                resultSaved
                  ? 'Result saved — see Admin → Results, or tap Share Result.'
                  : 'Saving result… if it fails, tap Save & Share to retry.'
              );
            }
          }}
          onSave={hasSeriesWinner(match) ? handleConfirmSave : undefined}
          isSaving={isSavingResult}
          alreadySaved={resultSaved}
          onNextGame={
            !hasSeriesWinner(match) && match.bestOf === 3 ? handleStartNextGame : undefined
          }
          extraActions={
            hasSeriesWinner(match) ? (
              <>
                <p className="w-full text-center text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  {resultSaved
                    ? 'Saved automatically · Share optional'
                    : 'Saving automatically · Share opens next'}
                </p>
                {postMatchLinks}
              </>
            ) : undefined
          }
        />
      )}

      {showAd && (
        <BetweenMatchAd onComplete={dismissAd} allowSkip durationMs={8000} />
      )}

    </div>
  );
};

export default AdminScorePage;
