import { SITE } from '../lib/site';

/**
 * The community's badge: its short name (SOCIETY_SHORT_NAME, or the
 * initials of SOCIETY_NAME) on a green tile. Size it with className.
 */
export function SiteLogo({ className = 'size-12', decorative = false }: { className?: string; decorative?: boolean }) {
  const text = SITE.shortName.slice(0, 4);
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : SITE.name}
      aria-hidden={decorative || undefined}
      className={`inline-grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 font-black uppercase text-amber-300 select-none ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <span style={{ fontSize: text.length > 2 ? '30cqw' : '40cqw', letterSpacing: '0.02em', lineHeight: 1 }}>{text}</span>
    </span>
  );
}
