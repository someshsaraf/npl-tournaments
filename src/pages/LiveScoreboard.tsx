import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH, isFinalStage } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import {
  formatGameScoresLine,
  formatGamesWonLabel,
  formatWinnerFirstScore,
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

  /** /score: start between-match ad only after victory jingle ends (or skips). Never for finals. */
  const handleJingleEnded = useCallback(() => {
    if (isFinalStage(match.stage)) return;
    maybeStartAdAfterCelebration();
  }, [maybeStartAdAfterCelebration, match.stage]);

  const isFinalMatch = isFinalStage(match.stage);

  const { embedSrc: victoryJingleSrc, stopJingle } = useVictoryJingle({
    seriesOver: hasSeriesWinner(match) && !isFinalMatch,
    celebrationVisible:
      Boolean(celebration) && hasSeriesWinner(match) && !isFinalMatch,
    matchId: match.currentMatchId,
    onJingleEnded: handleJingleEnded
  });
  const { active: daypartAdsActive, ads: daypartAds } = useScoreDaypartAds();
  /** Finals: no daypart ads, no between-match ads, no victory music. */
  const allowAdsAndMusic = !isFinalMatch;

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  // Audience kiosk: auto-dismiss celebration — finals hold until next match starts.
  useEffect(() => {
    if (!celebration || !hasSeriesWinner(match) || showAd) return;
    if (isFinalStage(match.stage)) return;
    const timer = window.setTimeout(() => {
      setCelebration(null);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [celebration, match, showAd]);

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
      scoreLabel: formatWinnerFirstScore(
        match.score1,
        match.score2,
        match.gameWinner
      ),
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
  const isFinal = isFinalMatch;
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';
  const team1 = match.teamA || '';
  const team2 = match.teamB || '';
  const winnerLabel = match.gameWinner === 1 ? name1 : name2;
  const opponentLabel = match.gameWinner === 1 ? name2 : name1;
  const showServing = !hasWinner;
  const winnerFirstScore = formatWinnerFirstScore(score1, score2, match.gameWinner);
  const bo3GameScores =
    match.bestOf === 3 && Array.isArray(match.gameScores)
      ? match.gameScores.filter(
          (g) => g && Number.isFinite(g.score1) && Number.isFinite(g.score2)
        )
      : [];
  const showBo3Inline = bo3GameScores.length > 0;

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
        maxHeight: '100dvh',
        ...(isFinal
          ? {
              boxShadow: 'inset 0 0 0 3px rgba(245, 158, 11, 0.55)'
            }
          : {})
      }}
    >
      {/* Brand — compact so scores dominate */}
      <div
        className={`shrink-0 flex flex-col items-center border-b bg-slate-950 ${
          isFinal ? 'border-amber-500/40' : 'border-slate-800/80'
        }`}
        style={{
          paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
          paddingBottom: '0.25rem'
        }}
      >
        <BrandBanner size="sm" />
        {isFinal ? (
          <p
            className="mt-0.5 font-black uppercase tracking-[0.35em] text-amber-300"
            style={{
              fontSize: 'clamp(0.65rem, 1.6vw, 0.95rem)',
              textShadow: '0 0 18px rgba(245,158,11,0.45)'
            }}
          >
            NPL 2026 · Final
          </p>
        ) : null}
      </div>

      {/* Match meta strip */}
      <header
        className={`shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 border-b bg-slate-950 ${
          isFinal ? 'border-amber-500/35' : 'border-slate-800'
        }`}
        style={{
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          minHeight: '2.25rem'
        }}
      >
        <div className="min-w-0 overflow-hidden text-left">
          <span
            className={`text-sm sm:text-base md:text-lg font-bold tracking-wider uppercase truncate block ${
              isFinal ? 'text-amber-300' : 'text-indigo-400'
            }`}
          >
            {match.category}
          </span>
          <span
            className={`text-xs sm:text-sm truncate block ${
              isFinal
                ? 'font-black uppercase tracking-[0.28em] text-amber-400/90'
                : 'text-slate-500'
            }`}
          >
            {isFinal ? 'Final' : match.stage}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 min-w-0">
          {hasWinner && !celebration ? (
            <span
              className={`text-sm sm:text-base md:text-lg font-black uppercase tracking-[0.2em] ${
                isFinal && seriesOver ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {seriesOver ? (isFinal ? 'Champion' : 'Match win') : 'Game win'}
            </span>
          ) : !hasWinner && isGoldenPoint(match) ? (
            <span className="text-sm sm:text-base font-black text-amber-300 bg-amber-500/20 border border-amber-400/50 px-4 py-1.5 rounded-full animate-pulse">
              GOLDEN POINT
            </span>
          ) : !hasWinner && match.deuceActive ? (
            <span className="text-sm sm:text-base font-black text-red-400 bg-red-500/20 border border-red-500/50 px-4 py-1.5 rounded-full animate-pulse">
              DEUCE
            </span>
          ) : !hasWinner && match.bestOf === 3 ? (
            isFinal ? (
              <span className="text-sm sm:text-base font-black uppercase tracking-[0.28em] text-amber-300 bg-amber-500/15 border border-amber-400/45 px-4 py-1.5 rounded-full">
                Final
              </span>
            ) : null
          ) : !hasWinner ? (
            isFinal ? (
              <span className="text-sm sm:text-base font-black uppercase tracking-[0.28em] text-amber-300 bg-amber-500/15 border border-amber-400/45 px-4 py-1.5 rounded-full">
                Final · Race to {match.maxPoints ?? 11}
              </span>
            ) : (
              <span className="text-sm sm:text-base font-mono text-amber-300/90 font-bold">
                Race to {match.maxPoints ?? 11}
              </span>
            )
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

      <SeriesScoreStrip
        match={match}
        size="lg"
        className={`shrink-0 py-1.5 px-3 border-b bg-slate-950 ${
          isFinal ? 'border-amber-500/30' : 'border-slate-800/80'
        }`}
      />

      {/* After a win: winner-first hierarchy. During play: split live scores. */}
      {hasWinner ? (
        <main
          className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-5 px-4 text-center bg-slate-950"
          aria-live="polite"
        >
          <p
            className={`font-black uppercase tracking-[0.28em] ${
              isFinal && seriesOver ? 'text-amber-300' : 'text-emerald-300'
            }`}
            style={{ fontSize: 'clamp(1.1rem, 2.8vw, 1.75rem)' }}
          >
            {seriesOver ? (isFinal ? 'Champion' : 'Match winner') : 'Game winner'}
          </p>
          <h2
            className="w-full max-w-[min(98vw,80rem)] font-black text-white leading-[1.02]"
            style={{
              fontSize: showBo3Inline
                ? 'clamp(4.5rem, min(15vw, 22dvh), 11rem)'
                : 'clamp(5rem, min(16vw, 24dvh), 12rem)',
              textShadow: isFinal
                ? '0 0 44px rgba(245,158,11,0.5)'
                : '0 0 40px rgba(52,211,153,0.4)'
            }}
          >
            {winnerLabel}
          </h2>
          {showBo3Inline ? (
            <div
              className="flex w-full max-w-[min(98vw,80rem)] items-stretch justify-center gap-2 sm:gap-4"
              aria-label={`Game scores ${bo3GameScores.map((g, i) => `G${i + 1} ${g.score1}-${g.score2}`).join(', ')}`}
            >
              {[0, 1, 2].map((i) => {
                const g = bo3GameScores[i];
                const filled = !!g;
                const winnerSide =
                  match.matchWinner === 1 || match.matchWinner === 2
                    ? match.matchWinner
                    : seriesOver && (match.gameWinner === 1 || match.gameWinner === 2)
                      ? match.gameWinner
                      : null;
                const wonByMatchWinner =
                  filled && winnerSide !== null && g.winner === winnerSide;
                return (
                  <div
                    key={`inline-g${i + 1}`}
                    className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border px-2 py-3 sm:px-4 sm:py-5 ${
                      wonByMatchWinner
                        ? 'border-emerald-400 bg-emerald-500/30'
                        : filled
                          ? 'border-amber-400/50 bg-slate-950/50'
                          : 'border-slate-700/40 bg-slate-950/20 opacity-35'
                    }`}
                  >
                    <span
                      className={`font-black uppercase tracking-[0.2em] ${
                        wonByMatchWinner ? 'text-emerald-200' : 'text-slate-400'
                      }`}
                      style={{ fontSize: 'clamp(1rem, 2.4vw, 1.5rem)' }}
                    >
                      G{i + 1}
                      {wonByMatchWinner ? ' · W' : ''}
                    </span>
                    <span
                      className={`font-black font-mono tabular-nums leading-none ${
                        wonByMatchWinner
                          ? 'text-emerald-200'
                          : filled
                            ? 'text-amber-300'
                            : 'text-slate-600'
                      }`}
                      style={{ fontSize: 'clamp(3.75rem, min(16vw, 20dvh), 9rem)' }}
                    >
                      {filled
                        ? formatWinnerFirstScore(g.score1, g.score2, g.winner)
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className="font-black font-mono tabular-nums text-amber-300 leading-none"
              style={{
                fontSize: 'clamp(7rem, min(28vw, 34dvh), 16rem)',
                textShadow: '0 0 36px rgba(251,191,36,0.45)'
              }}
            >
              {winnerFirstScore}
            </p>
          )}
          {showBo3Inline ? (
            <p
              className={`font-black tracking-wide ${
                isFinal && seriesOver ? 'text-amber-300' : 'text-emerald-300'
              }`}
              style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)' }}
            >
              Games {formatGamesWonLabel(match)}
            </p>
          ) : null}
          <p
            className="w-full max-w-[min(92vw,48rem)] font-semibold text-slate-400 leading-snug"
            style={{ fontSize: 'clamp(1.35rem, min(4.2vw, 5.5dvh), 2.5rem)' }}
          >
            <span className="uppercase tracking-[0.16em] text-amber-300/80 font-black mr-2">
              def.
            </span>
            {opponentLabel}
          </p>
        </main>
      ) : (
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
      )}

      {celebration && !(showAd && allowAdsAndMusic) && (
        <WinnerCelebration
          winnerName={celebration.winnerName}
          opponentName={celebration.opponentName}
          scoreLabel={celebration.scoreLabel}
          subtitle={celebration.subtitle}
          gameScores={celebration.gameScores}
          seriesLabel={celebration.seriesLabel}
          matchWinner={celebration.matchWinner}
          isFinal={isFinal && seriesOver}
          onDismiss={() => {
            setCelebration(null);
          }}
          variant="audience"
        />
      )}

      {allowAdsAndMusic && showAd && currentAd && !daypartAdsActive && (
        <BetweenMatchAd
          ad={currentAd}
          onComplete={dismissAd}
          allowSkip={false}
          durationMs={8000}
        />
      )}

      {allowAdsAndMusic && daypartAdsActive ? (
        <ScoreDaypartAdPlayer ads={daypartAds} />
      ) : null}

      {allowAdsAndMusic && victoryJingleSrc && !daypartAdsActive ? (
        <VictoryJinglePlayer embedSrc={victoryJingleSrc} onClose={stopJingle} />
      ) : null}
    </div>
  );
};

export default LiveScoreboard;
