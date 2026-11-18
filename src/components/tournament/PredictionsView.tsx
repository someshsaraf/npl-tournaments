import { useMemo, useState } from 'react';
import { CheckCircle2, Home, Lock, Vote } from 'lucide-react';
import {
  normalizeVilla,
  predictionCategories,
  type PredictionCategory,
  type PredictionSport
} from '../../data/predictions';
import { usePredictions } from '../../hooks/usePredictions';

const VILLA_KEY = 'npl:predictions:villa';
const votedKey = (sport: string) => `npl:predictions:voted:${sport}`;

/** { [categoryId]: { villa, pick } } — what this device voted, so it can show "You voted". */
type Voted = Record<string, { villa: string; pick: string }>;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* private mode — fine */
  }
}

/**
 * Residents predict each category's winner — one vote per villa per
 * category — and everyone sees the live vote meter. Villa numbers go to
 * the server only; this page shows counts.
 */
export function PredictionsView({ sport, published }: { sport: PredictionSport; published: unknown }) {
  const categories = useMemo(() => predictionCategories(published), [published]);
  const { tallies, open } = usePredictions(sport);
  const [villa, setVilla] = useState(() => {
    try {
      return localStorage.getItem(VILLA_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [voted, setVoted] = useState<Voted>(() => load(votedKey(sport), {}));

  const shown = categories.filter((c) => open.has(c.id) || tallies[c.id]);
  const anyOpen = shown.some((c) => open.has(c.id));

  if (shown.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper-soft px-6 py-12 text-center space-y-2">
        <Vote className="size-8 mx-auto text-emerald-600" aria-hidden />
        <p className="portal-display text-3xl text-ink tracking-wide">Predictions coming soon</p>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Once the players and teams are announced, each villa can predict the winner of every category here.
        </p>
      </div>
    );
  }

  const onVoted = (categoryId: string, villaNo: string, pick: string) => {
    const next = { ...voted, [categoryId]: { villa: villaNo, pick } };
    setVoted(next);
    save(votedKey(sport), next);
  };

  return (
    <div className="space-y-4">
      {anyOpen ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-black text-ink">Who will win? Cast your villa's prediction.</p>
            <p className="text-xs text-slate-600">
              One vote per villa in each category. Votes can't be changed — if someone voted for your villa by mistake,
              tell an organiser.
            </p>
          </div>
          <label className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
              <Home className="size-3.5" aria-hidden /> Your villa no.
            </span>
            <input
              value={villa}
              onChange={(e) => {
                setVilla(e.target.value);
                save(VILLA_KEY, e.target.value);
              }}
              placeholder="e.g. 101"
              maxLength={12}
              autoComplete="off"
              className="w-32 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </label>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((c) => (
          <CategoryMeter
            key={c.id}
            sport={sport}
            category={c}
            counts={tallies[c.id] ?? {}}
            isOpen={open.has(c.id)}
            villa={villa}
            mine={voted[c.id]}
            onVoted={onVoted}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryMeter({
  sport,
  category,
  counts,
  isOpen,
  villa,
  mine,
  onVoted
}: {
  sport: PredictionSport;
  category: PredictionCategory;
  counts: Record<string, number>;
  isOpen: boolean;
  villa: string;
  mine?: { villa: string; pick: string };
  onVoted: (categoryId: string, villa: string, pick: string) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = Math.max(0, ...Object.values(counts));
  const rows = [...category.candidates].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  const canVote = isOpen && !mine;
  const villaNo = normalizeVilla(villa);

  const submit = async () => {
    if (!pick) return;
    if (!villaNo) {
      setError('Enter your villa number above first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, categoryId: category.id, villa: villaNo, pick })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; villa?: string };
      if (!res.ok) {
        setError(data.error ?? 'Voting failed — please try again.');
        return;
      }
      onVoted(category.id, data.villa ?? villaNo, pick);
      setPick(null);
    } catch {
      setError('Voting failed — check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-sm space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-ink">{category.label}</h3>
          <p className="text-xs text-slate-500 tabular-nums">
            {total} {total === 1 ? 'villa has' : 'villas have'} voted
          </p>
        </div>
        {isOpen ? (
          <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            Voting open
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
            <Lock className="size-3" aria-hidden /> Closed
          </span>
        )}
      </header>

      <ul className="space-y-1.5" role={canVote ? 'radiogroup' : undefined} aria-label={canVote ? `Pick the ${category.label} winner` : undefined}>
        {rows.map((c) => {
          const n = counts[c.id] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const leading = n > 0 && n === top;
          const selected = pick === c.id;
          const isMine = mine?.pick === c.id;
          const inner = (
            <>
              <span
                className={`absolute inset-y-0 left-0 rounded-xl transition-[width] duration-500 ${leading ? 'bg-emerald-200' : 'bg-slate-100'}`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-bold text-ink">
                  {isMine ? <CheckCircle2 className="inline size-3.5 mr-1 -mt-0.5 text-emerald-600" aria-label="Your vote" /> : null}
                  {c.name}
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600">
                  {pct}% <span className="font-normal text-slate-400">({n})</span>
                </span>
              </span>
            </>
          );
          return (
            <li key={c.id}>
              {canVote ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPick(c.id)}
                  className={`relative w-full overflow-hidden rounded-xl border text-left transition-colors ${
                    selected ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-line hover:border-emerald-300'
                  }`}
                >
                  {inner}
                </button>
              ) : (
                <div className={`relative overflow-hidden rounded-xl border ${isMine ? 'border-emerald-400' : 'border-line'}`}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      {mine ? (
        <p className="text-xs font-semibold text-emerald-700">Villa {mine.villa} voted from this phone.</p>
      ) : canVote ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!pick || busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
          >
            <Vote className="size-3.5" aria-hidden />
            {busy ? 'Voting…' : villaNo ? `Vote as villa ${villaNo}` : 'Vote'}
          </button>
          {!pick ? <span className="text-xs text-slate-500">Tap a name to pick.</span> : null}
        </div>
      ) : null}
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </section>
  );
}
