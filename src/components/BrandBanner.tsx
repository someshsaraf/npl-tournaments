import { SITE } from '../lib/site';
import { SiteLogo } from './SiteLogo';

type BrandBannerProps = {
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show subtitle under the society name */
  subtitle?: string;
};

const SIZE = {
  sm: { logo: 32, title: 'text-base sm:text-lg', gap: 'gap-2.5' },
  md: { logo: 44, title: 'text-xl sm:text-2xl', gap: 'gap-3' },
  lg: { logo: 56, title: 'text-2xl sm:text-3xl', gap: 'gap-3.5' }
} as const;

/**
 * Centered society-name brand banner with attention-catching motion.
 * Stateless presentational component (CSS animation only; no shared timers).
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
    <div
      className={`npl-brand-banner flex flex-col items-center justify-center text-center ${className}`.trim()}
      role="banner"
      aria-label={SITE.name}
    >
      <div className={`npl-brand-glow flex items-center justify-center ${s.gap}`}>
        <span
          className="npl-brand-logo shrink-0 rounded-lg shadow-md ring-1 ring-amber-200/60"
          style={{ width: s.logo, height: s.logo }}
        >
          <SiteLogo className="size-full rounded-lg" />
        </span>
        <div className="min-w-0 leading-tight text-left">
          <p
            className={`npl-brand-title font-black tracking-[0.12em] uppercase truncate ${s.title}`}
          >
            {SITE.name}
          </p>
          {safeSubtitle ? (
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
              {safeSubtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default BrandBanner;
