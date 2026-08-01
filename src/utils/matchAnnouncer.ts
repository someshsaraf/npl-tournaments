/**
 * Match score / serve announcements via Web Speech API.
 * Concurrency: UI-thread only; cancels prior utterance before speaking.
 * Security: speech text built from sanitized match fields (length-capped).
 */

const MAX_LABEL = 48;

function sanitizeSpeakText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.length > MAX_LABEL ? `${trimmed.slice(0, MAX_LABEL - 1)}…` : trimmed;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

/** Call from a user gesture so iOS / Chrome allow later announcements. */
export function unlockSpeech(): boolean {
  if (!isSpeechSupported()) return false;
  try {
    window.speechSynthesis.cancel();
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.rate = 1;
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
    return true;
  } catch (err) {
    console.warn('Speech unlock failed:', err);
    return false;
  }
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak text aloud. Cancels any in-progress utterance.
 * Input: non-empty string after trim; ignored otherwise.
 */
export function speak(text: unknown, rate = 1): void {
  if (!isSpeechSupported()) return;
  if (typeof text !== 'string') return;
  const line = text.trim().replace(/\s+/g, ' ');
  if (!line || line.length > 240) return;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.5 || rate > 1.5) {
    rate = 1;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(line);
    utter.rate = rate;
    utter.pitch = 1;
    utter.volume = 1;
    // Prefer a clear English voice when available.
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find(
      (v) =>
        typeof v.lang === 'string' &&
        v.lang.toLowerCase().startsWith('en') &&
        /google|samantha|daniel|karen|moira|enhanced/i.test(v.name)
    );
    const enAny = voices.find((v) => typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('en'));
    if (en) utter.voice = en;
    else if (enAny) utter.voice = enAny;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn('Speech failed:', err);
  }
}

export function announceScore(
  score1: number,
  score2: number,
  name1?: string,
  name2?: string
): void {
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) return;
  if (score1 < 0 || score2 < 0) return;
  const a = sanitizeSpeakText(name1, 'Side A');
  const b = sanitizeSpeakText(name2, 'Side B');
  speak(`${a} ${Math.trunc(score1)}, ${b} ${Math.trunc(score2)}.`);
}

export function announceServe(serverName: unknown): void {
  const name = sanitizeSpeakText(serverName, 'server');
  speak(`Serve. ${name}.`);
}

export function announceScoreAndServe(
  score1: number,
  score2: number,
  name1: string,
  name2: string,
  serverName: string
): void {
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) return;
  if (score1 < 0 || score2 < 0) return;
  const a = sanitizeSpeakText(name1, 'Side A');
  const b = sanitizeSpeakText(name2, 'Side B');
  const serve = sanitizeSpeakText(serverName, 'server');
  speak(`${a} ${Math.trunc(score1)}, ${b} ${Math.trunc(score2)}. Serve ${serve}.`);
}

export function announceWinner(winnerName: unknown): void {
  const name = sanitizeSpeakText(winnerName, 'Winner');
  speak(`Winner. ${name}.`);
}
