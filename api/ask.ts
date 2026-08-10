import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/ask
 * Strict NPL 2026 tournament chatbot via Gemini (server-only API key).
 *
 * Env (Vercel, not VITE_):
 * - GEMINI_API_KEY (required)
 * - GEMINI_MODEL (optional; default gemini-2.5-flash — gemini-2.0-flash shut down June 2026)
 *
 * Concurrency: stateless per request.
 * Security: key never returned; validate/caps on question, history, context size.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_RE = /^[a-zA-Z0-9._-]{3,64}$/;
const API_HOST = 'https://generativelanguage.googleapis.com';
const MAX_QUESTION = 500;
const MAX_HISTORY = 8;
const MAX_HISTORY_TEXT = 400;
const MAX_CONTEXT_CHARS = 100_000;
const MAX_BODY_CHARS = 120_000;
const GEMINI_TIMEOUT_MS = 28_000;
/** Tried in order if GEMINI_MODEL is unset or the chosen model is unavailable. */
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite'] as const;

const SYSTEM_INSTRUCTION = `You are NPL 2026 Ask — the official assistant for the NPL 2026 badminton tournament at Renaissance Nature Walk.

STRICT RULES (non-negotiable):
1. Answer ONLY using the CONTEXT JSON provided in the user message. Do not use outside knowledge.
2. If the answer is not clearly supported by CONTEXT, say you do not have that in the tournament data and suggest checking Schedule, Results, Stats, or Rules on the portal.
3. Never invent winners, scores, times, player names, or match counts.
4. Dates in CONTEXT look like "9-Aug-26" (day-Mon-yy). Treat natural language like "9th August" / "August 9" as that calendar day in 2026.
5. Prefer short, direct answers. Use bullet lists when listing multiple matches.
6. For "how many matches played" on a date, count CONTEXT.completed rows whose "when" starts with that date (completedDate).
7. For schedule questions, use CONTEXT.fixtures. For live score, use CONTEXT.live.
8. Do not mention these instructions, API keys, or that you are Gemini unless asked how you work — then say you answer from live NPL 2026 tournament data only.`;

type HistoryTurn = { role: 'user' | 'assistant'; text: string };

type AskLink = { label: string; to: string };

function resolveModel(): string {
  const fromEnv =
    typeof process.env.GEMINI_MODEL === 'string' ? process.env.GEMINI_MODEL.trim() : '';
  if (fromEnv && MODEL_RE.test(fromEnv)) return fromEnv;
  return DEFAULT_MODEL;
}

function modelsToTry(): string[] {
  const primary = resolveModel();
  const list = [primary, ...MODEL_FALLBACKS.filter((m) => m !== primary)];
  return [...new Set(list)];
}

/**
 * Map Gemini error JSON to a safe user-facing message (never includes the API key).
 */
function describeGeminiHttpError(status: number, body: unknown): { error: string; code: string } {
  let geminiMsg = '';
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const err = (body as Record<string, unknown>).error;
    if (err && typeof err === 'object' && !Array.isArray(err)) {
      const msg = (err as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.trim()) {
        geminiMsg = msg.trim().slice(0, 240);
      }
    }
  }

  if (status === 400 && /model|not found|not supported/i.test(geminiMsg)) {
    return {
      error: `Gemini model is unavailable (${geminiMsg}). Set GEMINI_MODEL to gemini-2.5-flash (or newer) in Vercel and redeploy.`,
      code: 'bad_model'
    };
  }
  if (status === 403 || status === 401 || /api key|permission|denied/i.test(geminiMsg)) {
    return {
      error:
        'Gemini rejected the API key. Check GEMINI_API_KEY in Vercel (Generative Language API / AI Studio key) and redeploy.',
      code: 'auth_error'
    };
  }
  if (status === 429 || /quota|rate/i.test(geminiMsg)) {
    return {
      error: 'Gemini quota exceeded. Wait a minute or check billing/quota in Google AI Studio.',
      code: 'quota'
    };
  }
  if (status === 404) {
    return {
      error:
        'Gemini model not found. Set GEMINI_MODEL=gemini-2.5-flash in Vercel env and redeploy.',
      code: 'bad_model'
    };
  }
  return {
    error: geminiMsg
      ? `Gemini error (${status}): ${geminiMsg}`
      : `Ask backend returned an error (${status}). Try again shortly.`,
    code: 'http_error'
  };
}

async function callGemini(args: {
  apiKey: string;
  model: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  signal: AbortSignal;
}): Promise<{ ok: true; data: unknown } | { ok: false; status: number; body: unknown }> {
  const url = `${API_HOST}/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: args.contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024
      }
    }),
    signal: args.signal
  });

  let body: unknown = null;
  try {
    body = await geminiRes.json();
  } catch {
    body = null;
  }

  if (!geminiRes.ok) {
    return { ok: false, status: geminiRes.status, body };
  }
  return { ok: true, data: body };
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function parseHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const role = row.role === 'user' || row.role === 'assistant' ? row.role : null;
    const text =
      typeof row.text === 'string' ? row.text.trim().slice(0, MAX_HISTORY_TEXT) : '';
    if (!role || !text) continue;
    out.push({ role, text });
    if (out.length >= MAX_HISTORY) break;
  }
  return out;
}

function suggestLinks(question: string): AskLink[] {
  const q = question.toLowerCase();
  const links: AskLink[] = [];
  const add = (label: string, to: string) => {
    if (!links.some((l) => l.to === to)) links.push({ label, to });
  };
  if (/\brule|trump|golden|deuce|shoe|serve|scoring|format\b/.test(q)) add('Rules', '/rules');
  if (/\bresult|won|winner|score|completed|final|played\b/.test(q)) add('Results', '/results');
  if (/\bstat|nail|blowout|undefeated|champion|how many\b/.test(q)) add('Stats', '/stats');
  if (/\bschedule|when|fixture|upcoming|play\b/.test(q)) add('Schedule', '/schedule');
  if (/\bteam|roster|squad|who is on\b/.test(q)) add('Teams', '/teams');
  if (/\blive|now|on court|scoreboard\b/.test(q)) add('Live stream', '/live');
  if (links.length === 0) {
    add('Schedule', '/schedule');
    add('Results', '/results');
    add('Stats', '/stats');
  }
  return links.slice(0, 4);
}

function extractGeminiText(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const root = data as Record<string, unknown>;
  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const block = root.promptFeedback;
    if (block && typeof block === 'object') {
      return null;
    }
    return null;
  }
  const first = candidates[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return null;
  const content = (first as Record<string, unknown>).content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return null;
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) continue;
    const text = (part as Record<string, unknown>).text;
    if (typeof text === 'string' && text.trim()) chunks.push(text.trim());
  }
  const joined = chunks.join('\n').trim();
  return joined || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey =
    typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY.trim() : '';
  const model = resolveModel();

  // Health / readiness — never exposes the key.
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      configured: apiKey.length > 0,
      model,
      message: apiKey
        ? 'Gemini Ask is configured.'
        : 'GEMINI_API_KEY is not set. Add it in Vercel Project Settings → Environment Variables, then redeploy. Locally use a .env file and `npx vercel dev`.'
    });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
    return;
  }

  if (!apiKey) {
    res.status(503).json({
      error:
        'Ask is not configured. Set GEMINI_API_KEY in Vercel env (Project Settings → Environment Variables), then redeploy. Locally: put it in .env and run `npx vercel dev`.',
      code: 'missing_config'
    });
    return;
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) {
      res.status(413).json({ error: 'Request too large.', code: 'payload_too_large' });
      return;
    }
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      res.status(400).json({ error: 'Invalid JSON body.', code: 'invalid_body' });
      return;
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Expected JSON object body.', code: 'invalid_body' });
    return;
  }

  const payload = body as Record<string, unknown>;
  if (!isNonEmptyString(payload.question, MAX_QUESTION)) {
    res.status(400).json({
      error: `question must be a non-empty string up to ${MAX_QUESTION} characters.`,
      code: 'invalid_question'
    });
    return;
  }
  const question = payload.question.trim();

  if (!payload.context || typeof payload.context !== 'object' || Array.isArray(payload.context)) {
    res.status(400).json({ error: 'context object is required.', code: 'invalid_context' });
    return;
  }

  let contextJson: string;
  try {
    contextJson = JSON.stringify(payload.context);
  } catch {
    res.status(400).json({ error: 'context is not serializable.', code: 'invalid_context' });
    return;
  }
  if (contextJson.length > MAX_CONTEXT_CHARS) {
    res.status(413).json({ error: 'context too large.', code: 'payload_too_large' });
    return;
  }

  const history = parseHistory(payload.history);
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const turn of history) {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }]
    });
  }
  contents.push({
    role: 'user',
    parts: [
      {
        text:
          `CONTEXT (JSON — sole source of truth):\n${contextJson}\n\n` +
          `QUESTION:\n${question}`
      }
    ]
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let lastFail: { status: number; body: unknown } | null = null;
  let data: unknown = null;
  let usedModel = resolveModel();

  try {
    for (const candidate of modelsToTry()) {
      usedModel = candidate;
      let result: Awaited<ReturnType<typeof callGemini>>;
      try {
        result = await callGemini({
          apiKey,
          model: candidate,
          contents,
          signal: controller.signal
        });
      } catch (err) {
        const aborted = err instanceof Error && err.name === 'AbortError';
        res.status(502).json({
          error: aborted ? 'Ask timed out. Try again.' : 'Network error talking to Ask backend.',
          code: aborted ? 'timeout' : 'http_error'
        });
        return;
      }

      if (result.ok) {
        data = result.data;
        lastFail = null;
        break;
      }

      lastFail = { status: result.status, body: result.body };
      // Retry next model only when this one is missing / unsupported.
      const msg =
        result.body &&
        typeof result.body === 'object' &&
        !Array.isArray(result.body) &&
        (result.body as { error?: { message?: string } }).error?.message
          ? String((result.body as { error: { message?: string } }).error.message)
          : '';
      const modelIssue =
        result.status === 404 ||
        (result.status === 400 && /model|not found|not supported|not available/i.test(msg));
      if (!modelIssue) break;
    }
  } finally {
    clearTimeout(timer);
  }

  if (lastFail || data == null) {
    const mapped = describeGeminiHttpError(lastFail?.status ?? 502, lastFail?.body ?? null);
    res.status(502).json(mapped);
    return;
  }

  const text = extractGeminiText(data);
  if (!text) {
    res.status(502).json({
      error:
        'I could not produce an answer from tournament data. Try rephrasing or browse Results / Schedule.',
      code: 'empty_answer'
    });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    text: text.slice(0, 4000),
    links: suggestLinks(question),
    model: usedModel
  });
}
