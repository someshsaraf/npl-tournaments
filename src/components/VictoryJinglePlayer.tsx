import { useCallback, useEffect, useRef } from 'react';

/**
 * Victory jingle control (/scorer, /admin/score, /score).
 * Keeps a real in-viewport YouTube iframe (required for playback) and covers it
 * with an opaque bar so video is not shown. Off-screen/opacity-0 iframes are
 * blocked from playing by browsers/YouTube.
 *
 * Security: parent must pass an allowlisted embed URL only.
 * Input validation: rejects non-https youtube-nocookie embed URLs.
 */
export function VictoryJinglePlayer({
  embedSrc,
  onClose
}: {
  embedSrc: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const sendYtCommand = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        'https://www.youtube-nocookie.com'
      );
    } catch {
      /* cross-origin / not ready */
    }
  }, []);

  const kickPlayback = useCallback(() => {
    sendYtCommand('playVideo');
    sendYtCommand('unMute');
    sendYtCommand('setVolume', [100]);
  }, [sendYtCommand]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;
    const timers: number[] = [];

    const onLoad = () => {
      if (cancelled) return;
      kickPlayback();
      timers.push(window.setTimeout(kickPlayback, 400));
      timers.push(window.setTimeout(kickPlayback, 1200));
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      cancelled = true;
      iframe.removeEventListener('load', onLoad);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [embedSrc, kickPlayback]);

  if (
    typeof embedSrc !== 'string' ||
    !embedSrc.startsWith('https://www.youtube-nocookie.com/embed/') ||
    embedSrc.includes('..')
  ) {
    return null;
  }
  if (typeof onClose !== 'function') return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-[80] w-[min(100vw-1.5rem,17rem)] rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 shadow-2xl shadow-black/50"
      role="complementary"
      aria-label="Victory music"
    >
      <div className="relative h-14 w-full overflow-hidden bg-slate-950">
        <iframe
          ref={iframeRef}
          title="Victory jingle audio"
          src={embedSrc}
          className="pointer-events-none absolute left-0 top-0 h-[180px] w-full border-0"
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          allowFullScreen={false}
          referrerPolicy="strict-origin-when-cross-origin"
          aria-hidden
        />
        <div className="absolute inset-0 z-10 flex items-center justify-between gap-2 bg-slate-950 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 truncate">
              Victory music
            </p>
            <p className="text-[9px] text-slate-500 truncate">Tap Sound if silent</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={kickPlayback}
              className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-950 hover:bg-emerald-400 active:scale-95"
            >
              Sound
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white hover:bg-rose-400 active:scale-95 shadow-md shadow-rose-500/30"
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VictoryJinglePlayer;
