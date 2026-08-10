import type { GalleryEmoji, GalleryEmojiCounts } from '../utils/galleryEmoji';
import { GALLERY_EMOJI_OPTIONS } from '../utils/galleryEmoji';

type GalleryReactionBarProps = {
  photoKey: string;
  state: GalleryEmojiCounts;
  busy: boolean;
  /** Larger controls for lightbox; compact for grid cards. */
  size?: 'compact' | 'comfortable';
  onToggle: (photoKey: string, emoji: GalleryEmoji, mine: GalleryEmoji | null) => void;
};

/**
 * Emoji reaction controls for a gallery photo.
 * Concurrency: parent owns busy/state; this is presentational.
 * Security: only renders allowlisted emojis from GALLERY_EMOJI_OPTIONS.
 * Input: photoKey non-empty; state.mine null or allowlisted (caller-validated).
 */
export function GalleryReactionBar({
  photoKey,
  state,
  busy,
  size = 'compact',
  onToggle
}: GalleryReactionBarProps) {
  if (typeof photoKey !== 'string' || !photoKey.trim()) {
    return null;
  }
  if (typeof onToggle !== 'function') {
    return null;
  }
  const comfortable = size === 'comfortable';
  const mine = state?.mine ?? null;
  const counts = state?.counts ?? {};

  return (
    <div className={comfortable ? 'space-y-2' : undefined}>
      {comfortable ? (
        <p className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
          React
        </p>
      ) : null}
      <div
        className={
          comfortable
            ? 'flex flex-wrap items-center justify-center gap-2'
            : 'flex flex-wrap items-center justify-center gap-0.5'
        }
        role="group"
        aria-label="React to this photo"
      >
        {GALLERY_EMOJI_OPTIONS.map((emoji) => {
          const count = counts[emoji] ?? 0;
          const selected = mine === emoji;
          return (
            <button
              key={emoji}
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(photoKey, emoji, mine);
              }}
              className={
                comfortable
                  ? selected
                    ? 'inline-flex items-center gap-1 rounded-full border border-emerald-400/80 bg-emerald-500/20 px-3 py-1.5 text-lg hover:bg-emerald-500/30 disabled:opacity-50'
                    : 'inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-900/80 px-3 py-1.5 text-lg hover:border-white/40 hover:bg-slate-800 disabled:opacity-50'
                  : selected
                    ? 'rounded-md bg-emerald-500/25 px-1.5 py-0.5 text-sm hover:bg-emerald-500/40 disabled:opacity-50'
                    : 'rounded-md px-1.5 py-0.5 text-sm opacity-80 hover:bg-slate-800 hover:opacity-100 disabled:opacity-50'
              }
              aria-pressed={selected}
              aria-label={
                selected
                  ? `Remove ${emoji} reaction`
                  : `React with ${emoji}${count > 0 ? `, ${count} so far` : ''}`
              }
              title={selected ? 'Remove your reaction' : 'React'}
            >
              <span aria-hidden>{emoji}</span>
              {count > 0 ? (
                <span
                  className={
                    comfortable
                      ? 'text-[11px] font-bold text-slate-300'
                      : 'ml-0.5 text-[9px] font-bold text-slate-400'
                  }
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
