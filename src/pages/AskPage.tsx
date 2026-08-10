import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import {
  FIXTURES,
  INITIAL_MATCH,
  TEAMS,
  type CompletedMatch,
  type Fixture,
  type MatchState,
  type Team
} from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  mergeFixturesWithResults,
  sortCompletedMatches
} from '../utils/completedMatches';
import { normalizeMatchState } from '../utils/matchState';
import {
  SUGGESTED_PROMPTS,
  answerTournamentQuestion,
  type ChatAnswer
} from '../utils/tournamentChat';
import { buildAskContext, suggestAskLinks } from '../utils/askContext';
import {
  getPlayerNameAliases,
  renamePlayerInTeams
} from '../utils/playerRename';

const MAX_QUESTION = 500;
const HISTORY_TURNS = 8;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  links?: { label: string; to: string }[];
};

function normalizeTeams(raw: unknown): Team[] {
  if (!Array.isArray(raw)) return TEAMS;
  const cleaned = raw.filter(
    (t): t is Team =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as Team).id === 'string' &&
      typeof (t as Team).name === 'string' &&
      Array.isArray((t as Team).players)
  );
  const base = cleaned.length > 0 ? cleaned : TEAMS;
  let withAliases = base;
  for (const [from, to] of Object.entries(getPlayerNameAliases())) {
    withAliases = renamePlayerInTeams(withAliases, from, to);
  }
  return withAliases;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localFallbackAnswer(
  question: string,
  knowledge: {
    fixtures: Fixture[];
    teams: Team[];
    completed: CompletedMatch[];
    live: MatchState | null;
  },
  offlineReason: string | null
): ChatAnswer {
  try {
    const answer = answerTournamentQuestion(question, knowledge);
    if (!offlineReason) return answer;
    return {
      text: `${answer.text}\n\n(Offline answer — ${offlineReason})`,
      links: answer.links?.length ? answer.links : suggestAskLinks(question)
    };
  } catch (err) {
    console.error('Ask local fallback failed:', err);
    return {
      text: offlineReason
        ? `Ask assistant unavailable: ${offlineReason}`
        : 'Something went wrong answering that. Try again or browse Schedule / Results / Stats.',
      links: [
        { label: 'Schedule', to: '/schedule' },
        { label: 'Results', to: '/results' },
        { label: 'Stats', to: '/stats' }
      ]
    };
  }
}

type GeminiAskResponse = {
  text?: unknown;
  links?: unknown;
  error?: unknown;
  code?: unknown;
};

/**
 * Call /api/ask (Gemini). Returns null when the route is unavailable so caller can fallback.
 * On soft failures, returns an answer with a clear setup hint (not null).
 */
async function fetchGeminiAnswer(
  question: string,
  context: ReturnType<typeof buildAskContext>,
  history: Array<{ role: 'user' | 'assistant'; text: string }>
): Promise<{ answer: ChatAnswer | null; reason: string | null }> {
  let res: Response;
  try {
    res = await fetch('/api/ask', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, history })
    });
  } catch {
    return {
      answer: null,
      reason:
        'Could not reach /api/ask. Locally run `npx vercel dev` (plain Vite does not serve /api).'
    };
  }

  let data: GeminiAskResponse | null = null;
  try {
    data = (await res.json()) as GeminiAskResponse;
  } catch {
    if (res.status === 404) {
      return {
        answer: null,
        reason:
          '/api/ask not found (404). Deploy on Vercel or run `npx vercel dev` with GEMINI_API_KEY set.'
      };
    }
    return { answer: null, reason: `Ask API returned non-JSON (HTTP ${res.status}).` };
  }

  if (!res.ok) {
    const code = typeof data?.code === 'string' ? data.code : '';
    const errText =
      typeof data?.error === 'string' && data.error.trim() ? data.error.trim() : '';

    if (res.status === 503 || code === 'missing_config') {
      return {
        answer: null,
        reason:
          errText ||
          'GEMINI_API_KEY is not set on the server. Add it in Vercel env (or .env for vercel dev).'
      };
    }
    if (res.status === 404) {
      return {
        answer: null,
        reason:
          '/api/ask not found. Deploy on Vercel or run `npx vercel dev` so API routes work.'
      };
    }
    if (res.status === 502 || code === 'http_error' || code === 'timeout' || code === 'empty_answer' || code === 'bad_model' || code === 'auth_error' || code === 'quota') {
      // Surface Gemini setup errors directly (don't hide behind keyword fallback).
      if (code === 'bad_model' || code === 'auth_error' || code === 'quota' || code === 'missing_config') {
        return {
          answer: {
            text: errText || 'Ask backend is misconfigured.',
            links: suggestAskLinks(question)
          },
          reason: null
        };
      }
      return {
        answer: null,
        reason: errText || 'Gemini backend error. Check GEMINI_API_KEY / GEMINI_MODEL and quota.'
      };
    }
    return {
      answer: {
        text: errText || 'Ask could not answer that right now.',
        links: suggestAskLinks(question)
      },
      reason: null
    };
  }

  if (typeof data?.text !== 'string' || !data.text.trim()) {
    return { answer: null, reason: 'Gemini returned an empty answer.' };
  }

  const links =
    Array.isArray(data.links) && data.links.length > 0
      ? data.links
          .filter(
            (l): l is { label: string; to: string } =>
              !!l &&
              typeof l === 'object' &&
              typeof (l as { label?: unknown }).label === 'string' &&
              typeof (l as { to?: unknown }).to === 'string' &&
              (l as { to: string }).to.startsWith('/')
          )
          .map((l) => ({ label: l.label.trim().slice(0, 40), to: l.to.trim().slice(0, 80) }))
          .slice(0, 4)
      : suggestAskLinks(question);

  return { answer: { text: data.text.trim().slice(0, 4000), links }, reason: null };
}

/**
 * Public Ask portal — Gemini answers strictly from live tournament context.
 * Read-only Firebase; API key stays on the server (/api/ask).
 * Falls back to local keyword engine when the API is unavailable.
 */
export default function AskPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>(() =>
    mergeFixturesWithResults(FIXTURES, {})
  );
  const [teams, setTeams] = useState<Team[]>(TEAMS);
  const [completed, setCompleted] = useState<CompletedMatch[]>([]);
  const [live, setLive] = useState<MatchState | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [askStatus, setAskStatus] = useState<{
    state: 'checking' | 'ready' | 'missing_key' | 'unreachable';
    detail: string;
  }>({ state: 'checking', detail: 'Checking Ask assistant…' });
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text:
        'Hi — ask me anything about NPL 2026. I answer strictly from live schedule, results, teams, rules, and stats on this site.',
      links: [
        { label: 'Schedule', to: '/schedule' },
        { label: 'Results', to: '/results' },
        { label: 'Stats', to: '/stats' },
        { label: 'Rules', to: '/rules' }
      ]
    }
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fixturesRef = useRef(fixtures);
  const teamsRef = useRef(teams);
  const completedRef = useRef(completed);
  const liveRef = useRef(live);
  const messagesRef = useRef(messages);

  fixturesRef.current = fixtures;
  teamsRef.current = teams;
  completedRef.current = completed;
  liveRef.current = live;
  messagesRef.current = messages;

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubMatch = onValue(matchRef, (snap) => {
      const raw = snap.val();
      setLive(normalizeMatchState(raw && typeof raw === 'object' ? raw : INITIAL_MATCH));
    });

    const completedRefFb = ref(db, 'completedMatches');
    const unsubCompleted = onValue(completedRefFb, (snap) => {
      const byId = completedMatchesFromFirebase(snap.val());
      setFixtures(mergeFixturesWithResults(FIXTURES, byId));
      setCompleted(sortCompletedMatches(Object.values(byId)));
    });

    const teamsRefFb = ref(db, 'teams');
    const unsubTeams = onValue(teamsRefFb, (snap) => {
      setTeams(normalizeTeams(snap.val()));
    });

    return () => {
      unsubMatch();
      unsubCompleted();
      unsubTeams();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch('/api/ask', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (cancelled) return;

        if (res.status === 404) {
          setAskStatus({
            state: 'unreachable',
            detail:
              '/api/ask not found. On Vercel, redeploy after adding api/ask.ts. Locally run `npx vercel dev` (not plain `npm run dev`).'
          });
          return;
        }

        type AskHealth = {
          configured?: unknown;
          message?: unknown;
          model?: unknown;
        };
        let data: AskHealth | null = null;
        try {
          data = (await res.json()) as AskHealth;
        } catch {
          setAskStatus({
            state: 'unreachable',
            detail:
              'Got a non-JSON response from /api/ask (likely the Vite SPA). Use `npx vercel dev` or open the deployed Vercel URL.'
          });
          return;
        }

        const configured = data?.configured === true;
        const msg =
          typeof data?.message === 'string' && data.message.trim()
            ? data.message.trim()
            : configured
              ? 'Gemini Ask is configured.'
              : 'GEMINI_API_KEY is not set.';
        const model =
          typeof data?.model === 'string' && data.model.trim() ? data.model.trim() : '';

        setAskStatus({
          state: configured ? 'ready' : 'missing_key',
          detail: configured ? `${msg}${model ? ` · model ${model}` : ''}` : msg
        });
      } catch {
        if (cancelled) return;
        setAskStatus({
          state: 'unreachable',
          detail:
            'Could not reach /api/ask. Locally run `npx vercel dev` with GEMINI_API_KEY in .env.'
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const runAsk = (raw: string) => {
    const question = typeof raw === 'string' ? raw.trim().slice(0, MAX_QUESTION) : '';
    if (!question || busy) return;

    setBusy(true);
    setInput('');

    const userMsg: ChatMessage = { id: newId(), role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);

    void (async () => {
      const knowledge = {
        fixtures: fixturesRef.current,
        teams: teamsRef.current,
        completed: completedRef.current,
        live: liveRef.current
      };

      const prior = messagesRef.current
        .filter((m) => m.id !== 'welcome' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text.slice(0, 400) }));

      let answer: ChatAnswer | null = null;
      let offlineReason: string | null = null;
      try {
        const context = buildAskContext(knowledge);
        const gemini = await fetchGeminiAnswer(question, context, prior);
        answer = gemini.answer;
        offlineReason = gemini.reason;
      } catch (err) {
        console.error('Ask Gemini path failed:', err);
        answer = null;
        offlineReason =
          'Ask assistant crashed before Gemini responded. Check the browser console.';
      }

      if (!answer) {
        answer = localFallbackAnswer(question, knowledge, offlineReason);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: answer!.text,
          links: answer!.links
        }
      ]);
      setBusy(false);
      inputRef.current?.focus();
    })();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runAsk(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runAsk(input);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto min-h-[min(70vh,40rem)]">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
          Ask NPL
        </h1>
        <p className="text-sm text-slate-400">
          Natural questions about schedule, rules, teams, results, and stats — answered strictly
          from live tournament data on this site.
        </p>
      </header>

      <div
        className={`rounded-xl border px-3.5 py-3 text-sm ${
          askStatus.state === 'ready'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
            : askStatus.state === 'checking'
              ? 'border-slate-700 bg-slate-900/60 text-slate-400'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
        }`}
        role="status"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1">
          {askStatus.state === 'ready'
            ? 'Gemini connected'
            : askStatus.state === 'checking'
              ? 'Checking Gemini…'
              : askStatus.state === 'missing_key'
                ? 'Gemini key missing'
                : 'Ask API unreachable'}
        </p>
        <p className="leading-relaxed">{askStatus.detail}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => runAsk(prompt)}
            className="text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200 disabled:opacity-40 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden min-h-[22rem]">
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 max-h-[min(55vh,28rem)]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-md'
                    : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-md'
                }`}
              >
                <p>{m.text}</p>
                {m.role === 'assistant' && Array.isArray(m.links) && m.links.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-slate-700/80">
                    {m.links.map((link) => (
                      <Link
                        key={`${m.id}-${link.to}-${link.label}`}
                        to={link.to}
                        className="text-[11px] font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
                      >
                        {link.label} →
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {busy ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm bg-slate-800 border border-slate-700 text-slate-400">
                Looking that up…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-800 p-3 sm:p-4 flex gap-2 bg-slate-950/40"
        >
          <label htmlFor="ask-npl-input" className="sr-only">
            Ask about the tournament
          </label>
          <input
            id="ask-npl-input"
            ref={inputRef}
            type="text"
            value={input}
            maxLength={MAX_QUESTION}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Who won Men’s Singles >35? How many matches on 9th August?"
            className="flex-1 min-w-0 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            autoComplete="off"
            spellCheck
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm px-4 py-2.5 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
