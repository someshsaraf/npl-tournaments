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
import {
  getPlayerNameAliases,
  renamePlayerInTeams
} from '../utils/playerRename';

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

/**
 * Public Ask portal — answers from schedule, rules, teams, results, live match.
 * Read-only Firebase listeners; answers generated locally (no external AI API).
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text:
        'Hi — ask me about the NPL 2026 schedule, rules, teams, or results. I answer from the live tournament data on this site.',
      links: [
        { label: 'Schedule', to: '/schedule' },
        { label: 'Rules', to: '/rules' }
      ]
    }
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubMatch = onValue(matchRef, (snap) => {
      const raw = snap.val();
      setLive(normalizeMatchState(raw && typeof raw === 'object' ? raw : INITIAL_MATCH));
    });

    const completedRef = ref(db, 'completedMatches');
    const unsubCompleted = onValue(completedRef, (snap) => {
      const byId = completedMatchesFromFirebase(snap.val());
      setFixtures(mergeFixturesWithResults(FIXTURES, byId));
      setCompleted(sortCompletedMatches(Object.values(byId)));
    });

    const teamsRef = ref(db, 'teams');
    const unsubTeams = onValue(teamsRef, (snap) => {
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

  const runAsk = (raw: string) => {
    const question = typeof raw === 'string' ? raw.trim().slice(0, 400) : '';
    if (!question || busy) return;

    setBusy(true);
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', text: question }
    ]);

    // Yield so the user bubble paints before the (sync) answer.
    window.setTimeout(() => {
      let answer: ChatAnswer;
      try {
        answer = answerTournamentQuestion(question, {
          fixtures,
          teams,
          completed,
          live
        });
      } catch (err) {
        console.error('Ask portal failed:', err);
        answer = {
          text: 'Something went wrong answering that. Try again or browse Schedule / Rules.',
          links: [
            { label: 'Schedule', to: '/schedule' },
            { label: 'Rules', to: '/rules' }
          ]
        };
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: answer.text,
          links: answer.links
        }
      ]);
      setBusy(false);
      inputRef.current?.focus();
    }, 120);
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
          Questions about schedule, rules, teams, and results — answered from tournament data
          (no external AI cloud).
        </p>
      </header>

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
            maxLength={400}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. When does Team B play? Trump rules?"
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
