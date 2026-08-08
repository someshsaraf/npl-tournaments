/**
 * Compact YouTube embed for victory jingles (/scorer, /admin/score, /score).
 * Corner player with an explicit Stop control (also auto-stops after 1 minute).
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
      className="fixed bottom-3 right-3 z-[80] w-[min(100vw-1.5rem,16rem)] rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 shadow-2xl shadow-black/50"
      role="complementary"
      aria-label="Victory music"
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-900/95 border-b border-slate-800">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 truncate">
            Victory music
          </p>
          <p className="text-[9px] text-slate-500">Stops after 1 min</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white hover:bg-rose-400 active:scale-95 shadow-md shadow-rose-500/30"
        >
          Stop
        </button>
      </div>
      <div className="relative aspect-video bg-black">
        <iframe
          title="Victory jingle"
          src={embedSrc}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen={false}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

export default VictoryJinglePlayer;
