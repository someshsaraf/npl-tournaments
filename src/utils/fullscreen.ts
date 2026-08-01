/**
 * Cross-browser fullscreen helpers for /live.
 * Concurrency: DOM APIs only; call from the UI thread (user gestures preferred).
 * Security: only operates on caller-provided elements already in the document.
 */

type DocumentWithFS = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void> | void;
};

type ElementWithFS = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenMode = 'native' | 'css' | 'none';

function asFsDocument(): DocumentWithFS {
  return document as DocumentWithFS;
}

/** Current native fullscreen element (standard + WebKit + MS). */
export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = asFsDocument();
  return (
    document.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

/** Whether the given element (or a child/ancestor) is in native fullscreen. */
export function isElementNativeFullscreen(target: Element | null | undefined): boolean {
  if (!target || !(target instanceof Element)) return false;
  const active = getFullscreenElement();
  if (!active) return false;
  return active === target || target.contains(active) || active.contains(target);
}

export function canRequestNativeFullscreen(el: HTMLElement | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const node = el as ElementWithFS;
  return (
    typeof node.requestFullscreen === 'function' ||
    typeof node.webkitRequestFullscreen === 'function' ||
    typeof node.webkitRequestFullScreen === 'function' ||
    typeof node.msRequestFullscreen === 'function'
  );
}

/**
 * Enter native fullscreen on `el`. Tries the element, then documentElement.
 * Returns 'native' on success, 'css' when the caller should use CSS immersive fallback.
 */
export async function enterNativeFullscreen(el: HTMLElement): Promise<'native' | 'css'> {
  if (!(el instanceof HTMLElement)) {
    throw new Error('enterNativeFullscreen: el must be an HTMLElement');
  }

  const tryEnter = async (node: HTMLElement): Promise<boolean> => {
    const target = node as ElementWithFS;
    try {
      if (typeof target.requestFullscreen === 'function') {
        await target.requestFullscreen({ navigationUI: 'hide' });
        return true;
      }
      if (typeof target.webkitRequestFullscreen === 'function') {
        await Promise.resolve(target.webkitRequestFullscreen());
        return true;
      }
      if (typeof target.webkitRequestFullScreen === 'function') {
        await Promise.resolve(target.webkitRequestFullScreen());
        return true;
      }
      if (typeof target.msRequestFullscreen === 'function') {
        await Promise.resolve(target.msRequestFullscreen());
        return true;
      }
    } catch (err) {
      console.warn('Fullscreen request failed for element:', err);
    }
    return false;
  };

  if (await tryEnter(el)) return 'native';
  if (el !== document.documentElement && (await tryEnter(document.documentElement))) {
    return 'native';
  }
  return 'css';
}

/** Exit native fullscreen if active. */
export async function exitNativeFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!getFullscreenElement()) return;

  const doc = asFsDocument();
  try {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === 'function') {
      await Promise.resolve(doc.webkitExitFullscreen());
      return;
    }
    if (typeof doc.webkitCancelFullScreen === 'function') {
      await Promise.resolve(doc.webkitCancelFullScreen());
      return;
    }
    if (typeof doc.msExitFullscreen === 'function') {
      await Promise.resolve(doc.msExitFullscreen());
    }
  } catch (err) {
    console.warn('Exit fullscreen failed:', err);
  }
}

const FS_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'MSFullscreenChange'
] as const;

/** Subscribe to native fullscreen changes. Returns unsubscribe. */
export function subscribeFullscreenChange(handler: () => void): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }
  if (typeof handler !== 'function') {
    throw new Error('subscribeFullscreenChange: handler must be a function');
  }
  for (const evt of FS_EVENTS) {
    document.addEventListener(evt, handler);
  }
  return () => {
    for (const evt of FS_EVENTS) {
      document.removeEventListener(evt, handler);
    }
  };
}
