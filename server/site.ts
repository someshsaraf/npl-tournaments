import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { Request, Response } from 'express';
import type { Store } from './store.js';
import { mediaDir } from './media.js';
import {
  SITE_BACKGROUND_URL,
  SITE_IMAGES_TOP,
  parseSiteImages,
  siteNames,
  type SiteConfig
} from '../src/data/site.js';

/**
 * The society's name (SOCIETY_NAME / SOCIETY_SHORT_NAME / LEAGUE_NAME in .env) and the
 * admin-chosen main background, written into every page as window.__SITE__
 * so they show before anyone has entered the code.
 */

export function siteConfig(store: Store): SiteConfig {
  const names = siteNames(process.env.SOCIETY_NAME, process.env.SOCIETY_SHORT_NAME, process.env.LEAGUE_NAME);
  const bg = parseSiteImages(store.get(SITE_IMAGES_TOP)).background;
  // The version makes browsers fetch a newly chosen background straight away.
  const background = bg ? `${SITE_BACKGROUND_URL}?v=${createHash('sha256').update(bg).digest('hex').slice(0, 10)}` : '';
  return { ...names, background };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** index.html with the society name filled in and window.__SITE__ set. */
export function renderIndexHtml(template: string, site: SiteConfig): string {
  const json = JSON.stringify(site).replace(/</g, '\\u003c');
  return template
    .replace(/__SOCIETY_NAME__/g, escapeHtml(site.name))
    .replace('</head>', `<script>window.__SITE__=${json}</script>\n</head>`);
}

/**
 * GET /api/site/background — the chosen main background, without the code
 * (it's the backdrop of the code-entry screen). Only that one photo.
 */
export function serveBackground(store: Store) {
  return (_req: Request, res: Response) => {
    const bg = parseSiteImages(store.get(SITE_IMAGES_TOP)).background;
    if (!bg) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (bg.startsWith('https://')) {
      res.redirect(302, bg);
      return;
    }
    // /media/gallery/{id}/{file} — validated by parseSiteImages.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolve(mediaDir(), bg.slice('/media/'.length)), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  };
}
