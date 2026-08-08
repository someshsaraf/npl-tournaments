/**
 * Audio-only victory jingle control (/scorer, /admin/score, /score).
 * YouTube iframe stays mounted for playback but is visually hidden — no video chrome.
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
      className="fixed bottom-3 right-3 z-[80] w-[min(100vw-1.5rem,14rem)] rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950/95 shadow-2xl shadow-black/50"
      role="complementary"
      aria-label="Victory music"
    >
      {/* Off-screen player — keeps YouTube autoplay working without showing video */}
      <iframe
        title="Victory jingle audio"
        src={embedSrc}
        className="pointer-events-none absolute -left-[9999px] top-0 h-[180px] w-[320px] border-0 opacity-0"
        tabIndex={-1}
        allow="autoplay; encrypted-media"
        allowFullScreen={false}
        referrerPolicy="strict-origin-when-cross-origin"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 truncate">
            Victory music
          </p>
          <p className="text-[9px] text-slate-500">Audio only · stops after 1 min</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white hover:bg-rose-400 active:scale-95 shadow-md shadow-rose-500/30"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export default VictoryJinglePlayer;
