/**
 * Compact “N watching” chip for /live.
 * Input validation: non-finite / negative counts render as 0.
 */
export function LiveViewerCountBadge({ count }: { count: number }) {
  const safe =
    typeof count === 'number' && Number.isFinite(count) && count > 0
      ? Math.floor(count)
      : 0;

  if (safe <= 0) return null;

  const label = safe === 1 ? '1 watching' : `${safe} watching`;

  return (
    <div
      className="pointer-events-none rounded-full bg-slate-900/85 text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 border border-white/25 shadow-lg tabular-nums"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" aria-hidden />
      {label}
    </div>
  );
}

export default LiveViewerCountBadge;
