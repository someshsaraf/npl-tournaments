import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db, YOUTUBE_LIVE_URL_PATH } from '../firebase';
import { INITIAL_MATCH, isMaxPoints } from '../data/tournamentData';
import type { CompletedMatch, MatchState, MaxPoints } from '../data/tournamentData';
import { parseYouTubeVideoId } from '../utils/youtube';
import { hasGameWinner, hasSeriesWinner, normalizeMatchState } from '../utils/matchState';
import {
  completedMatchesFromFirebase,
  sortCompletedMatches
} from '../utils/completedMatches';
import { isGoldenPoint } from '../utils/scoring';
import {
  enterNativeFullscreen,
  exitNativeFullscreen,
  isElementNativeFullscreen,
  isIosLikeDevice,
  isIphoneDevice,
  isStandaloneDisplayMode,
  setBodyScrollLocked,
  setIosBrowserChromeCollapse,
  subscribeFullscreenChange
} from '../utils/fullscreen';
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
  maxPoints: MaxPoints;
  winnerSide: 1 | 2;
};

type OverlayPhase = 'live' | 'final' | 'last';

function heldFromMatch(match: MatchState): HeldResult | null {
  if (!hasSeriesWinner(match)) {
    return null;
  }
  const winnerSide = match.matchWinner === 2 ? 2 : 1;
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
    maxPoints: isMaxPoints(match.maxPoints) ? match.maxPoints : 11,
    winnerSide
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
    maxPoints: isMaxPoints(row.maxPoints) ? row.maxPoints : 11,
    winnerSide: row.winnerSide === 2 ? 2 : 1
  };
}

function isMatchInProgress(match: MatchState): boolean {
  return (
    (match.score1 ?? 0) > 0 ||
    (match.score2 ?? 0) > 0 ||
    !!match.deuceActive ||
    (match.gamesWon1 ?? 0) > 0 ||
    (match.gamesWon2 ?? 0) > 0 ||
    hasGameWinner(match)
  );
}

/** Minimal YouTube IFrame API surface used by /live. */
type YtPlayer = {
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getPlayerState?: () => number;
  destroy: () => void;
  getIframe?: () => HTMLIFrameElement;
};

type YtPlayerEvent = { data: number; target: YtPlayer };

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
            onError?: (e: { data: number }) => void;
          };
        }
      ) => YtPlayer;
      PlayerState?: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api';
const PLAYER_HOST_ID = 'npl-live-yt-host';
const PLAYER_ELEMENT_ID = 'npl-live-yt-player';

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

    if (document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(poll);
          resolve();
        } else if (Date.now() - started > 15000) {
          window.clearInterval(poll);
          youtubeApiPromise = null;
          reject(new Error('YouTube IFrame API timed out'));
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src = YT_API_SRC;
    script.async = true;
    script.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error('Failed to load YouTube IFrame API'));
    };
    document.head.appendChild(script);
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

function hardenYouTubeIframe(player: YtPlayer): void {
  try {
    const iframe =
      typeof player.getIframe === 'function'
        ? player.getIframe()
        : (document.getElementById(PLAYER_HOST_ID)?.querySelector('iframe') ?? null);
    if (!iframe) return;
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen *'
    );
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('webkitallowfullscreen', 'true');
    iframe.setAttribute('playsinline', '1');
    iframe.setAttribute('webkit-playsinline', 'true');
  } catch (err) {
    console.error('Failed to harden YouTube iframe:', err);
  }
}

function playMuted(player: YtPlayer): void {
  try {
    player.mute();
  } catch {
    /* ignore */
  }
  try {
    player.playVideo();
  } catch (err) {
    console.error('Failed to start muted playback:', err);
  }
}

/** Unmute + play inside a user gesture (required for iOS audio). */
function playWithSound(player: YtPlayer): void {
  if (!player || typeof player !== 'object') return;
  try {
    player.mute();
  } catch {
    /* ignore */
  }
  try {
    player.playVideo();
  } catch {
    /* ignore */
  }
  try {
    player.unMute();
  } catch {
    /* ignore */
  }
  try {
    player.playVideo();
  } catch (err) {
    console.error('Failed to start playback with sound:', err);
  }
}

function shortName(name: string, maxChars: number): string {
  if (typeof name !== 'string' || !name.trim()) return '—';
  const first = name.trim().split(/\s+/)[0] ?? name.trim();
  if (first.length <= maxChars) return first;
  return `${first.slice(0, Math.max(1, maxChars - 1))}…`;
}

export const StreamOverlay: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [settingsYoutubeUrl, setSettingsYoutubeUrl] = useState('');
  const [heldResult, setHeldResult] = useState<HeldResult | null>(null);
  const [latestCompleted, setLatestCompleted] = useState<HeldResult | null>(null);
  const [showPlayGate, setShowPlayGate] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssImmersive, setCssImmersive] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(orientation: landscape)').matches;
  });
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplayMode());
  const [showHomeScreenTip, setShowHomeScreenTip] = useState(false);

  const playerRef = useRef<YtPlayer | null>(null);
  const liveRootRef = useRef<HTMLDivElement | null>(null);
  const keepAliveRef = useRef<number | null>(null);
  const soundOnRef = useRef(false);
  const userStartedRef = useRef(false);
  const cssImmersiveRef = useRef(false);
  const iosLike = isIosLikeDevice();
  const iphone = isIphoneDevice();

  // iOS landscape = cinema: hide app chrome; keep score only (no player remount).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(orientation: landscape)');
    const onChange = () => setIsLandscape(Boolean(mq.matches));
    onChange();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplayMode());
  }, []);

  useEffect(() => {
    const sync = () => {
      const root = liveRootRef.current;
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
    return subscribeFullscreenChange(sync);
  }, []);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const youtubeRef = ref(db, YOUTUBE_LIVE_URL_PATH);
    const unsubscribe = onValue(youtubeRef, (snapshot) => {
      const val = snapshot.val();
      setSettingsYoutubeUrl(typeof val === 'string' ? val : '');
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

  useEffect(() => {
    const snap = heldFromMatch(match);
    if (snap) setHeldResult(snap);
  }, [match]);

  useEffect(() => {
    const id = typeof match.currentMatchId === 'string' ? match.currentMatchId.trim() : '';
    if (!id) return;
    setHeldResult((prev) => (prev && prev.fixtureId !== id ? null : prev));
  }, [match.currentMatchId]);

  const videoId = parseYouTubeVideoId(
    settingsYoutubeUrl || match.youtubeLiveUrl || ''
  );

  /** iOS + landscape + playing: hide Sound/messages for a full-bleed watch mode. */
  const iosLandscapeCinema = iosLike && isLandscape && !showPlayGate && !!videoId;

  // Landscape: nudge-scroll so Safari can collapse toolbars; tip if not installed to Home Screen.
  useEffect(() => {
    if (!iosLandscapeCinema) {
      setIosBrowserChromeCollapse(false);
      if (!cssImmersiveRef.current) setBodyScrollLocked(false);
      setShowHomeScreenTip(false);
      return;
    }

    // Standalone PWA already has no browser chrome — just lock.
    if (isStandalone) {
      setIosBrowserChromeCollapse(false);
      setBodyScrollLocked(true);
      setShowHomeScreenTip(false);
      return () => {
        if (!cssImmersiveRef.current) setBodyScrollLocked(false);
      };
    }

    setBodyScrollLocked(false);
    setIosBrowserChromeCollapse(true);

    let tipTimer: number | null = null;
    try {
      const dismissed = sessionStorage.getItem('npl-live-homescreen-tip') === '1';
      if (!dismissed) {
        tipTimer = window.setTimeout(() => setShowHomeScreenTip(true), 600);
      }
    } catch {
      tipTimer = window.setTimeout(() => setShowHomeScreenTip(true), 600);
    }

    return () => {
      if (tipTimer !== null) window.clearTimeout(tipTimer);
      setIosBrowserChromeCollapse(false);
      setShowHomeScreenTip(false);
    };
  }, [iosLandscapeCinema, isStandalone]);

  /**
   * Single stable player mount (videoId only).
   * iOS: YouTube controls on, no keep-alive, no remount — WebKit-friendly.
   * Desktop: controls off + light keep-alive for overlay use.
   */
  useEffect(() => {
    soundOnRef.current = false;
    userStartedRef.current = !iosLike;
    setSoundOn(false);
    setPlaybackError(null);
    setShowPlayGate(Boolean(videoId) && iosLike);
    cssImmersiveRef.current = false;
    setCssImmersive(false);
    setIsFullscreen(false);
    setBodyScrollLocked(false);
    setIosBrowserChromeCollapse(false);
    setShowHomeScreenTip(false);

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
      setShowPlayGate(false);
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

        const playingState = window.YT.PlayerState?.PLAYING ?? 1;
        const pausedState = window.YT.PlayerState?.PAUSED ?? 2;
        const endedState = window.YT.PlayerState?.ENDED ?? 0;
        const cuedState = window.YT.PlayerState?.CUED ?? 5;

        const player = new window.YT.Player(PLAYER_ELEMENT_ID, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 1,
            mute: 1,
            // iOS: keep YT play/volume controls, but fs:0 so native video fullscreen
            // does not cover the page (HTML score overlay cannot appear there).
            controls: iosLike ? 1 : 0,
            disablekb: iosLike ? 0 : 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            origin: window.location.origin
          },
          events: {
            onReady: (e) => {
              hardenYouTubeIframe(e.target);
              playMuted(e.target);
            },
            onStateChange: (e) => {
              if (e.data === playingState) {
                setShowPlayGate(false);
              }
              // Desktop overlay only: nudge muted playback if the stream stalls.
              // Never do this on iOS — it fights user pause / native controls.
              if (iosLike || !userStartedRef.current) return;
              if (e.data === pausedState || e.data === endedState || e.data === cuedState) {
                if (soundOnRef.current) {
                  playWithSound(e.target);
                } else {
                  playMuted(e.target);
                }
              }
            },
            onError: (e) => {
              console.error('YouTube player error:', e.data);
              setPlaybackError('Unable to play this YouTube stream on this device.');
              setShowPlayGate(true);
            }
          }
        });
        playerRef.current = player;

        if (keepAliveRef.current !== null) {
          window.clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }

        // Desktop venue screens only — skip entirely on iOS.
        if (!iosLike) {
          keepAliveRef.current = window.setInterval(() => {
            const p = playerRef.current;
            if (!p || !userStartedRef.current) return;
            const state = typeof p.getPlayerState === 'function' ? p.getPlayerState() : -1;
            const buffering = window.YT?.PlayerState?.BUFFERING ?? 3;
            if (state === playingState || state === buffering) return;
            if (soundOnRef.current) playWithSound(p);
            else playMuted(p);
          }, 5000);
        }
      } catch (err) {
        console.error('YouTube live player setup failed:', err);
        setPlaybackError('Failed to load YouTube player.');
        setShowPlayGate(true);
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
    // iosLike is device-constant for the page lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const handleUserPlay = () => {
    const player = playerRef.current;
    if (!player) {
      setShowPlayGate(true);
      setPlaybackError('Player is still loading — tap again in a moment.');
      return;
    }
    setPlaybackError(null);
    userStartedRef.current = true;
    soundOnRef.current = true;
    setSoundOn(true);
    hardenYouTubeIframe(player);
    playWithSound(player);
    setShowPlayGate(false);
  };

  const handleToggleSound = () => {
    const player = playerRef.current;
    if (!player) return;
    userStartedRef.current = true;
    if (soundOnRef.current) {
      soundOnRef.current = false;
      setSoundOn(false);
      try {
        player.mute();
      } catch {
        /* ignore */
      }
      return;
    }
    soundOnRef.current = true;
    setSoundOn(true);
    playWithSound(player);
  };

  /**
   * Fullscreen: native API on desktop / Android / many iPads.
   * iPhone: stay inline (playsinline + fs:0) so the score overlay remains visible.
   */
  const enterLiveFullscreen = async (): Promise<void> => {
    const root = liveRootRef.current;
    if (!root) return;

    // Native YouTube fullscreen on iPhone hides our score — keep the full-bleed page instead.
    if (iphone) {
      setPlaybackError(
        'On iPhone the score stays on screen in this view. YouTube full screen would hide the score.'
      );
      return;
    }

    // Fullscreen the /live root (not the YouTube iframe) so the score stays visible.
    const mode = await enterNativeFullscreen(root);
    if (mode === 'native') {
      cssImmersiveRef.current = false;
      setCssImmersive(false);
      setBodyScrollLocked(false);
      setIsFullscreen(true);
      setPlaybackError(null);
      return;
    }

    cssImmersiveRef.current = true;
    setCssImmersive(true);
    setBodyScrollLocked(true);
    setIsFullscreen(true);
  };

  const exitLiveFullscreen = async (): Promise<void> => {
    cssImmersiveRef.current = false;
    setCssImmersive(false);
    setBodyScrollLocked(false);
    await exitNativeFullscreen();
    setIsFullscreen(false);
  };

  const handleToggleFullscreen = () => {
    if (isFullscreen || cssImmersiveRef.current || isElementNativeFullscreen(liveRootRef.current)) {
      void exitLiveFullscreen();
      return;
    }
    void enterLiveFullscreen();
  };

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
    deuceActive: !!match.deuceActive,
    goldenPoint: isGoldenPoint(match)
  };

  const currentFixtureId =
    typeof match.currentMatchId === 'string' ? match.currentMatchId.trim() : '';

  if (hasSeriesWinner(match)) {
    phase = 'final';
    display = {
      ...display,
      winnerSide: match.matchWinner === 2 ? 2 : 1
    };
  } else if (!isMatchInProgress(match) && currentFixtureId) {
    const sticky = heldResult || latestCompleted;
    if (sticky && sticky.fixtureId === currentFixtureId) {
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
        deuceActive: false,
        goldenPoint: false
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
        className={`${compactOnly} items-center gap-1 w-max max-w-[min(85vw,18rem)] landscape:max-w-[min(55vw,16rem)] rounded-lg bg-black/85 border border-white/25 px-2 py-1.5 shadow-lg ring-1 ring-black/40`}
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
              {phase === 'live' && display.goldenPoint ? (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse border border-amber-400/40">
                  Golden
                </span>
              ) : phase === 'live' && display.deuceActive ? (
                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse border border-red-500/30">
                  Deuce
                </span>
              ) : null}
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

  // absolute (not fixed) so the score stays inside the fullscreen root on laptop/desktop.
  const overlayAnchorClass = iosLandscapeCinema
    ? 'absolute z-[60] pointer-events-none top-[max(0.25rem,env(safe-area-inset-top))] right-[max(0.25rem,env(safe-area-inset-right))]'
    : 'absolute z-[60] pointer-events-none top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))]';

  if (videoId) {
    return (
      <div
        ref={liveRootRef}
        className={`fixed inset-0 bg-black overflow-hidden select-none ${
          cssImmersive || iosLandscapeCinema ? 'npl-live-immersive' : ''
        }`}
      >
        <div
          id={PLAYER_HOST_ID}
          className="absolute inset-0 w-full h-full [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:border-0"
        />

        {/* Desktop only — iOS must reach YouTube controls (portrait). */}
        {!iosLike && !showPlayGate && (
          <div
            className="absolute inset-0 z-20 bg-transparent cursor-default"
            aria-hidden="true"
            onContextMenu={(e) => e.preventDefault()}
          />
        )}

        {/* iOS landscape: block taps on YT chrome so the picture stays clean; score stays usable. */}
        {iosLandscapeCinema && (
          <div
            className="absolute inset-0 z-20 bg-transparent"
            aria-hidden="true"
            onContextMenu={(e) => e.preventDefault()}
          />
        )}

        {showPlayGate && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-black/60 px-6 text-center">
            <button
              type="button"
              onClick={handleUserPlay}
              className="rounded-xl bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-950 shadow-md active:scale-[0.98]"
            >
              Tap to Play with Sound
            </button>
            {playbackError && (
              <p className="max-w-sm text-xs text-red-300" role="alert">
                {playbackError}
              </p>
            )}
          </div>
        )}

        {/* Compact portal exit — corner chip, does not cover the video center */}
        <Link
          to="/"
          className="absolute z-50 top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] pointer-events-auto rounded-md bg-black/45 hover:bg-black/70 text-white/85 hover:text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-1 border border-white/15 backdrop-blur-[2px]"
          aria-label="Back to portal"
        >
          ← Portal
        </Link>

        {/* Portrait (or non-iOS): show Sound / Full Screen. Hidden in iOS landscape cinema. */}
        {!showPlayGate && !iosLandscapeCinema && (
          <div className="absolute z-40 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] pointer-events-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide shadow-lg border ${
                soundOn
                  ? 'bg-slate-900/80 text-white border-white/20'
                  : 'bg-amber-400 text-slate-950 border-amber-300'
              }`}
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Mute stream' : 'Unmute stream'}
            >
              {soundOn ? 'Mute' : 'Sound'}
            </button>
            {!iphone && (
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className={`rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide shadow-lg border ${
                  isFullscreen
                    ? 'bg-indigo-500 text-white border-indigo-300'
                    : 'bg-slate-900/80 text-white border-white/20'
                }`}
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            )}
          </div>
        )}

        {playbackError && !showPlayGate && !iosLandscapeCinema && (
          <p
            className="absolute z-40 bottom-[max(3.5rem,calc(env(safe-area-inset-bottom)+3rem))] left-[max(0.75rem,env(safe-area-inset-left))] right-4 max-w-sm text-[11px] text-amber-200 bg-black/70 rounded-lg px-3 py-2"
            role="status"
          >
            {playbackError}
          </p>
        )}

        {showHomeScreenTip && iosLandscapeCinema && !isStandalone && (
          <div className="absolute z-[70] inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-center px-3 pointer-events-none">
            <div className="pointer-events-auto max-w-md rounded-xl bg-amber-400 text-slate-950 px-4 py-3 shadow-xl space-y-2">
              <p className="text-[11px] font-bold leading-snug">
                iOS cannot hide the address bar in a normal Safari/Chrome tab. For true fullscreen:
                Share → Add to Home Screen, then open <span className="underline">NPL Live</span>{' '}
                from your home screen.
              </p>
              <button
                type="button"
                className="text-[11px] font-black uppercase tracking-wide underline"
                onClick={() => {
                  setShowHomeScreenTip(false);
                  try {
                    sessionStorage.setItem('npl-live-homescreen-tip', '1');
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        <div className={overlayAnchorClass}>{scoreBug}</div>
      </div>
    );
  }

  return (
    <div
      ref={liveRootRef}
      className={`fixed inset-0 bg-slate-950 overflow-hidden select-none ${
        cssImmersive ? 'npl-live-immersive' : ''
      }`}
    >
      {!iphone && (
        <div className="absolute z-40 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] pointer-events-auto">
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide shadow-lg border ${
              isFullscreen
                ? 'bg-indigo-500 text-white border-indigo-300'
                : 'bg-slate-900/80 text-white border-white/20'
            }`}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
      )}
      <div className={overlayAnchorClass}>{scoreBug}</div>
    </div>
  );
};

export default StreamOverlay;
