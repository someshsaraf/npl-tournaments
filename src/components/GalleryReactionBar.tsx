import type { GalleryEmoji, GalleryEmojiCounts } from '../utils/galleryEmoji';
import { GALLERY_EMOJI_OPTIONS } from '../utils/galleryEmoji';

type GalleryReactionBarProps = {
  photoKey: string;
  state: GalleryEmojiCounts;
  busy: boolean;
  /**
   * `rail` — vertical stack (top→bottom), for overlay on photos.
   * `row` — horizontal, for rare non-overlay use.
   */
  layout?: 'rail' | 'row';
  /** Larger hit targets for lightbox. */
  size?: 'compact' | 'comfortable';
  onToggle: (photoKey: string, emoji: GalleryEmoji, mine: GalleryEmoji | null) => void;
};

/**
 * Emoji reaction controls for a gallery photo.
 * Default aesthetic: vertical rail overlaid on the photo (top-right).
 *
 * Concurrency: parent owns busy/state; this is presentational.
 * Security: only renders allowlisted emojis from GALLERY_EMOJI_OPTIONS.
 * Input: photoKey non-empty; onToggle required.
 */
export function GalleryReactionBar({
  photoKey,
  state,
  busy,
  layout = 'rail',
  size = 'compact',
  onToggle
}: GalleryReactionBarProps) {
  if (typeof photoKey !== 'string' || !photoKey.trim()) {
    return null;
  }
  if (typeof onToggle !== 'function') {
    return null;
  }
  if (layout !== 'rail' && layout !== 'row') {
    return null;
  }
  if (size !== 'compact' && size !== 'comfortable') {
    return null;
  }

  const mine = state?.mine ?? null;
  const counts = state?.counts ?? {};
  const comfortable = size === 'comfortable';
  const isRail = layout === 'rail';

  return (
    <div
      className={
        isRail
          ? comfortable
            ? 'flex flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-black/55 p-1.5 shadow-lg backdrop-blur-sm'
            : 'flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-black/55 p-0.5 shadow-md backdrop-blur-sm'
          : 'flex flex-wrap items-center justify-center gap-2'
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
                  ? 'inline-flex min-w-[2.5rem] flex-col items-center justify-center rounded-xl border border-emerald-400/70 bg-emerald-500/25 px-1.5 py-1 text-lg leading-none hover:bg-emerald-500/35 disabled:opacity-50'
                  : 'inline-flex min-w-[2.5rem] flex-col items-center justify-center rounded-xl border border-transparent bg-white/5 px-1.5 py-1 text-lg leading-none hover:bg-white/15 disabled:opacity-50'
                : selected
                  ? 'inline-flex min-w-[1.75rem] flex-col items-center justify-center rounded-lg border border-emerald-400/60 bg-emerald-500/25 px-1 py-0.5 text-sm leading-none hover:bg-emerald-500/35 disabled:opacity-50'
                  : 'inline-flex min-w-[1.75rem] flex-col items-center justify-center rounded-lg border border-transparent px-1 py-0.5 text-sm leading-none hover:bg-white/15 disabled:opacity-50'
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
                    ? 'mt-0.5 text-[10px] font-bold tabular-nums text-slate-200'
                    : 'text-[8px] font-bold tabular-nums text-slate-300'
                }
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
