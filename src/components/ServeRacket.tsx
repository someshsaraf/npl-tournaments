type ServeRacketProps = {
  className?: string;
  title?: string;
  /** Pixel size (width & height). Default 28. */
  size?: number;
  /** Kept for callers; the badge is only rendered for the server. */
  active?: boolean;
};

/**
 * Serve indicator — a shuttlecock badge, rendered only for the side that is
 * serving. Drawn inline (no image file). Stateless.
 */
export function ServeRacket({ className = '', title = 'Serving', size = 28 }: ServeRacketProps) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 28;
  return (
    <svg
      viewBox="0 0 32 32"
      width={safeSize}
      height={safeSize}
      role="img"
      aria-label={title}
      className={`shrink-0 rounded-md ${className}`.trim()}
      style={{ boxShadow: '0 0 0 2px rgba(52, 211, 153, 0.7)' }}
    >
      <title>{title}</title>
      <rect width="32" height="32" rx="6" fill="#0f172a" />
      <path d="M10 5 L16 19 L22 5 Z" fill="#f8fafc" />
      <path d="M13 5 L16 19 M19 5 L16 19 M10 9 H22 M11.5 13 H20.5" stroke="#cbd5e1" strokeWidth="0.8" fill="none" />
      <circle cx="16" cy="22.5" r="4.5" fill="#bef264" />
    </svg>
  );
}

export default ServeRacket;
