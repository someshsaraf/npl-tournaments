import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';
import {
  enterNativeFullscreen,
  exitNativeFullscreen,
  isElementNativeFullscreen,
  setBodyScrollLocked,
  subscribeFullscreenChange
} from '../utils/fullscreen';
import { ServeRacket } from '../components/ServeRacket';
import { BrandBanner } from '../components/BrandBanner';
import { WinnerCelebration } from '../components/WinnerCelebration';

/**
 * Full-viewport audience scoreboard (/score).
 * Large type for viewing from a distance; read-only Firebase sync.
 * Concurrency: single onValue subscription; no shared mutable globals.
 */
export const LiveScoreboard: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [celebration, setCelebration] = useState<{
    winnerName: string;
    scoreLabel: string;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssImmersive, setCssImmersive] = useState(false);
  const promptedKeyRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cssImmersiveRef = useRef(false);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

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

  // Same winner fireworks as /scorer when a match finishes.
  useEffect(() => {
    if (!hasMatchWinner(match)) {
      promptedKeyRef.current = null;
      setCelebration(null);
      return;
    }
    const key = `${match.currentMatchId}:${match.score1}-${match.score2}:w${match.gameWinner}`;
    if (promptedKeyRef.current === key) return;
    promptedKeyRef.current = key;
    const winName =
      match.gameWinner === 1
        ? match.player1 || match.teamA || 'Winner'
        : match.player2 || match.teamB || 'Winner';
    setCelebration({
      winnerName: winName,
      scoreLabel: `${match.score1 ?? 0}-${match.score2 ?? 0}`
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
  const hasWinner = hasMatchWinner(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';
  const team1 = match.teamA || '';
  const team2 = match.teamB || '';
  const winnerLabel =
    match.gameWinner === 1
      ? match.player1 || match.teamA
      : match.player2 || match.teamB;

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
      {/* Brand — top center */}
      <div
        className="shrink-0 flex justify-center border-b border-slate-800/80 bg-slate-950"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.5rem'
        }}
      >
        <BrandBanner size="lg" />
      </div>

      {/* Match meta strip */}
      <header
        className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 border-b border-slate-800 bg-slate-950"
        style={{
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
          minHeight: '3rem'
        }}
      >
        <div className="min-w-0 overflow-hidden text-left">
          <span className="text-sm sm:text-base md:text-lg font-bold text-indigo-400 tracking-wider uppercase truncate block">
            {match.category}
          </span>
          <span className="text-xs sm:text-sm text-slate-500 truncate block">{match.stage}</span>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 min-w-0">
          {hasWinner ? (
            <span className="text-sm sm:text-base md:text-xl font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/50 px-4 py-1.5 rounded-full whitespace-nowrap">
              WIN {winnerLabel} · {score1}-{score2}
            </span>
          ) : match.deuceActive ? (
            <span className="text-sm sm:text-base font-black text-red-400 bg-red-500/20 border border-red-500/50 px-4 py-1.5 rounded-full animate-pulse">
              DEUCE
            </span>
          ) : (
            <span className="text-sm sm:text-base font-mono text-amber-300/90 font-bold">
              Race to {match.maxPoints ?? 11}
            </span>
          )}
          {match.isTrump && (
            <span className="text-[10px] sm:text-xs bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-0.5 rounded-full font-bold uppercase tracking-widest">
              ★ Trump ★
            </span>
          )}
        </div>

        <div className="min-w-0 flex items-center justify-end gap-2">
          <span className="hidden sm:inline text-xs sm:text-sm text-slate-500 font-mono">LIVE</span>
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

      {/* Giant score stage — fills remaining viewport for far viewing */}
      <main className="flex-1 min-h-0 grid grid-cols-2 relative">
        <section
          className="flex flex-col min-h-0 min-w-0"
          style={{
            background:
              activeServer === 1
                ? 'linear-gradient(180deg, rgba(67,56,202,0.4) 0%, rgba(2,6,23,1) 55%)'
                : 'rgba(2,6,23,1)',
            borderRight: '1px solid rgba(51,65,85,0.6)'
          }}
        >
          <div className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {team1 && team1 !== name1 && (
                <p className="text-sm sm:text-lg md:text-xl font-bold text-indigo-300/80 uppercase tracking-wide truncate">
                  {team1}
                </p>
              )}
              <p
                className="font-black text-white leading-tight truncate"
                style={{ fontSize: 'clamp(1.1rem, 3.5vw, 2.5rem)' }}
              >
                {name1}
              </p>
            </div>
            {activeServer === 1 && (
              <span
                className="shrink-0 p-2 rounded-2xl bg-emerald-500/25 ring-2 ring-emerald-400/70"
                title="Serving"
              >
                <ServeRacket active size={48} title="Serving" />
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-1">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-indigo-300"
              style={{ fontSize: 'clamp(7rem, min(42vw, 62dvh), 28rem)' }}
            >
              {score1}
            </span>
          </div>
        </section>

        <section
          className="flex flex-col min-h-0 min-w-0"
          style={{
            background:
              activeServer === 2
                ? 'linear-gradient(180deg, rgba(190,24,93,0.4) 0%, rgba(2,6,23,1) 55%)'
                : 'rgba(2,6,23,1)'
          }}
        >
          <div className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {team2 && team2 !== name2 && (
                <p className="text-sm sm:text-lg md:text-xl font-bold text-rose-300/80 uppercase tracking-wide truncate">
                  {team2}
                </p>
              )}
              <p
                className="font-black text-white leading-tight truncate"
                style={{ fontSize: 'clamp(1.1rem, 3.5vw, 2.5rem)' }}
              >
                {name2}
              </p>
            </div>
            {activeServer === 2 && (
              <span
                className="shrink-0 p-2 rounded-2xl bg-emerald-500/25 ring-2 ring-emerald-400/70"
                title="Serving"
              >
                <ServeRacket active size={48} title="Serving" />
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-1">
            <span
              className="font-black font-mono tabular-nums leading-none select-none text-rose-300"
              style={{ fontSize: 'clamp(7rem, min(42vw, 62dvh), 28rem)' }}
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

      {celebration && (
        <WinnerCelebration
          winnerName={celebration.winnerName}
          scoreLabel={celebration.scoreLabel}
          onDismiss={() => setCelebration(null)}
        />
      )}
    </div>
  );
};

export default LiveScoreboard;
