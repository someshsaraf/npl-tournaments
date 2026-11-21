import { useEffect, useRef, useState } from 'react';
import { Check, ImageOff, X } from 'lucide-react';
import { ref, remove, set } from '../lib/realtime';
import { db } from '../db';
import {
  SITE_IMAGES_TOP,
  SITE_SPORT_SLUGS,
  type SiteImages,
  type SiteSportSlug
} from '../data/site';
import { SPORT_CARDS, sportCardBySport, sportFromGalleryEventId } from '../data/sports';
import type { GalleryUploadRecord } from '../utils/galleryUploads';

interface Slot {
  /** Path under siteImages, e.g. "background" or "lawn-tennis/hero". */
  path: string;
  label: string;
  hint: string;
  url: string;
  /** Photos of this sport are listed first in the picker. */
  slug?: SiteSportSlug;
}

const labelOf = (slug: SiteSportSlug) => SPORT_CARDS.find((c) => c.slug === slug)?.label ?? slug;

function slotsOf(images: SiteImages): Slot[] {
  const out: Slot[] = [
    {
      path: 'background',
      label: 'Main background',
      hint: 'Behind the code-entry screen. Shown before the code is entered.',
      url: images.background
    }
  ];
  for (const slug of SITE_SPORT_SLUGS) {
    out.push(
      { path: `${slug}/hero`, label: `${labelOf(slug)} · banner`, hint: 'Wide photo at the top of the sport page.', url: images.sports[slug].hero, slug },
      { path: `${slug}/card`, label: `${labelOf(slug)} · home tile`, hint: 'Photo on the sport’s tile on the home page.', url: images.sports[slug].card, slug }
    );
  }
  return out;
}

const slugOfUpload = (r: GalleryUploadRecord): SiteSportSlug | null => {
  const sport = sportFromGalleryEventId(r.eventId);
  return sport ? sportCardBySport(sport).slug : null;
};

/** Admin: pick which uploaded photos the site uses (no photos live in the repo). */
export function SiteImagesPanel({ uploads, images }: { uploads: GalleryUploadRecord[]; images: SiteImages }) {
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photos = uploads.filter((u) => u.kind === 'image');
  const slots = slotsOf(images);
  const active = slots.find((s) => s.path === picking) ?? null;
  const pickerRef = useRef<HTMLDivElement>(null);
  // The picker opens below the slots — bring it into view (phones especially).
  useEffect(() => {
    if (picking) pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [picking]);

  const choose = async (path: string, url: string | null) => {
    setError(null);
    try {
      const target = ref(db, `${SITE_IMAGES_TOP}/${path}`);
      await (url ? set(target, url) : remove(target));
      setPicking(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  // The slot's own sport first, then everything else (newest first within each).
  const ordered = active?.slug
    ? [...photos.filter((p) => slugOfUpload(p) === active.slug), ...photos.filter((p) => slugOfUpload(p) !== active.slug)]
    : photos;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-lime-300">Site images</h2>
        <p className="text-xs text-slate-400 max-w-2xl">
          Choose which uploaded photos the site shows. Upload photos on the public Photos page first (tag them with a
          sport so they also appear in that sport’s photo strip). Anything not chosen shows a plain design.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <div
            key={slot.path}
            className={`rounded-xl border bg-slate-950/60 overflow-hidden ${picking === slot.path ? 'border-lime-400' : 'border-slate-800'}`}
          >
            <div className="relative aspect-[16/9] bg-slate-800">
              {slot.url ? (
                <img src={slot.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500 text-xs">
                  <ImageOff className="size-5" aria-hidden />
                  None chosen
                </div>
              )}
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-bold text-slate-100">{slot.label}</p>
                <p className="text-[11px] text-slate-500">{slot.hint}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPicking(picking === slot.path ? null : slot.path)}
                  className="rounded-lg bg-lime-300 text-slate-950 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide hover:bg-lime-200"
                >
                  {picking === slot.path ? 'Cancel' : slot.url ? 'Change' : 'Choose photo'}
                </button>
                {slot.url ? (
                  <button
                    type="button"
                    onClick={() => void choose(slot.path, null)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 hover:text-white"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-[11px] text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {active ? (
        <div ref={pickerRef} className="rounded-xl border border-lime-400/40 bg-slate-950/60 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-100">
              Pick a photo for <span className="text-lime-300">{active.label}</span>
            </p>
            <button
              type="button"
              onClick={() => setPicking(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close picker"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {ordered.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No photos uploaded yet — add some on the public Photos page.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[28rem] overflow-y-auto">
              {ordered.map((p) => {
                const current = p.url === active.url;
                const tag = slugOfUpload(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void choose(active.path, p.url)}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-lg border-2 ${
                      current ? 'border-lime-400' : 'border-transparent hover:border-slate-500'
                    }`}
                    title={p.title || p.fileName}
                  >
                    <img src={p.url} alt={p.title || ''} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    {tag ? (
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-200">
                        {labelOf(tag)}
                      </span>
                    ) : null}
                    {current ? (
                      <span className="absolute top-1 right-1 rounded-full bg-lime-300 p-0.5 text-slate-950">
                        <Check className="size-3" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
