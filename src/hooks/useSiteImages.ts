import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db } from '../db';
import { SITE_IMAGES_TOP, parseSiteImages, type SiteImages, type SiteSportSlug, type SportImages } from '../data/site';
import { sportCardBySport, sportFromGalleryEventId } from '../data/sports';
import { subscribeGalleryUploads } from '../utils/galleryUploads';

// Last value seen, so pages opened later don't flash without photos.
let lastRaw: unknown = null;

/** The photos admins picked for the site (live). Empty strings = none chosen. */
export function useSiteImages(): SiteImages {
  const [raw, setRaw] = useState<unknown>(lastRaw);
  useEffect(
    () =>
      onValue(ref(db, SITE_IMAGES_TOP), (snap) => {
        lastRaw = snap.val();
        setRaw(lastRaw);
      }),
    []
  );
  return useMemo(() => parseSiteImages(raw), [raw]);
}

/** A sport's chosen banner and tile photos, plus its latest uploaded photos for the photo strip. */
export function useSportImages(slug: SiteSportSlug): SportImages & { gallery: string[] } {
  const images = useSiteImages();
  const [gallery, setGallery] = useState<string[]>([]);
  useEffect(
    () =>
      subscribeGalleryUploads(
        (records) =>
          setGallery(
            records
              .filter((r) => {
                const sport = r.kind === 'image' ? sportFromGalleryEventId(r.eventId) : null;
                return !!sport && sportCardBySport(sport).slug === slug;
              })
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 8)
              .map((r) => r.url)
          ),
        () => setGallery([])
      ),
    [slug]
  );
  return { ...images.sports[slug], gallery };
}
