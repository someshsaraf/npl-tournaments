import React from 'react';

type ServeRacketProps = {
  /** When true, racket is highlighted as the active server */
  active?: boolean;
  className?: string;
  title?: string;
  /** Pixel size (width & height). Default 28. */
  size?: number;
};

/**
 * Badminton racket indicator for who is serving.
 * Stateless; safe under concurrent React renders.
 */
export function ServeRacket({
  active = false,
  className = '',
  title = 'Serving',
  size = 28
}: ServeRacketProps) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 28;
  const stroke = active ? '#34d399' : '#64748b';
  const fill = active ? '#10b981' : 'transparent';
  const opacity = active ? 1 : 0.45;

  return (
    <svg
      width={safeSize}
      height={safeSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Head / oval */}
      <ellipse
        cx="28"
        cy="22"
        rx="16"
        ry="18"
        stroke={stroke}
        strokeWidth="3"
        fill={fill}
        fillOpacity={active ? 0.25 : 0}
      />
      {/* String grid */}
      <path
        d="M18 14v16M22 12v20M26 11v22M30 11v22M34 12v20M38 14v16"
        stroke={stroke}
        strokeWidth="1.2"
        opacity="0.7"
      />
      <path
        d="M14 16h28M13 20h30M12 24h32M13 28h30M14 32h28"
        stroke={stroke}
        strokeWidth="1.2"
        opacity="0.7"
      />
      {/* Throat */}
      <path
        d="M28 40c0-2 0-4 0-4"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Handle */}
      <path
        d="M28 40 L36 58"
        stroke={stroke}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Grip wrap */}
      <path
        d="M30.5 48 L34.5 56"
        stroke={active ? '#a7f3d0' : '#94a3b8'}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export default ServeRacket;
