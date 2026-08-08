import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { isValidYouTubeVideoId } from '../utils/youtube';

const YT_API_SRC = 'https://www.youtube.com/iframe_api';

type YtPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement;
};

type YtPlayerEvent = { data: number; target: YtPlayer };

type YtNamespace = {
  Player: new (
    el: string | HTMLElement,
    opts: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: YtPlayerEvent) => void;
        onError?: () => void;
      };
    }
  ) => YtPlayer;
  PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
};

type YtWindow = Window & {
  YT?: YtNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

function ytWindow(): YtWindow {
  return window as YtWindow;
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API requires a browser window'));
  }
  const w = ytWindow();
  if (w.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } finally {
        resolve();
      }
    };

    if (document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (ytWindow().YT?.Player) {
          window.clearInterval(poll);
          resolve();
        } else if (Date.now() - started > 15_000) {
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

function hardenIframe(player: YtPlayer): void {
  try {
    const iframe = player.getIframe?.();
    if (!iframe) return;
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.style.pointerEvents = 'none';
  } catch {
    /* ignore */
  }
}

type RecordingsInPagePlayerProps = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
};

/**
 * In-portal YouTube player: iframe is not clickable (blocks youtube.com / app opens).
 * Play/Pause use the IFrame API from our own buttons.
 *
 * Concurrency: one player instance per mount; destroyed on video change / unmount.
 * Security: only accepts validated 11-char video IDs; https thumbnails only.
 */
export function RecordingsInPagePlayer({
  videoId,
  title,
  thumbnailUrl
}: RecordingsInPagePlayerProps) {
  const mountId = useId().replace(/:/g, '');
  const hostId = `npl-rec-yt-${mountId}`;
  const playerRef = useRef<YtPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const safeId = isValidYouTubeVideoId(videoId) ? videoId : null;
  const safeThumb =
    typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('https://')
      ? thumbnailUrl
      : null;
  const safeTitle =
    typeof title === 'string' && title.trim() ? title.trim() : 'Recording';

  // Tear down when video changes or unmounts.
  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setStarted(false);
    setPlayerError(null);
    setLoadingPlayer(false);
    const existing = playerRef.current;
    playerRef.current = null;
    if (existing) {
      try {
        existing.destroy();
      } catch {
        /* ignore */
      }
    }
  }, [safeId]);

  useEffect(() => {
    return () => {
      const existing = playerRef.current;
      playerRef.current = null;
      if (existing) {
        try {
          existing.destroy();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const ensurePlayer = useCallback(async (): Promise<YtPlayer | null> => {
    if (!safeId) return null;
    if (playerRef.current) return playerRef.current;

    setLoadingPlayer(true);
    setPlayerError(null);
    try {
      await loadYouTubeApi();
      const YT = ytWindow().YT;
      if (!YT?.Player) {
        throw new Error('YouTube player unavailable');
      }
      const host = document.getElementById(hostId);
      if (!host) throw new Error('Player host missing');
      host.replaceChildren();
      const mount = document.createElement('div');
      mount.className = 'w-full h-full';
      host.appendChild(mount);

      const player = await new Promise<YtPlayer>((resolve, reject) => {
        let settled = false;
        const origin =
          typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : '';
        new YT.Player(mount, {
          width: '100%',
          height: '100%',
          videoId: safeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            ...(origin ? { origin } : {})
          },
          events: {
            onReady: (e) => {
              if (settled) return;
              settled = true;
              hardenIframe(e.target);
              resolve(e.target);
            },
            onStateChange: (e) => {
              hardenIframe(e.target);
              const playingState = ytWindow().YT?.PlayerState?.PLAYING ?? 1;
              const pausedState = ytWindow().YT?.PlayerState?.PAUSED ?? 2;
              const endedState = ytWindow().YT?.PlayerState?.ENDED ?? 0;
              if (e.data === playingState) setPlaying(true);
              if (e.data === pausedState || e.data === endedState) setPlaying(false);
            },
            onError: () => {
              if (!settled) {
                settled = true;
                reject(new Error('YouTube failed to load this video'));
              } else {
                setPlayerError('Could not play this recording in the portal.');
              }
            }
          }
        });
        window.setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('YouTube player timed out'));
          }
        }, 20_000);
      });

      playerRef.current = player;
      setReady(true);
      return player;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to start in-page player.';
      setPlayerError(message);
      return null;
    } finally {
      setLoadingPlayer(false);
    }
  }, [hostId, safeId]);

  const handleTogglePlay = async () => {
    if (!safeId) return;
    const player = await ensurePlayer();
    if (!player) return;
    setStarted(true);
    try {
      const state = player.getPlayerState();
      const playingState = ytWindow().YT?.PlayerState?.PLAYING ?? 1;
      if (state === playingState) {
        player.pauseVideo();
        setPlaying(false);
      } else {
        player.playVideo();
        setPlaying(true);
      }
    } catch {
      setPlayerError('Playback control failed. Try another recording.');
    }
  };

  if (!safeId) {
    return (
      <p className="text-sm text-amber-200 p-4">Invalid recording id.</p>
    );
  }

  return (
    <section
      className="rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl shadow-black/40"
      aria-label="Selected recording"
    >
      <div className="relative aspect-video w-full bg-black">
        {/* YouTube host — never receives clicks */}
        <div
          id={hostId}
          className="absolute inset-0 w-full h-full pointer-events-none [&_iframe]:!pointer-events-none [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:border-0"
          aria-hidden
        />

        {/* Poster until the user starts playback with our control */}
        {!started ? (
          <div className="absolute inset-0 z-[5]">
            {safeThumb ? (
              <img
                src={safeThumb}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="h-full w-full bg-slate-950" />
            )}
            <div className="absolute inset-0 bg-black/45" />
          </div>
        ) : null}

        {/* Full click shield + our play/pause (never opens youtube.com / app) */}
        <button
          type="button"
          onClick={() => {
            void handleTogglePlay();
          }}
          className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80"
          aria-label={playing ? 'Pause recording' : 'Play recording'}
        >
          <span className="inline-flex items-center justify-center rounded-full bg-emerald-500 text-slate-950 size-16 sm:size-20 shadow-lg shadow-black/40 active:scale-95">
            {loadingPlayer ? (
              <Loader2 className="size-8 animate-spin" aria-hidden />
            ) : playing ? (
              <Pause className="size-8 fill-current" aria-hidden />
            ) : (
              <Play className="size-8 fill-current ml-1" aria-hidden />
            )}
          </span>
        </button>
      </div>

      <div className="px-4 py-3 sm:px-5 sm:py-4 bg-slate-900/95 border-t border-slate-800">
        <p className="font-bold text-white text-base sm:text-lg leading-snug">{safeTitle}</p>
        {playerError ? (
          <p className="text-sm text-amber-300 mt-1" role="alert">
            {playerError}
          </p>
        ) : (
          <p className="text-sm text-slate-400 mt-1">
            {ready || started
              ? 'Playing in the portal — use the button to play or pause'
              : 'Tap play to watch here (stays in the portal)'}
          </p>
        )}
      </div>
    </section>
  );
}

export default RecordingsInPagePlayer;
