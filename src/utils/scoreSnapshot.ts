import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import type { MatchState } from '../data/tournamentData';
import { formatGameScoresLine, formatGamesWonLabel, hasSeriesWinner } from './matchState';

export type ScoreSnapshotResult = {
  blob: Blob;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
};

function safeFilePart(raw: string, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
}

/**
 * Draws a shareable NPL score card on canvas (no DOM capture).
 * Concurrency: pure local canvas; caller owns the blob.
 * Validation: requires a finished series and finite scores.
 */
export function renderScoreSnapshotCanvas(match: MatchState): HTMLCanvasElement {
  if (!match || typeof match !== 'object') {
    throw new Error('renderScoreSnapshotCanvas: match is required');
  }
  if (!hasSeriesWinner(match)) {
    throw new Error('renderScoreSnapshotCanvas: series has no winner yet');
  }

  const w = 1080;
  const h = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const name1 = (match.player1 || match.teamA || 'Side A').trim().slice(0, 40);
  const name2 = (match.player2 || match.teamB || 'Side B').trim().slice(0, 40);
  const winnerSide = match.matchWinner === 2 ? 2 : 1;
  const winnerName = winnerSide === 1 ? name1 : name2;
  const score1 = Number.isFinite(match.score1) ? match.score1 : 0;
  const score2 = Number.isFinite(match.score2) ? match.score2 : 0;
  const isBo3 = match.bestOf === 3;
  const series = isBo3 ? formatGamesWonLabel(match) : `${score1}-${score2}`;
  const gamesLine = isBo3 ? formatGameScoresLine(match) : '';

  // Background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#020617');
  grad.addColorStop(0.55, '#0f172a');
  grad.addColorStop(1, '#064e3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Accent bar
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, 0, w, 12);

  ctx.fillStyle = '#34d399';
  ctx.font = '700 36px "Source Sans 3", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NPL 2026', w / 2, 90);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 28px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText('Match Result', w / 2, 140);

  ctx.fillStyle = '#a5b4fc';
  ctx.font = '700 32px "Source Sans 3", system-ui, sans-serif';
  const cat = (match.category || 'Match').slice(0, 42);
  const stage = (match.stage || '').slice(0, 32);
  ctx.fillText(stage ? `${cat} · ${stage}` : cat, w / 2, 200);

  // Score block
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  roundRect(ctx, 80, 260, w - 160, 520, 28);
  ctx.fill();

  ctx.fillStyle = '#e0e7ff';
  ctx.font = '800 40px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(name1, w / 2, 340);

  ctx.fillStyle = '#64748b';
  ctx.font = '800 36px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText('vs', w / 2, 400);

  ctx.fillStyle = '#ffe4e6';
  ctx.font = '800 40px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(name2, w / 2, 460);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 140px ui-monospace, SFMono-Regular, Menlo, monospace';
  if (isBo3) {
    ctx.fillText(series, w / 2, 620);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 36px "Source Sans 3", system-ui, sans-serif';
    ctx.fillText(gamesLine || `Final game ${score1}-${score2}`, w / 2, 700);
  } else {
    ctx.fillText(`${score1} – ${score2}`, w / 2, 640);
  }

  // Winner
  ctx.fillStyle = 'rgba(16,185,129,0.2)';
  roundRect(ctx, 120, 860, w - 240, 160, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(52,211,153,0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 120, 860, w - 240, 160, 24);
  ctx.stroke();

  ctx.fillStyle = '#6ee7b7';
  ctx.font = '700 28px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText('WINNER', w / 2, 920);
  ctx.fillStyle = '#ecfdf5';
  ctx.font = '900 48px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(winnerName, w / 2, 980);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 24px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText('Renaissance Nature Walk · Badminton', w / 2, 1280);

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return Promise.reject(new Error('canvasToPngBlob: canvas required'));
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to encode PNG'));
        else resolve(blob);
      },
      'image/png',
      0.92
    );
  });
}

/**
 * Upload snapshot to Firebase Storage `photos/` and return public URL.
 * Security: path is generated server-side from match id + timestamp (not user path input).
 */
export async function saveScoreSnapshotToPhotos(
  match: MatchState,
  blob: Blob
): Promise<{ storagePath: string; downloadUrl: string; fileName: string }> {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('saveScoreSnapshotToPhotos: non-empty blob required');
  }
  if (blob.size > 8 * 1024 * 1024) {
    throw new Error('saveScoreSnapshotToPhotos: image too large (max 8MB)');
  }

  const id = safeFilePart(match.currentMatchId || 'match', 'match');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `npl-${id}-${stamp}.png`;
  const storagePath = `photos/${fileName}`;
  const objectRef = storageRef(storage, storagePath);
  await uploadBytes(objectRef, blob, {
    contentType: 'image/png',
    customMetadata: {
      matchId: String(match.currentMatchId || ''),
      category: String(match.category || '').slice(0, 80)
    }
  });
  const downloadUrl = await getDownloadURL(objectRef);
  return { storagePath, downloadUrl, fileName };
}

/** Trigger a browser download of the snapshot PNG. */
export function downloadSnapshotBlob(blob: Blob, fileName: string): void {
  if (!(blob instanceof Blob)) throw new Error('downloadSnapshotBlob: blob required');
  const safeName =
    typeof fileName === 'string' && fileName.trim().endsWith('.png')
      ? fileName.trim()
      : 'npl-score.png';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Share via Web Share API (system app chooser). Prefers sharing the PNG file.
 * Falls back to text+URL share, then WhatsApp text link only if share API is unavailable.
 */
export async function shareScoreSnapshot(options: {
  blob: Blob;
  fileName: string;
  text: string;
  downloadUrl?: string;
}): Promise<'shared' | 'whatsapp-text' | 'downloaded' | 'none'> {
  const { blob, fileName, text, downloadUrl } = options;
  if (!(blob instanceof Blob)) throw new Error('shareScoreSnapshot: blob required');
  const shareText =
    typeof text === 'string' && text.trim()
      ? text.trim().slice(0, 1000)
      : 'NPL 2026 match result';

  const safeName =
    typeof fileName === 'string' && fileName.trim().endsWith('.png')
      ? fileName.trim()
      : 'npl-score.png';
  const file = new File([blob], safeName, { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const withLink =
    typeof downloadUrl === 'string' && downloadUrl.startsWith('https://')
      ? `${shareText}\n${downloadUrl}`
      : shareText;

  if (nav && typeof nav.share === 'function') {
    // Prefer file share so the OS app picker can upload the image.
    try {
      const filePayload = { files: [file], title: 'NPL 2026 Result', text: shareText };
      const canFiles =
        typeof nav.canShare !== 'function' || nav.canShare(filePayload);
      if (canFiles) {
        await nav.share(filePayload);
        return 'shared';
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'none';
      // Fall through to text share
    }

    try {
      await nav.share({ title: 'NPL 2026 Result', text: withLink });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'none';
    }
  }

  // No Web Share API — still download the image for manual upload.
  downloadSnapshotBlob(blob, safeName);
  try {
    const wa = `https://wa.me/?text=${encodeURIComponent(withLink)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
    return 'whatsapp-text';
  } catch {
    return 'downloaded';
  }
}

/**
 * Build PNG, optionally upload to Storage `photos/`, then open the system share sheet.
 * Upload failure does not block local share.
 */
export async function captureAndPersistScoreSnapshot(
  match: MatchState,
  opts?: { share?: boolean; upload?: boolean }
): Promise<ScoreSnapshotResult> {
  if (!match || typeof match !== 'object') {
    throw new Error('captureAndPersistScoreSnapshot: match is required');
  }

  const canvas = renderScoreSnapshotCanvas(match);
  const blob = await canvasToPngBlob(canvas);

  let storagePath = '';
  let downloadUrl = '';
  let fileName = `npl-${safeFilePart(match.currentMatchId || 'match', 'match')}.png`;

  const shouldUpload = opts?.upload !== false;
  if (shouldUpload) {
    try {
      const uploaded = await saveScoreSnapshotToPhotos(match, blob);
      storagePath = uploaded.storagePath;
      downloadUrl = uploaded.downloadUrl;
      fileName = uploaded.fileName;
    } catch (err) {
      console.error('Firebase Storage upload failed (continuing with local share):', err);
    }
  }

  if (opts?.share) {
    const name1 = match.player1 || match.teamA || 'Side A';
    const name2 = match.player2 || match.teamB || 'Side B';
    const winner = match.matchWinner === 2 ? name2 : name1;
    const result =
      match.bestOf === 3
        ? `Games ${formatGamesWonLabel(match)}`
        : `${match.score1}-${match.score2}`;
    await shareScoreSnapshot({
      blob,
      fileName,
      downloadUrl: downloadUrl || undefined,
      text: `NPL 2026 — ${match.category}\n${name1} vs ${name2}\n${result}\nWinner: ${winner}`
    });
  } else if (!downloadUrl) {
    downloadSnapshotBlob(blob, fileName);
  }

  return {
    blob,
    fileName,
    storagePath,
    downloadUrl
  };
}
