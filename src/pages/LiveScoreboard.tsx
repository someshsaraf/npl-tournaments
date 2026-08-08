import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import {
  formatGameScoresLine,
  formatGamesWonLabel,
  hasGameWinner,
  hasSeriesWinner,
  normalizeMatchState
} from '../utils/matchState';
import {
  enterNativeFullscreen,
  exitNativeFullscreen,
  isElementNativeFullscreen,
  setBodyScrollLocked,
  subscribeFullscreenChange
} from '../utils/fullscreen';
import { ServeRacket } from '../components/ServeRacket';
import { ServingBadge } from '../components/ServingBadge';
import { BrandBanner } from '../components/BrandBanner';
import { WinnerCelebration } from '../components/WinnerCelebration';
import { BetweenMatchAd } from '../components/BetweenMatchAd';
import { SeriesScoreStrip } from '../components/SeriesScoreStrip';
import { useMatchAnnouncer } from '../hooks/useMatchAnnouncer';
import { useBetweenMatchAd } from '../hooks/useBetweenMatchAd';
import { useVictoryJingle } from '../hooks/useVictoryJingle';
import { VictoryJinglePlayer } from '../components/VictoryJinglePlayer';
import { useScoreDaypartAds } from '../hooks/useScoreDaypartAds';
import { ScoreDaypartAdPlayer } from '../components/ScoreDaypartAdPlayer';
import { isGoldenPoint } from '../utils/scoring';

/**
 * Full-viewport audience scoreboard (/score).
 * Large type for viewing from a distance; read-only Firebase sync.
 * Concurrency: single onValue subscription; no shared mutable globals.
 */
export const LiveScoreboard: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [celebration, setCelebration] = useState<{
    winnerName: string;
    opponentName: string;
    scoreLabel: string;
    subtitle: string;
    gameScores: { score1: number; score2: number; winner: 1 | 2 }[];
    seriesLabel: string;
    matchWinner: 1 | 2 | null;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssImmersive, setCssImmersive] = useState(false);
  const promptedKeyRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cssImmersiveRef = useRef(false);
  const { audioEnabled, speechSupported, enableAudio, disableAudio } = useMatchAnnouncer(match);
  const { showAd, currentAd, maybeStartAdAfterCelebration, dismissAd } =
    useBetweenMatchAd(match);
  const { embedSrc: victoryJingleSrc, stopJingle } = useVictoryJingle({
    seriesOver: hasSeriesWinner(match),
    celebrationVisible: Boolean(celebration) && hasSeriesWinner(match),
    matchId: match.currentMatchId
  });
  const { active: daypartAdsActive, ads: daypartAds } = useScoreDaypartAds();

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  // Audience kiosk: after series win celebration, auto-advance into the ad.
  useEffect(() => {
    if (!celebration || !hasSeriesWinner(match) || showAd) return;
    const timer = window.setTimeout(() => {
      setCelebration(null);
      maybeStartAdAfterCelebration();
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [celebration, match, showAd, maybeStartAdAfterCelebration]);

  useEffect(() => {
    const sync = () => {
      const root = rootRef.current;
      const native =
        isElementNativeFullscreen(root) ||
        isElementNativeFullscreen(document.documentElement);
      if (native) {
        cssImmersiveRef.current = false;
        setCssImmersive(false);
        setBodyScrollLocked(false);
        setIsFullscreen(true);
        return;
      }
      setIsFullscreen(cssImmersiveRef.current);
    };
    const unsub = subscribeFullscreenChange(sync);
    return () => {
      unsub();
      cssImmersiveRef.current = false;
      setBodyScrollLocked(false);
      void exitNativeFullscreen();
    };
  }, []);

  // Fireworks when a game ends (each game in BO3, or the match in BO1).
  useEffect(() => {
    if (!hasGameWinner(match)) {
      promptedKeyRef.current = null;
      setCelebration(null);
      return;
    }
    const key = `${match.currentMatchId}:g${match.gameNumber}:${match.score1}-${match.score2}:w${match.gameWinner}`;
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    const side1 = match.player1 || match.teamA || 'Side A';
    const side2 = match.player2 || match.teamB || 'Side B';
    const winName = match.gameWinner === 1 ? side1 : side2;
    const oppName = match.gameWinner === 1 ? side2 : side1;
    const seriesOver = hasSeriesWinner(match);
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

  /**
   * Fullscreen the scoreboard root so scores stay visible.
   * Native API on desktop/Android/iPad; CSS immersive fallback (incl. iPhone).
   */
  const enterFullscreen = async (): Promise<void> => {
    const root = rootRef.current;
    if (!root) return;

    const mode = await enterNativeFullscreen(root);
    if (mode === 'native') {
      cssImmersiveRef.current = false;
      setCssImmersive(false);
      setBodyScrollLocked(false);
      setIsFullscreen(true);
      return;
    }

    cssImmersiveRef.current = true;
    setCssImmersive(true);
    setBodyScrollLocked(true);
    setIsFullscreen(true);
  };

  const exitFullscreen = async (): Promise<void> => {
    cssImmersiveRef.current = false;
    setCssImmersive(false);
    setBodyScrollLocked(false);
    await exitNativeFullscreen();
    setIsFullscreen(false);
  };

  const handleToggleFullscreen = () => {
    if (
      isFullscreen ||
      cssImmersiveRef.current ||
      isElementNativeFullscreen(rootRef.current)
    ) {
      void exitFullscreen();
      return;
    }
    void enterFullscreen();
  };

  const activeServer = match.server === 2 ? 2 : 1;
  const hasWinner = hasGameWinner(match);
  const seriesOver = hasSeriesWinner(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';
  const team1 = match.teamA || '';
  const team2 = match.teamB || '';
  const winnerLabel = match.gameWinner === 1 ? name1 : name2;
  const showServing = !hasWinner;

  return (
    <div
      ref={rootRef}
      className={`bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col ${
        cssImmersive ? 'npl-live-immersive' : ''
      }`}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        maxHeight: '100dvh'
      }}
    >
      {/* Brand — compact so scores dominate */}
      <div
        className="shrink-0 flex justify-center border-b border-slate-800/80 bg-slate-950"
        style={{
          paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
          paddingBottom: '0.25rem'
        }}
      >
        <BrandBanner size="sm" />
      </div>

      {/* Match meta strip */}
      <header
        className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 border-b border-slate-800 bg-slate-950"
        style={{
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          minHeight: '2.25rem'
        }}
      >
        <div className="min-w-0 overflow-hidden text-left">
          <span className="text-sm sm:text-base md:text-lg font-bold text-indigo-400 tracking-wider uppercase truncate block">
            {match.category}
          </span>
          <span className="text-xs sm:text-sm text-slate-500 truncate block">{match.stage}</span>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 min-w-0">
          {hasWinner && !celebration ? (
            <span
              className="font-black text-emerald-200 bg-emerald-500/25 border-2 border-emerald-400/60 px-4 sm:px-6 py-2 rounded-2xl text-center leading-snug max-w-[min(94vw,40rem)]"
              style={{ fontSize: 'clamp(1rem, 3.2vw, 2rem)' }}
            >
              <span className="block truncate">
                {seriesOver ? 'MATCH' : 'GAME'} WIN · {winnerLabel}
              </span>
              <span className="block font-mono text-amber-300 mt-0.5" style={{ fontSize: '0.9em' }}>
                {score1}-{score2}
              </span>
            </span>
          ) : !hasWinner && isGoldenPoint(match) ? (
            <span className="text-sm sm:text-base font-black text-amber-300 bg-amber-500/20 border border-amber-400/50 px-4 py-1.5 rounded-full animate-pulse">
              GOLDEN POINT
            </span>
          ) : !hasWinner && match.deuceActive ? (
            <span className="text-sm sm:text-base font-black text-red-400 bg-red-500/20 border border-red-500/50 px-4 py-1.5 rounded-full animate-pulse">
              DEUCE
            </span>
          ) : !hasWinner && match.bestOf === 3 ? null : !hasWinner ? (
            <span className="text-sm sm:text-base font-mono text-amber-300/90 font-bold">
              Race to {match.maxPoints ?? 11}
            </span>
          ) : null}
          {match.isTrump && !celebration && (
            <span className="text-[10px] sm:text-xs bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-0.5 rounded-full font-bold uppercase tracking-widest">
              ★ Trump ★
            </span>
          )}
        </div>

        <div className="min-w-0 flex items-center justify-end gap-2">
          <Link
            to="/"
            className="rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide shadow border bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700 active:scale-95"
          >
            Portal
          </Link>
          <span className="hidden sm:inline text-xs sm:text-sm text-slate-500 font-mono">LIVE</span>
          {speechSupported && (
            <button
              type="button"
              onClick={() => (audioEnabled ? disableAudio() : enableAudio())}
              className={`rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide shadow border active:scale-95 ${
                audioEnabled
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
              }`}
              aria-pressed={audioEnabled}
              aria-label={audioEnabled ? 'Disable score announcements' : 'Enable score announcements'}
              title={
                audioEnabled
                  ? 'Announcements on — tap to mute'
                  : 'Tap to enable score announcements'
              }
            >
              {audioEnabled ? 'Audio On' : 'Audio'}
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide shadow border active:scale-95 ${
              isFullscreen
                ? 'bg-indigo-500 text-white border-indigo-300'
                : 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
            }`}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
      </header>

      <SeriesScoreStrip match={match} size="lg" className="shrink-0 py-1.5 px-3 border-b border-slate-800/80 bg-slate-950" />

      {/* Giant score stage — names overlay top so scores can use almost full height */}
      <main className="flex-1 min-h-0 grid grid-cols-2 relative">
        <section
          className="relative flex flex-col min-h-0 min-w-0"
          style={{
            background:
              showServing && activeServer === 1
                ? 'linear-gradient(180deg, rgba(67,56,202,0.4) 0%, rgba(2,6,23,1) 55%)'
                : 'rgba(2,6,23,1)',
            borderRight: '1px solid rgba(51,65,85,0.6)'
          }}
        >
          <div className="absolute inset-x-0 top-0 z-10 px-3 sm:px-5 pt-2 sm:pt-3 text-center pointer-events-none">
            {showServing && activeServer === 1 && (
              <div className="mb-2 flex justify-center">
                <ServingBadge size="lg" />
              </div>
            )}
            {showServing && activeServer === 1 && (
              <span
                className="pointer-events-auto absolute right-3 top-2 sm:right-4 sm:top-3 p-1.5 rounded-xl bg-emerald-500/25 ring-2 ring-emerald-400/70"
                title="Serving"
              >
                <ServeRacket active size={36} title="Serving" />
              </span>
            )}
            {team1 && team1 !== name1 && (
              <p className="text-sm sm:text-base md:text-lg font-bold text-indigo-300/90 uppercase tracking-wide truncate px-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {team1}
              </p>
            )}
            <p
              className="font-black text-white leading-tight truncate px-2 sm:px-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
              style={{ fontSize: 'clamp(1.5rem, 5vw, 3.75rem)' }}
            >
              {name1}
            </p>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden pt-10 sm:pt-12">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-indigo-300"
              style={{ fontSize: 'clamp(9rem, min(49.5vw, 88dvh), 48rem)' }}
            >
              {score1}
            </span>
          </div>
        </section>

        <section
          className="relative flex flex-col min-h-0 min-w-0"
          style={{
            background:
              showServing && activeServer === 2
                ? 'linear-gradient(180deg, rgba(190,24,93,0.4) 0%, rgba(2,6,23,1) 55%)'
                : 'rgba(2,6,23,1)'
          }}
        >
          <div className="absolute inset-x-0 top-0 z-10 px-3 sm:px-5 pt-2 sm:pt-3 text-center pointer-events-none">
            {showServing && activeServer === 2 && (
              <div className="mb-2 flex justify-center">
                <ServingBadge size="lg" />
              </div>
            )}
            {showServing && activeServer === 2 && (
              <span
                className="pointer-events-auto absolute right-3 top-2 sm:right-4 sm:top-3 p-1.5 rounded-xl bg-emerald-500/25 ring-2 ring-emerald-400/70"
                title="Serving"
              >
                <ServeRacket active size={36} title="Serving" />
              </span>
            )}
            {team2 && team2 !== name2 && (
              <p className="text-sm sm:text-base md:text-lg font-bold text-rose-300/90 uppercase tracking-wide truncate px-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {team2}
              </p>
            )}
            <p
              className="font-black text-white leading-tight truncate px-2 sm:px-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
              style={{ fontSize: 'clamp(1.5rem, 5vw, 3.75rem)' }}
            >
              {name2}
            </p>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden pt-10 sm:pt-12">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-rose-300"
              style={{ fontSize: 'clamp(9rem, min(49.5vw, 88dvh), 48rem)' }}
            >
              {score2}
            </span>
          </div>
        </section>

        <div className="pointer-events-none absolute inset-y-[18%] left-1/2 -translate-x-1/2 flex items-center">
          <span className="text-slate-600 font-black tracking-[0.35em] text-sm sm:text-xl md:text-2xl bg-slate-950/70 px-3 py-1.5 rounded-lg">
            VS
          </span>
        </div>
      </main>

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
          }}
          variant="audience"
        />
      )}

      {showAd && currentAd && !daypartAdsActive && (
        <BetweenMatchAd
          ad={currentAd}
          onComplete={dismissAd}
          allowSkip={false}
          durationMs={8000}
        />
      )}

      {daypartAdsActive ? <ScoreDaypartAdPlayer ads={daypartAds} /> : null}

      {victoryJingleSrc && !daypartAdsActive ? (
        <VictoryJinglePlayer embedSrc={victoryJingleSrc} onClose={stopJingle} />
      ) : null}
    </div>
  );
};

export default LiveScoreboard;
