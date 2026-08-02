import { useEffect } from 'react';
import { FireworksCanvas } from './FireworksCanvas';

const AUTO_DISMISS_MS = 4500;

type LiveWinCelebrationProps = {
  onDismiss: () => void;
};

/**
 * Score-bug-local fireworks for /live (not a center-page modal).
 * Parent must be `position: relative` and sized to the score overlay.
 * Auto-dismisses after a short burst. Input: onDismiss must be a function.
 */
export function LiveWinCelebration({ onDismiss }: LiveWinCelebrationProps) {
  useEffect(() => {
    if (typeof onDismiss !== 'function') return;
    const id = window.setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-[inherit]"
      aria-hidden="true"
    >
      <FireworksCanvas contain className="pointer-events-none absolute inset-0" />
    </div>
  );
}

export default LiveWinCelebration;
