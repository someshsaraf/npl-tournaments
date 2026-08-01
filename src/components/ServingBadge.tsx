type ServingBadgeProps = {
  /** Visual size for score desk vs audience board */
  size?: 'md' | 'lg';
  className?: string;
};

/**
 * Large, distance-readable serve indicator (text badge, not a small icon).
 * Stateless presentational component.
 */
export function ServingBadge({ size = 'md', className = '' }: ServingBadgeProps) {
  const large = size === 'lg';
  return (
    <div
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-xl border-2 font-black uppercase tracking-[0.2em] text-slate-950 bg-emerald-400 border-emerald-200 shadow-lg shadow-emerald-500/40 animate-pulse',
        large
          ? 'text-sm sm:text-base md:text-lg px-4 py-2'
          : 'text-xs sm:text-sm px-3 py-1.5',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label="This side is serving"
    >
      <span aria-hidden="true" className={large ? 'text-xl' : 'text-base'}>
        ●
      </span>
      Serving
    </div>
  );
}

export default ServingBadge;
