import { ref, update } from '../lib/realtime';
import { db } from '../db';
import { SITE_IMAGES_TOP, type SiteImages } from '../data/site';

/**
 * Before deleting an upload: un-pick it everywhere it's used, so the site
 * doesn't point at a missing photo.
 */
export async function releaseSiteImage(images: SiteImages, url: string): Promise<void> {
  const clear: Record<string, null> = {};
  if (images.background === url) clear.background = null;
  for (const [slug, s] of Object.entries(images.sports)) {
    if (s.hero === url) clear[`${slug}/hero`] = null;
    if (s.card === url) clear[`${slug}/card`] = null;
  }
  if (Object.keys(clear).length) await update(ref(db, SITE_IMAGES_TOP), clear);
}
