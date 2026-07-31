type BrandBannerProps = {
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show subtitle under NPL 2026 */
  subtitle?: string;
};

const LOGO_SRC = '/nature-walk-logo-1.png';

const SIZE = {
  sm: { logo: 28, title: 'text-sm sm:text-base', gap: 'gap-2' },
  md: { logo: 40, title: 'text-lg sm:text-xl', gap: 'gap-2.5' },
  lg: { logo: 52, title: 'text-xl sm:text-2xl', gap: 'gap-3' }
} as const;

/**
 * NPL 2026 brand mark: Renaissance logo + banner text.
 * Stateless presentational component.
 */
export function BrandBanner({
  size = 'md',
  className = '',
  subtitle
}: BrandBannerProps) {
  const s = SIZE[size] ?? SIZE.md;
  const safeSubtitle =
    typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : null;

  return (
    <div className={`flex items-center ${s.gap} min-w-0 ${className}`.trim()}>
      <img
        src={LOGO_SRC}
        alt="Renaissance Nature Walk"
        width={s.logo}
        height={s.logo}
        className="rounded-md object-cover shrink-0 shadow-sm ring-1 ring-white/10"
        style={{ width: s.logo, height: s.logo }}
        draggable={false}
      />
      <div className="min-w-0 leading-tight">
        <p
          className={`font-black tracking-wide text-amber-300 truncate ${s.title}`}
        >
          NPL 2026
        </p>
        {safeSubtitle ? (
          <p className="text-[10px] sm:text-xs text-slate-400 truncate">{safeSubtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export default BrandBanner;
