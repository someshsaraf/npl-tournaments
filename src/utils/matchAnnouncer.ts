/**
 * Match score announcements via Web Speech API.
 * Prefers Indian English (en-IN) voices when the OS/browser provides them.
 * Concurrency: UI-thread only; serializes speak via a pending timeout (cancel→speak race).
 * Security: speech text built from sanitized match fields (length-capped).
 * Input: non-empty strings / finite scores validated before speak.
 */

const MAX_LABEL = 48;
const SPEAK_AFTER_CANCEL_MS = 80;

let speakTimer: ReturnType<typeof setTimeout> | null = null;
let voicesReady = false;

function sanitizeSpeakText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.length > MAX_LABEL ? `${trimmed.slice(0, MAX_LABEL - 1)}…` : trimmed;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

function ensureVoicesLoaded(): void {
  if (!isSpeechSupported() || voicesReady) return;
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) {
    voicesReady = true;
    return;
  }
  const onVoices = () => {
    voicesReady = synth.getVoices().length > 0;
    synth.removeEventListener('voiceschanged', onVoices);
  };
  synth.addEventListener('voiceschanged', onVoices);
  void synth.getVoices();
}

/** Indian English / India-labelled voices (en-IN, Heera, Ravi, Raveena, etc.). */
function isIndianEnglishVoice(v: SpeechSynthesisVoice): boolean {
  const lang = (v.lang || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  if (lang === 'en-in' || lang.startsWith('en-in')) return true;
  return (
    /\b(india|indian|heera|ravi|raveena|veena|neerja|prabhat|google.*india)\b/i.test(name) &&
    lang.startsWith('en')
  );
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const indian = voices.filter(isIndianEnglishVoice);
  if (indian.length) {
    const localIn = indian.find((v) => v.localService);
    return localIn ?? indian[0] ?? null;
  }

  // Fallback: any English, preferring local named voices.
  const en = voices.filter(
    (v) => typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('en')
  );
  const pool = en.length ? en : voices;
  const localPreferred = pool.find(
    (v) =>
      v.localService &&
      /samantha|daniel|karen|moira|alex|victoria|enhanced/i.test(v.name)
  );
  if (localPreferred) return localPreferred;
  const anyLocal = pool.find((v) => v.localService);
  return anyLocal ?? pool[0] ?? null;
}

function clearSpeakTimer(): void {
  if (speakTimer !== null) {
    clearTimeout(speakTimer);
    speakTimer = null;
  }
}

function enqueueUtterance(line: string, rate: number): void {
  if (!isSpeechSupported()) return;
  ensureVoicesLoaded();

  const synth = window.speechSynthesis;
  clearSpeakTimer();

  const run = () => {
    speakTimer = null;
    try {
      if (synth.paused) synth.resume();

      const utter = new SpeechSynthesisUtterance(line);
      utter.lang = 'en-IN';
      utter.rate = rate;
      utter.pitch = 1;
      utter.volume = 1;
      const voice = pickVoice();
      if (voice) {
        utter.voice = voice;
        if (voice.lang) utter.lang = voice.lang;
      }

      synth.speak(utter);
      if (synth.paused) synth.resume();
    } catch (err) {
      console.warn('Speech failed:', err);
    }
  };

  // cancel() then speak() in the same turn is silently dropped in Chrome/Firefox.
  try {
    if (synth.speaking || synth.pending) {
      synth.cancel();
      speakTimer = setTimeout(run, SPEAK_AFTER_CANCEL_MS);
      return;
    }
  } catch {
    /* ignore cancel errors */
  }
  run();
}

/**
 * Call from a user gesture so browsers allow later announcements.
 * Silent warm-up only — score announcements are the only audible speech.
 */
export function unlockSpeech(): boolean {
  if (!isSpeechSupported()) return false;
  ensureVoicesLoaded();
  try {
    const synth = window.speechSynthesis;
    if (synth.paused) synth.resume();
    const warm = new SpeechSynthesisUtterance('.');
    warm.volume = 0;
    warm.rate = 1;
    warm.lang = 'en-IN';
    const voice = pickVoice();
    if (voice) warm.voice = voice;
    synth.speak(warm);
    return true;
  } catch (err) {
    console.warn('Speech unlock failed:', err);
    return false;
  }
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  clearSpeakTimer();
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speak text aloud. Cancels any in-progress utterance after a short delay.
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
  enqueueUtterance(line, rate);
}

/**
 * Announce scores only (no names). Point-winner’s score first: "6, 4".
 * On a tie: "2 points each" / "11 points each".
 * Input: finite non-negative scores; pointWinner 1|2.
 */
export function announceScore(
  score1: number,
  score2: number,
  _name1?: string,
  _name2?: string,
  pointWinner: 1 | 2 = 1
): void {
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) return;
  if (score1 < 0 || score2 < 0) return;
  if (pointWinner !== 1 && pointWinner !== 2) pointWinner = 1;
  const s1 = Math.trunc(score1);
  const s2 = Math.trunc(score2);
  if (s1 === s2) {
    speak(`${s1} points each.`);
    return;
  }
  if (pointWinner === 2) {
    speak(`${s2}, ${s1}.`);
  } else {
    speak(`${s1}, ${s2}.`);
  }
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

if (typeof window !== 'undefined') {
  ensureVoicesLoaded();
}
