/**
 * Cross-browser fullscreen helpers for /live.
 * Concurrency: DOM APIs only; call from the UI thread (user gestures preferred).
 * Security: only operates on caller-provided elements already in the document.
 *
 * iPhone note: Safari/Chrome (WebKit) do not support Element.requestFullscreen()
 * for page containers. True video fullscreen must go through YouTube's in-player
 * control (HTMLVideoElement.webkitEnterFullscreen inside the cross-origin iframe).
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

export type FullscreenEnterResult = 'native' | 'ios-cinema' | 'css';

function asFsDocument(): DocumentWithFS {
  return document as DocumentWithFS;
}

/** iPhone / iPod — no page Fullscreen API (iPadOS may support it). */
export function isIphoneDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPod/i.test(navigator.userAgent || '');
}

/** iPhone, iPad, or iPadOS-as-Mac. */
export function isIosLikeDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
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
  // iPhone reports the method on some versions but rejects the call — skip it.
  if (isIphoneDevice()) return false;
  const node = el as ElementWithFS;
  return (
    typeof node.requestFullscreen === 'function' ||
    typeof node.webkitRequestFullscreen === 'function' ||
    typeof node.webkitRequestFullScreen === 'function' ||
    typeof node.msRequestFullscreen === 'function'
  );
}

async function tryEnterOn(node: HTMLElement): Promise<boolean> {
  const target = node as ElementWithFS;
  try {
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen({ navigationUI: 'hide' });
      return !!getFullscreenElement();
    }
    if (typeof target.webkitRequestFullscreen === 'function') {
      await Promise.resolve(target.webkitRequestFullscreen());
      return !!getFullscreenElement();
    }
    if (typeof target.webkitRequestFullScreen === 'function') {
      await Promise.resolve(target.webkitRequestFullScreen());
      return !!getFullscreenElement();
    }
    if (typeof target.msRequestFullscreen === 'function') {
      await Promise.resolve(target.msRequestFullscreen());
      return !!getFullscreenElement();
    }
  } catch (err) {
    console.warn('Fullscreen request failed for element:', err);
  }
  return false;
}

/**
 * Enter native fullscreen on the page container (video + score overlay).
 * Never fullscreens the YouTube iframe alone — that hides the score bug.
 * On iPhone, returns 'ios-cinema' (page Fullscreen API unsupported).
 */
export async function enterNativeFullscreen(
  el: HTMLElement,
  _iframe?: HTMLIFrameElement | null
): Promise<FullscreenEnterResult> {
  if (!(el instanceof HTMLElement)) {
    throw new Error('enterNativeFullscreen: el must be an HTMLElement');
  }

  if (isIphoneDevice()) {
    return 'ios-cinema';
  }

  // Host container first so overlays stay inside the fullscreen element.
  if (await tryEnterOn(el)) return 'native';
  if (el !== document.documentElement && (await tryEnterOn(document.documentElement))) {
    return 'native';
  }

  // iPad / rare WebKit cases where API exists but fails → cinema-style fallback.
  if (isIosLikeDevice()) return 'ios-cinema';
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

const BODY_LOCK_CLASS = 'npl-live-body-lock';
const IOS_CHROME_COLLAPSE_CLASS = 'npl-live-ios-chrome-collapse';

/** True when launched from Home Screen / installed PWA (no Safari/Chrome toolbars). */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/** Lock page scroll while in CSS / iOS cinema mode. */
export function setBodyScrollLocked(locked: boolean): void {
  if (typeof document === 'undefined') return;
  if (typeof locked !== 'boolean') {
    throw new Error('setBodyScrollLocked: locked must be boolean');
  }
  if (locked) {
    setIosBrowserChromeCollapse(false);
  }
  document.documentElement.classList.toggle(BODY_LOCK_CLASS, locked);
  document.body.classList.toggle(BODY_LOCK_CLASS, locked);
}

/**
 * Allow a tiny document scroll so iOS Safari can collapse its toolbars.
 * (overflow:hidden prevents that — which is why bars stay visible otherwise.)
 */
export function setIosBrowserChromeCollapse(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  if (typeof enabled !== 'boolean') {
    throw new Error('setIosBrowserChromeCollapse: enabled must be boolean');
  }

  if (!enabled) {
    document.documentElement.classList.remove(IOS_CHROME_COLLAPSE_CLASS);
    document.body.classList.remove(IOS_CHROME_COLLAPSE_CLASS);
    try {
      window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
    return;
  }

  document.documentElement.classList.remove(BODY_LOCK_CLASS);
  document.body.classList.remove(BODY_LOCK_CLASS);
  document.documentElement.classList.add(IOS_CHROME_COLLAPSE_CLASS);
  document.body.classList.add(IOS_CHROME_COLLAPSE_CLASS);

  const nudge = () => {
    try {
      window.scrollTo(0, 0);
      window.scrollTo(0, 120);
    } catch {
      /* ignore */
    }
  };
  requestAnimationFrame(() => {
    nudge();
    window.setTimeout(nudge, 50);
    window.setTimeout(nudge, 300);
  });
}
