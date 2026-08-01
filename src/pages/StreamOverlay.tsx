import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { CompletedMatch, MatchState } from '../data/tournamentData';
import { parseYouTubeVideoId } from '../utils/youtube';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import { ServeRacket } from '../components/ServeRacket';

/** Snapshot shown on /live between matches. */
type HeldResult = {
  fixtureId: string;
  category: string;
  stage: string;
  teamA: string;
  teamB: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  maxPoints: number;
  winnerSide: 1 | 2;
};

type OverlayPhase = 'live' | 'final' | 'last';

function heldFromMatch(match: MatchState): HeldResult | null {
  if (!hasMatchWinner(match) || (match.gameWinner !== 1 && match.gameWinner !== 2)) {
    return null;
  }
  return {
    fixtureId: match.currentMatchId || '',
    category: match.category || '',
    stage: match.stage || '',
    teamA: match.teamA || 'Team A',
    teamB: match.teamB || 'Team B',
    player1: match.player1 || match.teamA || 'Player 1',
    player2: match.player2 || match.teamB || 'Player 2',
    score1: match.score1 ?? 0,
    score2: match.score2 ?? 0,
    maxPoints: match.maxPoints ?? 11,
    winnerSide: match.gameWinner
  };
}

function heldFromCompleted(row: CompletedMatch): HeldResult {
  return {
    fixtureId: row.fixtureId || row.id || '',
    category: row.category || '',
    stage: row.stage || '',
    teamA: row.teamA || 'Team A',
    teamB: row.teamB || 'Team B',
    player1: row.player1 || row.teamA || 'Player 1',
    player2: row.player2 || row.teamB || 'Player 2',
    score1: row.score1 ?? 0,
    score2: row.score2 ?? 0,
    maxPoints: row.maxPoints ?? 11,
    winnerSide: row.winnerSide === 2 ? 2 : 1
  };
}

function isMatchInProgress(match: MatchState): boolean {
  return (match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0 || !!match.deuceActive;
}

/** Minimal YouTube IFrame API surface used by /live. */
type YtPlayer = {
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};

type YtPlayerEvent = { data: number };

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          width?: string | number;
          height?: string | number;
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YtPlayer }) => void;
            onStateChange?: (e: YtPlayerEvent) => void;
          };
        }
      ) => YtPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api';
const PLAYER_HOST_ID = 'npl-live-yt-host';
const PLAYER_ELEMENT_ID = 'npl-live-yt-player';

/** Shared loader promise — one script tag for the page lifetime. */
let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API requires a browser window'));
  }
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } finally {
        resolve();
      }
    };

    if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = YT_API_SRC;
      script.async = true;
      script.onerror = () => {
        youtubeApiPromise = null;
        reject(new Error('Failed to load YouTube IFrame API'));
      };
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function ensurePlayerMountNode(): HTMLElement | null {
  const host = document.getElementById(PLAYER_HOST_ID);
  if (!host) return null;
  host.replaceChildren();
  const el = document.createElement('div');
  el.id = PLAYER_ELEMENT_ID;
  el.className = 'w-full h-full';
  host.appendChild(el);
  return el;
}

function forcePlay(player: YtPlayer): void {
  try {
    player.playVideo();
  } catch (err) {
    console.error('Failed to force YouTube playback:', err);
  }
}

/** First name / short label for tight overlay space. */
function shortName(name: string, maxChars: number): string {
  if (typeof name !== 'string' || !name.trim()) return '—';
  const first = name.trim().split(/\s+/)[0] ?? name.trim();
  if (first.length <= maxChars) return first;
  return `${first.slice(0, Math.max(1, maxChars - 1))}…`;
}

export const StreamOverlay: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [heldResult, setHeldResult] = useState<HeldResult | null>(null);
  const [latestCompleted, setLatestCompleted] = useState<HeldResult | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const keepAliveRef = useRef<number | null>(null);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const completedRef = ref(db, 'completedMatches');
    const unsubscribe = onValue(completedRef, (snapshot) => {
      const rows = sortCompletedMatches(
        Object.values(completedMatchesFromFirebase(snapshot.val()))
      );
      const top = rows[0];
      setLatestCompleted(top ? heldFromCompleted(top) : null);
    });
    return () => unsubscribe();
  }, []);

  // Latch final score while the winner is still on currentMatch
  useEffect(() => {
    const snap = heldFromMatch(match);
    if (snap) setHeldResult(snap);
  }, [match]);

  const videoId = parseYouTubeVideoId(match.youtubeLiveUrl ?? '');

  // Auto-start on load; resume if paused. Click shield blocks user pause UI.
  useEffect(() => {
    if (!videoId) {
      if (keepAliveRef.current !== null) {
        window.clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      return;
    }

    let cancelled = false;

    const mountPlayer = async () => {
      try {
        await loadYouTubeApi();
        if (cancelled || !window.YT?.Player) return;

        try {
          playerRef.current?.destroy();
        } catch {
          /* ignore */
        }
        playerRef.current = null;

        if (!ensurePlayerMountNode()) return;

        const player = new window.YT.Player(PLAYER_ELEMENT_ID, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            origin: window.location.origin
          },
          events: {
            onReady: (e) => {
              // Mute first so browsers allow autoplay, then try unmute for venue audio.
              try {
                e.target.mute();
              } catch {
                /* ignore */
              }
              forcePlay(e.target);
              window.setTimeout(() => {
                try {
                  e.target.unMute();
                } catch {
                  /* ignore */
                }
                forcePlay(e.target);
              }, 600);
            },
            onStateChange: (e) => {
              const paused = window.YT?.PlayerState?.PAUSED ?? 2;
              const ended = window.YT?.PlayerState?.ENDED ?? 0;
              const cued = window.YT?.PlayerState?.CUED ?? 5;
              if (e.data === paused || e.data === ended || e.data === cued) {
                forcePlay(player);
              }
            }
          }
        });
        playerRef.current = player;

        if (keepAliveRef.current !== null) {
          window.clearInterval(keepAliveRef.current);
        }
        keepAliveRef.current = window.setInterval(() => {
          if (playerRef.current) forcePlay(playerRef.current);
        }, 3000);
      } catch (err) {
        console.error('YouTube live player setup failed:', err);
      }
    };

    void mountPlayer();

    return () => {
      cancelled = true;
      if (keepAliveRef.current !== null) {
        window.clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  // Show final / last result until the next match scores its first point.
  let phase: OverlayPhase = 'live';
  let display = {
    category: match.category || 'Match',
    stage: match.stage || '',
    teamA: match.teamA || 'Team A',
    teamB: match.teamB || 'Team B',
    player1: match.player1 || 'Player 1',
    player2: match.player2 || 'Player 2',
    score1: match.score1 ?? 0,
    score2: match.score2 ?? 0,
    maxPoints: match.maxPoints ?? 11,
    server: (match.server === 2 ? 2 : 1) as 1 | 2,
    winnerSide: null as 1 | 2 | null,
    deuceActive: !!match.deuceActive
  };

  if (hasMatchWinner(match)) {
    phase = 'final';
    display = {
      ...display,
      winnerSide: match.gameWinner === 2 ? 2 : 1
    };
  } else if (!isMatchInProgress(match)) {
    const sticky = heldResult || latestCompleted;
    if (sticky) {
      phase = 'last';
      display = {
        category: sticky.category || 'Match',
        stage: sticky.stage || '',
        teamA: sticky.teamA,
        teamB: sticky.teamB,
        player1: sticky.player1,
        player2: sticky.player2,
        score1: sticky.score1,
        score2: sticky.score2,
        maxPoints: sticky.maxPoints,
        server: sticky.winnerSide,
        winnerSide: sticky.winnerSide,
        deuceActive: false
      };
    }
  }

  const activeServer = display.server;
  const showServe = phase === 'live';
  const winnerLabel =
    display.winnerSide === 1
      ? display.player1 || display.teamA
      : display.winnerSide === 2
        ? display.player2 || display.teamB
        : '';

  const compactOnly =
    'flex [@media(min-width:1024px)_and_(min-height:600px)]:hidden';
  const fullOnly =
    'hidden [@media(min-width:1024px)_and_(min-height:600px)]:block';

  const scoreBug = (
    <div
      className="pointer-events-auto font-sans"
      role="status"
      aria-live="polite"
      aria-label={
        phase === 'live'
          ? `Score ${display.player1} ${display.score1} to ${display.player2} ${display.score2}`
          : `Last result ${winnerLabel} ${display.score1}-${display.score2}`
      }
    >
      <div
        className={`${compactOnly} items-center gap-1 w-max max-w-[min(78vw,16rem)] landscape:max-w-[min(48vw,14rem)] rounded-md bg-black/75 border border-white/15 px-1.5 py-1 shadow-md`}
      >
        {(phase === 'final' || phase === 'last') && (
          <span className="text-[7px] font-black uppercase tracking-wider text-emerald-300 pr-0.5 border-r border-white/15">
            {phase === 'final' ? 'Final' : 'Last'}
          </span>
        )}
        <div className="flex items-center gap-0.5 min-w-0">
          {showServe && activeServer === 1 && <ServeRacket active size={12} title="Serving" />}
          <span className="text-[9px] landscape:text-[8px] font-semibold text-white/90 truncate max-w-[3.75rem] landscape:max-w-[2.75rem]">
            {shortName(display.player1, 8)}
          </span>
          <span className="text-[11px] landscape:text-[10px] font-black font-mono text-white tabular-nums leading-none px-1 py-0.5 rounded bg-indigo-600 min-w-[1.15rem] text-center">
            {display.score1}
          </span>
        </div>

        <span className="text-[8px] text-white/35 font-bold leading-none">:</span>

        <div className="flex items-center gap-0.5 min-w-0">
          <span className="text-[11px] landscape:text-[10px] font-black font-mono text-white tabular-nums leading-none px-1 py-0.5 rounded bg-rose-600 min-w-[1.15rem] text-center">
            {display.score2}
          </span>
          <span className="text-[9px] landscape:text-[8px] font-semibold text-white/90 truncate max-w-[3.75rem] landscape:max-w-[2.75rem]">
            {shortName(display.player2, 8)}
          </span>
          {showServe && activeServer === 2 && <ServeRacket active size={12} title="Serving" />}
        </div>
      </div>

      <div className={`${fullOnly} w-[min(28vw,17.5rem)] max-w-[17.5rem]`}>
        <div className="bg-slate-950/92 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-900/60">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider truncate">
                {display.category}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{display.stage}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {phase === 'live' && display.deuceActive && (
                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse border border-red-500/30">
                  Deuce
                </span>
              )}
              {(phase === 'final' || phase === 'last') && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-500/40">
                  {phase === 'final' ? 'Final' : 'Last'}
                </span>
              )}
              <span className="text-[9px] text-amber-300/90 font-mono font-bold">{display.maxPoints}P</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            <div
              className={`min-w-0 px-2.5 py-2 text-left ${
                showServe && activeServer === 1 ? 'bg-indigo-950/50' : ''
              } ${display.winnerSide === 1 ? 'bg-emerald-950/40' : ''}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                {showServe && activeServer === 1 && <ServeRacket active size={14} title="Serving" />}
                <span className="text-xs font-bold text-slate-100 truncate uppercase tracking-wide">
                  {display.teamA}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{display.player1}</p>
              <p className="mt-1 text-3xl font-black font-mono text-indigo-300 leading-none tabular-nums">
                {display.score1}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center px-1.5 py-2 border-x border-slate-800">
              <span className="text-[9px] font-bold text-slate-500 uppercase">vs</span>
            </div>

            <div
              className={`min-w-0 px-2.5 py-2 text-right ${
                showServe && activeServer === 2 ? 'bg-rose-950/50' : ''
              } ${display.winnerSide === 2 ? 'bg-emerald-950/40' : ''}`}
            >
              <div className="flex items-center justify-end gap-1 min-w-0">
                <span className="text-xs font-bold text-slate-100 truncate uppercase tracking-wide">
                  {display.teamB}
                </span>
                {showServe && activeServer === 2 && <ServeRacket active size={14} title="Serving" />}
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{display.player2}</p>
              <p className="mt-1 text-3xl font-black font-mono text-rose-300 leading-none tabular-nums">
                {display.score2}
              </p>
            </div>
          </div>

          {(phase === 'final' || phase === 'last') && winnerLabel && (
            <div className="px-2.5 py-1.5 border-t border-emerald-500/40 bg-emerald-500/15 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide truncate">
                {phase === 'last' ? 'Last match · ' : ''}Winner: {winnerLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const overlayAnchorClass =
    'fixed z-30 pointer-events-none top-[max(0.35rem,env(safe-area-inset-top))] right-[max(0.35rem,env(safe-area-inset-right))]';

  if (videoId) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden select-none">
        <div
          id={PLAYER_HOST_ID}
          className="absolute inset-0 w-full h-full [&_iframe]:!w-full [&_iframe]:!h-full"
        />

        {/* Blocks clicks/taps on the player so pause/controls cannot be used */}
        <div
          className="absolute inset-0 z-20 bg-transparent cursor-default"
          aria-hidden="true"
          onContextMenu={(e) => e.preventDefault()}
        />

        <div className={overlayAnchorClass}>{scoreBug}</div>
      </div>
    );
  }

  return <div className={overlayAnchorClass}>{scoreBug}</div>;
};

export default StreamOverlay;
