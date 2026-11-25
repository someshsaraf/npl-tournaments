import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardPen, Search, Users } from 'lucide-react';
import {
  closeDayParts,
  closesLabel,
  countdownLabel,
  daysUntilClose,
  groupsOf,
  registrationOpen,
  type RegistrationConfig,
  type RegistrationKey
} from '../data/registration';
import { useRegisteredCount, type RegisteredStats } from '../hooks/useRegisteredCount';
import { TournamentDates } from './TournamentDates';

/**
 * The registration deadline, made hard to miss: a red calendar tile for the
 * closing day plus a countdown ("13 days left" … "Last day today!") that
 * pulses in the final three days. Red on purpose — the green tiles are the
 * days you play, the red one is the day sign-ups stop.
 */
export function DeadlineTile({ config, tone = 'light' }: { config: RegistrationConfig; tone?: 'light' | 'dark' }) {
  if (!registrationOpen(config)) return null;
  const { weekday, day, month } = closeDayParts(config);
  const urgent = daysUntilClose(config) <= 3;
  const dark = tone === 'dark';
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        dark ? 'bg-rose-950/60 ring-1 ring-rose-400/50 backdrop-blur-sm' : 'bg-rose-50 ring-1 ring-rose-200'
      }`}
      role="note"
      aria-label={`Registration closes ${closesLabel(config)} — ${countdownLabel(config)}`}
    >
      <div className="w-14 sm:w-16 shrink-0 overflow-hidden rounded-xl bg-white text-center shadow-sm ring-1 ring-rose-300">
        <p className="bg-rose-600 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{weekday}</p>
        <p className="portal-display text-3xl sm:text-4xl leading-none pt-1.5 text-rose-700">{day}</p>
        <p className="pb-1 text-[10px] font-bold uppercase tracking-wider text-rose-500">{month}</p>
      </div>
      <div className="space-y-1">
        <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${dark ? 'text-rose-200' : 'text-rose-700'}`}>
          Registration closes
        </p>
        <p className={`text-sm font-black ${dark ? 'text-white' : 'text-ink'}`}>{closesLabel(config)} · 11:59 PM</p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
          {urgent ? <span className="npl-glow-pulse size-1.5 rounded-full bg-white" aria-hidden /> : null}
          {countdownLabel(config)}
        </p>
      </div>
    </div>
  );
}

/**
 * Big "32 players registered" tile with the split by age group (Kids under
 * 21 / Adults 21+). Hidden until known.
 */
export function RegisteredCount({ stats, open }: { stats: RegisteredStats | null; open: boolean }) {
  if (stats === null) return null;
  const { count, groups } = stats;
  return (
    <div
      className="inline-flex flex-col gap-2.5 rounded-2xl bg-lime-300 px-5 py-3 text-slate-950 shadow-lg shadow-lime-900/20"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <Users className="size-8 shrink-0" aria-hidden />
        <p className="portal-display text-6xl sm:text-7xl leading-none tabular-nums">{count}</p>
        <div className="leading-tight">
          <p className="text-sm font-black uppercase tracking-wide">{count === 1 ? 'Player' : 'Players'} registered</p>
          <p className="text-xs font-semibold text-slate-800">
            {count === 0 ? (open ? 'Be the first to sign up!' : 'No sign-ups') : open ? 'so far — join them!' : 'in total'}
          </p>
        </div>
      </div>
      {groups.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <span key={g.group} className="inline-flex items-baseline gap-1.5 rounded-xl bg-slate-950/10 px-3 py-1.5">
              <span className="portal-display text-2xl leading-none tabular-nums">{g.count}</span>
              <span className="text-xs font-bold">{g.group}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Who's playing — always shown once registration closes: one tab per
 * category (Kids · Singles, …) with a table of its players, and a name
 * search within the tab. Rows slide in one after another on each switch.
 */
function RegisteredPlayers({ config, stats }: { config: RegistrationConfig; stats: RegisteredStats | null }) {
  const [query, setQuery] = useState('');
  const [tabId, setTabId] = useState<string | null>(null);
  /** Last name tapped (n replays the serve on a repeat tap) — shows ServePopup on that row. */
  const [served, setServed] = useState<{ name: string; n: number } | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const tabs = useMemo(
    () =>
      config.categories
        .map((cat) => ({ cat, players: (stats?.players ?? []).filter((p) => p.categories.includes(cat.id)) }))
        .filter((t) => t.players.length > 0),
    [config, stats]
  );
  if (tabs.length === 0) return null;

  const active = tabs.find((t) => t.cat.id === tabId) ?? tabs[0];
  const q = query.trim().toLowerCase();
  const shown = active.players.filter((p) => !q || p.name.toLowerCase().includes(q));
  const formatOf = (id: string) => config.categories.find((c) => c.id === id)?.format ?? '';
  const tabLabel = (c: RegistrationConfig['categories'][number]) => `${shortGroup(c.group)} · ${c.format}`;

  /** Switch tab with a rally: a ball arcs from the old tab and bounces on the new one. */
  const pickTab = (id: string) => {
    const from = tabRefs.current.get(active.cat.id);
    const to = tabRefs.current.get(id);
    const box = headerRef.current;
    const ball = ballRef.current;
    setTabId(id);
    setServed(null);
    if (!from || !to || !box || !ball || id === active.cat.id || reducedMotion()) return;
    const b = box.getBoundingClientRect();
    const centre = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - b.left - 6, y: r.top - b.top - 4 };
    };
    const a = centre(from);
    const z = centre(to);
    const peak = Math.min(a.y, z.y) - 22;
    ball.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px)`, opacity: 1 },
        { transform: `translate(${(a.x + z.x) / 2}px, ${peak}px)`, offset: 0.5 },
        { transform: `translate(${z.x}px, ${z.y}px)`, offset: 0.82 },
        { transform: `translate(${z.x}px, ${z.y - 7}px)`, offset: 0.92 },
        { transform: `translate(${z.x}px, ${z.y}px)`, opacity: 0 }
      ],
      { duration: 620, easing: 'cubic-bezier(0.33, 0, 0.4, 1)' }
    );
  };

  return (
    <section className="npl-reveal overflow-hidden rounded-2xl border border-line bg-white shadow-sm" aria-label="Registered players">
      <header ref={headerRef} className="relative space-y-3 bg-ink px-4 pt-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 text-lime-300" aria-hidden />
          <h3 className="portal-display text-2xl leading-none tracking-wide text-white">Who&rsquo;s playing</h3>
          <span className="ml-auto text-xs font-bold text-white/60 tabular-nums">
            <CountUp value={stats?.players.length ?? 0} /> players
          </span>
        </div>
        {/* Phones: a 2×2 grid of buttons, so every category is visible. Wider: folder tabs joined to the table. */}
        <div
          className="grid grid-cols-2 gap-1.5 pb-3 sm:-mx-1 sm:flex sm:gap-1 sm:overflow-x-auto sm:px-1 sm:pb-0"
          role="tablist"
          aria-label="Categories"
        >
          {tabs.map((t) => {
            const on = t.cat.id === active.cat.id;
            return (
              <button
                key={t.cat.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.cat.id, el);
                  else tabRefs.current.delete(t.cat.id);
                }}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pickTab(t.cat.id)}
                className={`flex shrink-0 flex-wrap items-center justify-center gap-y-0.5 rounded-xl px-2 py-2 text-center text-xs font-bold leading-tight sm:flex-nowrap sm:whitespace-nowrap transition-all duration-300 sm:rounded-b-none sm:rounded-t-xl sm:px-3.5 ${
                  on ? 'bg-white text-ink shadow-md sm:shadow-none' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white sm:bg-transparent'
                }`}
              >
                <PlayerFigure kind={ageKind(t.cat.group)} className="mr-1 inline size-4 -translate-y-px" />
                {tabLabel(t.cat)}{' '}
                <span
                  key={on ? 'on' : 'off'}
                  className={`ml-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    on ? 'npl-badge-pop bg-lime-300 text-slate-950' : 'bg-white/10 text-white/70'
                  }`}
                >
                  <CountUp value={t.players.length} />
                </span>
              </button>
            );
          })}
        </div>
        <span
          ref={ballRef}
          className="pointer-events-none absolute left-0 top-0 z-20 mt-0! size-3 rounded-full bg-lime-300 opacity-0 shadow-[0_0_10px_rgba(190,242,100,0.9)] ring-1 ring-lime-600"
          aria-hidden
        />
      </header>

      <GroupStrip key={active.cat.id} group={active.cat.group} format={active.cat.format} count={active.players.length} />

      <div className="px-4 py-2.5 sm:px-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Find a name in ${tabLabel(active.cat)}`}
            aria-label="Find a player"
            className="w-full rounded-xl border border-line bg-paper-soft py-2 pl-9 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </label>
      </div>

      <div className="max-h-[28rem] overflow-y-auto" role="tabpanel">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-paper-soft/95 backdrop-blur">
            <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <th scope="col" className="w-10 py-2 pl-4 text-left sm:pl-5">#</th>
              <th scope="col" className="py-2 text-left">Player</th>
              <th scope="col" className="py-2 pr-4 text-right sm:pr-5">Also playing</th>
            </tr>
          </thead>
          <tbody key={`${active.cat.id}|${q}`}>
            {shown.map((p, i) => {
              const also = p.categories.filter((id) => id !== active.cat.id).map(formatOf).filter(Boolean);
              return (
                <tr
                  key={`${p.name}-${i}`}
                  onClick={() => setServed((cur) => ({ name: p.name, n: (cur?.n ?? 0) + 1 }))}
                  className="npl-row-in group cursor-pointer border-t border-line/70 transition-colors hover:bg-emerald-50/60"
                  style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}
                >
                  <td className="py-2 pl-4 text-xs tabular-nums text-slate-400 sm:pl-5">{i + 1}</td>
                  <td className="py-2 pr-2">
                    {served?.name === p.name ? (
                      <ServePopup key={served.n} name={p.name} onDone={() => setServed(null)} />
                    ) : null}
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar
                        name={p.name}
                        kind={ageKind(active.cat.group)}
                        woman={p.gender === 'f'}
                        pair={isDoubles(active.cat.format)}
                        delayMs={Math.min(i, 20) * 35 + 120}
                      />
                      <span
                        key={served?.name === p.name ? served.n : 0}
                        className={`truncate rounded-md px-1 font-semibold text-ink ${served?.name === p.name ? 'npl-name-glow' : ''}`}
                      >
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right sm:pr-5">
                    {also.length ? (
                      also.map((f) => (
                        <span key={f} className="ml-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                          {f}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No one in {tabLabel(active.cat)} matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : null}
      </div>
    </section>
  );
}

type AgeKind = 'kids' | 'adults';

function ageKind(group: string): AgeKind {
  return /^kid/i.test(group) ? 'kids' : 'adults';
}

const STRIP: Record<AgeKind, { bg: string; ring: string; tagline: string }> = {
  kids: {
    bg: 'bg-gradient-to-r from-sky-100 via-violet-100 to-amber-100',
    ring: 'bg-white/70 ring-violet-200',
    tagline: 'Future champions on court'
  },
  adults: {
    bg: 'bg-gradient-to-r from-emerald-100 via-lime-100 to-teal-100',
    ring: 'bg-white/70 ring-emerald-200',
    tagline: 'The main draw'
  }
};

/** Coloured strip for the open tab: the age group's figure, name and tagline. */
function GroupStrip({ group, format, count }: { group: string; format: string; count: number }) {
  const kind = ageKind(group);
  const look = STRIP[kind];
  return (
    <div className={`npl-reveal flex items-center gap-4 px-4 py-3 sm:px-5 ${look.bg}`}>
      <span className={`grid size-16 shrink-0 place-items-center rounded-2xl ring-1 shadow-sm ${look.ring}`}>
        {isDoubles(format) ? (
          <span className="npl-figure-bob relative block h-12 w-14">
            <PlayerFigure kind={kind} woman={kind === 'adults'} cap={false} shirt="#db2777" className="absolute -left-1 top-0 size-11" />
            <PlayerFigure kind={kind} className="absolute -right-1 top-0.5 size-11" animated />
          </span>
        ) : (
          <PlayerFigure kind={kind} className="npl-figure-bob size-12" animated />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{look.tagline}</p>
        <p className="portal-display text-2xl leading-none tracking-wide text-ink">
          {group} · {format}
        </p>
        <p className="text-xs font-semibold text-ink-soft">
          <CountUp value={count} /> {count === 1 ? 'player' : 'players'}
        </p>
      </div>
    </div>
  );
}

/**
 * A little tennis player: a kid in a cap, or an adult with a headband —
 * racket up, ball in the air (the ball bounces when `animated`).
 */
function PlayerFigure({
  kind,
  className = '',
  animated = false,
  hoverAnimated = false,
  shirt: shirtColor,
  cap,
  woman = false,
  silhouette
}: {
  kind: AgeKind;
  className?: string;
  /** Ball always bouncing (group strip). */
  animated?: boolean;
  /** Ball bounces only while the surrounding `.group` row is hovered. */
  hoverAnimated?: boolean;
  shirt?: string;
  /** Cap or headband — defaults by age group. */
  cap?: boolean;
  /** Ponytail and skirt. */
  woman?: boolean;
  /** Draw the whole figure in this one colour (a doubles partner in the background). */
  silhouette?: string;
}) {
  const kid = kind === 'kids';
  const one = silhouette;
  const skin = one ?? '#f2c29b';
  const shirt = one ?? shirtColor ?? (kid ? '#7c3aed' : '#059669');
  const wearsCap = cap ?? kid;
  const shorts = one ?? (woman ? '#f472b6' : kid ? '#0ea5e9' : '#0f172a');
  const hair = one ?? (woman ? '#3f2a1d' : '#1e293b');
  const shoes = one ?? '#1e293b';
  const strings = one ?? '#e11d48';
  // Kid: shorter body, bigger head; adult: taller.
  const head = kid ? { cy: 22, r: 7 } : { cy: 15, r: 6 };
  const neck = head.cy + head.r;
  const hip = kid ? 42 : 38;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* legs */}
      <path d={`M30 ${hip} L24 58 M30 ${hip} L37 58`} stroke={skin} strokeWidth="5" strokeLinecap="round" />
      <path d={`M24 58 h-4 M37 58 h4`} stroke={shoes} strokeWidth="4" strokeLinecap="round" />
      {/* shorts (or a skirt) + shirt */}
      {woman ? (
        <path d={`M23.5 ${hip - 4} h13 l4 9 h-21 z`} fill={shorts} />
      ) : (
        <path d={`M24 ${hip - 4} h12 l1 7 h-14 z`} fill={shorts} />
      )}
      <rect x="23" y={neck} width="14" height={hip - neck - 2} rx="5" fill={shirt} />
      {/* back arm + racket arm */}
      <path d={`M25 ${neck + 4} L18 ${neck + 13}`} stroke={skin} strokeWidth="4" strokeLinecap="round" />
      <path d={`M35 ${neck + 4} L44 ${neck - 3}`} stroke={skin} strokeWidth="4" strokeLinecap="round" />
      {/* racket */}
      <path d={`M44 ${neck - 3} L46 ${neck - 6}`} stroke={one ?? '#334155'} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy={neck - 12} rx="5.5" ry="7.5" fill="none" stroke={strings} strokeWidth="2.5" transform={`rotate(20 50 ${neck - 12})`} />
      <path
        d={`M46 ${neck - 15} L54 ${neck - 9} M47 ${neck - 10} L53 ${neck - 15}`}
        stroke={strings}
        strokeWidth="0.8"
        opacity="0.6"
      />
      {/* ponytail (behind the head) */}
      {woman ? (
        <path
          d={`M${28 - head.r} ${head.cy - 1} q-6 4 -3 ${head.r + 6} q3 -3 4 -${head.r + 2} z`}
          fill={hair}
        />
      ) : null}
      {/* head */}
      <circle cx="30" cy={head.cy} r={head.r} fill={skin} />
      {wearsCap ? (
        <>
          {woman ? <path d={`M${30 - head.r} ${head.cy} a${head.r} ${head.r} 0 0 1 ${head.r * 2} 0`} fill={hair} /> : null}
          <path d={`M${30 - head.r} ${head.cy - 2} a${head.r} ${head.r} 0 0 1 ${head.r * 2} 0 h5 v2 h-${head.r * 2 + 5} z`} fill={one ?? '#f59e0b'} />
        </>
      ) : (
        <>
          <path d={`M${30 - head.r} ${head.cy - 1} a${head.r} ${head.r} 0 0 1 ${head.r * 2} 0`} fill={hair} />
          <rect x={30 - head.r} y={head.cy - 2} width={head.r * 2} height="2.5" rx="1" fill={one ?? (woman ? '#a855f7' : '#ef4444')} />
        </>
      )}
      {/* ball */}
      {one ? null : animated ? (
        // Before-serve bounce: the ball drops from the free hand to the court and back.
        <g style={{ ['--drop' as string]: `${54.5 - (neck + 17)}px` }}>
          <ellipse className="npl-ball-shadow" cx="17" cy="58.5" rx="3.2" ry="0.9" fill="#0f172a" opacity="0.25" />
          <circle className="npl-ball-dribble" cx="17" cy={neck + 17} r="3.5" fill="#d9f99d" stroke="#65a30d" strokeWidth="1" />
        </g>
      ) : (
      <circle className={hoverAnimated ? 'npl-ball-hover' : undefined} cx="13" cy={kid ? 14 : 8} r="3.5" fill="#d9f99d" stroke="#65a30d" strokeWidth="1" />
      )}
    </svg>
  );
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A number that rolls up from 0 the first time it scrolls into view (and when it changes). */
function CountUp({ value, ms = 900 }: { value: number; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return;
    }
    let frame = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, ms]);
  return <span ref={ref}>{shown}</span>;
}

function isDoubles(format: string): boolean {
  return /doubles/i.test(format);
}

/** "Kids (under 21)" → "Kids". */
function shortGroup(group: string): string {
  return group.replace(/\s*\(.*\)\s*$/, '');
}

/**
 * The serve animation shown when a name is tapped: a Lottie file at
 * public/animations/tennis-serve.json, played once in a card in the middle
 * of the screen. lottie-web and the file load only on the first tap. No file (or
 * reduced motion) → nothing but the name's lime flash.
 */
const SERVE_ANIMATION_URL = '/animations/tennis-serve.json';
let serveData: Promise<unknown | null> | null = null;

function loadServeData(): Promise<unknown | null> {
  serveData ??= fetch(SERVE_ANIMATION_URL)
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
    .catch(() => null);
  return serveData;
}

function ServePopup({ name, onDone }: { name: string; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (reducedMotion()) return;
    let anim: { destroy: () => void } | null = null;
    let cancelled = false;
    void Promise.all([import('lottie-web/build/player/lottie_light'), loadServeData()]).then(([mod, data]) => {
      if (cancelled || !box.current || !data) return;
      const player = mod.default.loadAnimation({
        container: box.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: data
      });
      player.addEventListener('complete', () => done.current());
      anim = player;
      setReady(true);
    });
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-1/2 z-50 w-44 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-black/10 ${
        ready ? 'npl-serve-pop' : 'invisible'
      }`}
      aria-hidden
    >
      <div ref={box} className="aspect-square w-full" />
      <p className="truncate pb-1 text-center text-sm font-black text-emerald-700">{name.split(' ')[0]} serves!</p>
    </div>
  );
}

const AVATAR_LOOKS = [
  { bg: 'bg-violet-100', shirt: '#7c3aed' },
  { bg: 'bg-sky-100', shirt: '#0284c7' },
  { bg: 'bg-emerald-100', shirt: '#059669' },
  { bg: 'bg-amber-100', shirt: '#d97706' },
  { bg: 'bg-rose-100', shirt: '#e11d48' },
  { bg: 'bg-teal-100', shirt: '#0d9488' }
];

/**
 * A player's own little figure: kid or adult by age group, with a shirt
 * colour and cap/headband picked from their name (so it stays the same).
 * Pops in with the row; swings and bounces the ball when the row is hovered.
 */
function PlayerAvatar({
  name,
  kind,
  woman = false,
  pair = false,
  delayMs = 0
}: {
  name: string;
  kind: AgeKind;
  woman?: boolean;
  /** Doubles: a faded partner stands behind the player. */
  pair?: boolean;
  delayMs?: number;
}) {
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const look = AVATAR_LOOKS[hash % AVATAR_LOOKS.length];
  const anim = 'transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110';
  return (
    <span
      className={`npl-avatar-pop relative grid h-9 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-black/5 ${look.bg} ${
        pair ? 'w-12' : 'w-9'
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden
    >
      {pair ? (
        <PlayerFigure
          kind={kind}
          silhouette="#94a3b8"
          className="absolute left-0 top-1 size-7 opacity-50 transition-transform duration-300 group-hover:-translate-x-0.5"
        />
      ) : null}
      <PlayerFigure
        kind={kind}
        woman={woman}
        shirt={look.shirt}
        cap={(hash >> 3) % 2 === 0}
        hoverAnimated
        className={`size-8 translate-y-0.5 ${pair ? 'translate-x-1.5' : ''} ${anim}`}
      />
    </span>
  );
}

/** Lime "Register" pill for a sport hero — only while registration is open. */
export function RegisterButton({ config, slug }: { config: RegistrationConfig; slug: string }) {
  if (!registrationOpen(config)) return null;
  return (
    <Link
      to={`/${slug}/register`}
      className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 text-slate-950 font-black text-xs uppercase tracking-wide px-4 py-2.5 shadow-lg hover:bg-lime-200"
    >
      <ClipboardPen className="size-3.5" aria-hidden />
      Register
      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] text-white">{countdownLabel(config)}</span>
    </Link>
  );
}

/**
 * The tournament's dates + registration status under a sport hero: a
 * "Register now" card while open (with the closing day and how many have
 * registered), a quiet "Registration closed" card afterwards.
 */
export function RegistrationBanner({ config, slug, sport }: { config: RegistrationConfig; slug: string; sport: RegistrationKey }) {
  const open = registrationOpen(config);
  const stats = useRegisteredCount(sport);
  const who = `${groupsOf(config).join(' and ')} · Singles & Doubles`;
  const closes = closesLabel(config);

  if (!open) {
    return (
      <div className="rounded-2xl border border-line bg-paper-soft px-5 py-5 space-y-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1 basis-60 space-y-1">
            <p className="inline-flex rounded-full bg-rose-600 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
              Registrations closed
            </p>
            <p className="portal-display text-3xl text-ink tracking-wide leading-none">{config.title}</p>
            <p className="text-xs text-ink-soft">
              Closed on {closes}. {who} — the draw and match times will be published here.
            </p>
          </div>
          <RegisteredCount stats={stats} open={false} />
          <TournamentDates weekends={config.weekends} />
        </div>
        <RegisteredPlayers config={config} stats={stats} />
      </div>
    );
  }

  return (
    <Link
      to={`/${slug}/register`}
      className="group flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-5 py-5 hover:border-emerald-400"
    >
      <div className="min-w-0 flex-1 basis-60 space-y-1.5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Registration is open</p>
        <p className="portal-display text-3xl text-ink tracking-wide leading-none">{config.title}</p>
        <p className="text-xs text-ink-soft">{who}</p>
      </div>
      <RegisteredCount stats={stats} open />
      <TournamentDates weekends={config.weekends} />
      <DeadlineTile config={config} />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition-all group-hover:gap-2.5">
        Register now
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
