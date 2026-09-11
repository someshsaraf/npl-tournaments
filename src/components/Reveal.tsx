import type { ReactNode } from 'react';
import { useInView } from '../hooks/useInView';

/**
 * Fades + slides a section in once it scrolls into view. One-shot (doesn't
 * re-hide on scroll away) so it never fights the user re-reading content.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = ''
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
      style={{ transitionDelay: inView ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

export default Reveal;
