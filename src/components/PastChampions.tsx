import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { ChevronDown, Medal, Trophy } from 'lucide-react';
import { groupByYear, type PastWinner } from '../data/pastWinners';
import type { Sport } from '../data/tournamentData';
import { usePastWinners } from '../hooks/usePastWinners';

/**
 * "Reigning champions" for a sport hub: the latest season's winners as gold
 * cards, with earlier seasons in an expandable list below. Hidden until an
 * admin enters past winners (Admin → sport → Past winners).
 *
 * Celebration: a confetti shower the first time the section scrolls into
 * view, then — while it stays on screen — fireworks over the cards every
 * few seconds and a light confetti drizzle. A champion's card bursts
 * confetti from its trophy when tapped.
 */
export function PastChampions({ sport }: { sport: Sport }) {
  // Category rows still waiting for names stay hidden.
  const winners = usePastWinners(sport).winners.filter((w) => w.winner);
  const [showOlder, setShowOlder] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const hasWinners = winners.length > 0;

  // A shower the first time it's properly in view; then fireworks and a
  // drizzle that run only while the section is on screen and the tab is visible.
  useEffect(() => {
    const el = sectionRef.current;
    if (!hasWinners || !el || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    let onScreen = false;
    let showered = false;
    let fireworkTimer = 0;
    let drizzleTimer = 0;
    const running = () => onScreen && document.visibilityState === 'visible';
    const nextFirework = () => {
      fireworkTimer = window.setTimeout(() => {
        if (running() && skyRef.current) launchFirework(skyRef.current);
        nextFirework();
      }, rand(1800, 3000));
    };
    const start = () => {
      if (!running() || fireworkTimer) return;
      if (skyRef.current) launchFirework(skyRef.current);
      nextFirework();
      drizzleTimer = window.setInterval(() => {
        if (running() && layerRef.current) confettiDrizzle(layerRef.current);
      }, 350);
    };
    const stop = () => {
      window.clearTimeout(fireworkTimer);
      window.clearInterval(drizzleTimer);
      fireworkTimer = 0;
      drizzleTimer = 0;
    };
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (!onScreen) return stop();
        if (!showered && layerRef.current) {
          showered = true;
          confettiShower(layerRef.current);
        }
        start();
      },
      // Low threshold: on phones the section can be taller than the screen.
      { threshold: 0.15 }
    );
    const onVisibility = () => (running() ? start() : stop());
    io.observe(el);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [hasWinners]);

  if (!hasWinners) return null;
  const [latest, ...older] = groupByYear(winners);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-5 sm:p-7 shadow-sm space-y-5"
      aria-labelledby="past-champions-heading"
    >
      <Trophy className="pointer-events-none absolute -right-6 -top-6 size-40 text-amber-200/50 rotate-12" aria-hidden />
      <header className="relative space-y-1">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Hall of champions</p>
        <h2 id="past-champions-heading" className="portal-display text-3xl sm:text-4xl text-ink tracking-wide">
          {latest.year} Champions
        </h2>
      </header>

      <ul className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {latest.winners.map((w) => (
          <ChampionCard key={w.id} w={w} layer={layerRef} />
        ))}
      </ul>

      {older.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOlder((v) => !v)}
            aria-expanded={showOlder}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800 hover:text-amber-900"
          >
            Earlier seasons
            <ChevronDown className={`size-3.5 transition-transform ${showOlder ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {showOlder ? (
            <div className="mt-3 space-y-4">
              {older.map((g) => (
                <div key={g.year} className="space-y-1.5">
                  <h3 className="text-sm font-black text-ink">{g.year}</h3>
                  <ul className="divide-y divide-amber-100 rounded-2xl border border-amber-100 bg-white/80">
                    {g.winners.map((w) => (
                      <li key={w.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2 text-sm">
                        <span className="text-slate-500">{w.category || 'Champion'}</span>
                        <span className="font-bold text-ink">
                          <Trophy className="inline size-3.5 mr-1 -mt-0.5 text-amber-500" aria-hidden />
                          {w.winner}
                          {w.runnerUp ? <span className="font-normal text-slate-500"> · runner-up {w.runnerUp}</span> : null}
                          {w.score ? <span className="font-normal text-slate-400 tabular-nums"> · {w.score}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {/* Fireworks, then confetti, in front of the cards (on phones the cards fill the width, so behind them
          they'd be hidden) — taps pass through. */}
      <div ref={skyRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden />
      <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden />
    </section>
  );
}

function ChampionCard({ w, layer }: { w: PastWinner; layer: RefObject<HTMLDivElement | null> }) {
  const trophy = useRef<HTMLSpanElement>(null);
  const celebrate = (e: MouseEvent) => {
    const box = layer.current;
    const t = trophy.current;
    if (!box || !t || reducedMotion()) return;
    const b = box.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    // From the trophy; a tap elsewhere on the card bursts from there instead.
    const fromTrophy = e.target instanceof Node && t.contains(e.target);
    const x = (fromTrophy ? r.left + r.width / 2 : e.clientX) - b.left;
    const y = (fromTrophy ? r.top + r.height / 2 : e.clientY) - b.top;
    confettiBurst(box, x, y);
  };
  return (
    <li
      onClick={celebrate}
      title="Tap to celebrate"
      className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white border border-amber-200 px-4 py-3 shadow-sm transition-transform active:scale-[0.98]"
    >
      <span
        ref={trophy}
        className="grid place-items-center size-10 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-white shadow-inner"
      >
        <Trophy className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">{w.category || 'Champion'}</p>
          {w.score ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-900">{w.score}</span>
          ) : null}
        </div>
        <p className="text-lg font-black leading-tight text-ink break-words">{w.winner}</p>
        {w.runnerUp ? (
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <Medal className="size-3 text-slate-400" aria-hidden />
            Runner-up: {w.runnerUp}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// --- Confetti -----------------------------------------------------------

const CONFETTI_COLOURS = ['#f59e0b', '#fbbf24', '#fde68a', '#facc15', '#a3e635', '#10b981', '#ffffff', '#fb7185'];

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** One paper piece: a small rectangle, square or dot in a party colour. */
function piece(layer: HTMLElement, x: number, y: number): HTMLSpanElement {
  const el = document.createElement('span');
  const shape = Math.random();
  const w = shape < 0.2 ? rand(5, 7) : rand(6, 10);
  const h = shape < 0.2 ? w : shape < 0.6 ? rand(3, 5) : rand(8, 12);
  Object.assign(el.style, {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
    background: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
    borderRadius: shape < 0.2 ? '50%' : '1.5px',
    boxShadow: '0 0 0 0.5px rgba(146, 64, 14, 0.15)',
    willChange: 'transform, opacity'
  });
  layer.appendChild(el);
  return el;
}

/**
 * Path under gravity, as keyframes: starts with (vx, vy) px/s, falls at
 * `g` px/s², tumbles as it goes (rotateX gives the paper "flutter").
 */
function fly(el: HTMLElement, vx: number, vy: number, g: number, ms: number, sway = 0) {
  const spin = rand(-720, 720);
  const flip = rand(360, 1080);
  const steps = 12;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const t = (f * ms) / 1000;
    // Air drag: sideways speed fades over the flight.
    const x = vx * t * (1 - f * 0.45) + Math.sin(f * Math.PI * 3) * sway;
    const y = vy * t + 0.5 * g * t * t;
    frames.push({
      transform: `translate(${x}px, ${y}px) rotate(${spin * f}deg) rotateX(${flip * f}deg)`,
      opacity: f < 0.75 ? 1 : 1 - (f - 0.75) / 0.25
    });
  }
  el.animate(frames, { duration: ms, easing: 'linear', fill: 'forwards' }).onfinish = () => el.remove();
}

/** A celebratory pop from one point: pieces fly up and out, then flutter down. */
function confettiBurst(layer: HTMLElement, x: number, y: number, count = 36) {
  for (let i = 0; i < count; i++) {
    const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05); // upward fan
    const speed = rand(220, 520);
    fly(piece(layer, x, y), Math.cos(angle) * speed, Math.sin(angle) * speed, 900, rand(1300, 2000), rand(4, 14));
  }
}

/** Confetti raining down across the whole section, plus a pop at each top corner. */
function confettiShower(layer: HTMLElement) {
  const { width, height } = layer.getBoundingClientRect();
  const count = Math.round(Math.min(90, Math.max(45, width / 9)));
  for (let i = 0; i < count; i++) {
    const el = piece(layer, rand(0, width), rand(-40, -10));
    const ms = rand(2200, 3400);
    // Fall the full height (plus a bit) in `ms`, drifting sideways.
    const g = (2 * (height + 60)) / (ms / 1000) ** 2;
    el.style.opacity = '0';
    window.setTimeout(() => {
      el.style.opacity = '1';
      fly(el, rand(-40, 40), rand(0, 60), g, ms, rand(10, 26));
    }, rand(0, 700));
  }
  confettiBurst(layer, width * 0.08, height * 0.15, 22);
  confettiBurst(layer, width * 0.92, height * 0.15, 22);
}

/** One piece drifting down from the top edge — called on a timer for a light, steady fall. */
function confettiDrizzle(layer: HTMLElement) {
  const { width, height } = layer.getBoundingClientRect();
  const el = piece(layer, rand(0, width), -12);
  const ms = rand(3200, 4600);
  fly(el, rand(-25, 25), rand(10, 40), (2 * (height + 40)) / (ms / 1000) ** 2, ms, rand(12, 30));
}

// --- Fireworks ----------------------------------------------------------

const FIREWORK_COLOURS = ['#f59e0b', '#facc15', '#a3e635', '#34d399', '#38bdf8', '#f472b6', '#fb923c'];

/** A rocket climbs from the bottom edge, then bursts into a ring of falling sparks. */
function launchFirework(sky: HTMLElement) {
  const { width, height } = sky.getBoundingClientRect();
  if (!width || !height) return;
  const x = rand(width * 0.12, width * 0.88);
  // Burst within the part of the section that's on screen (it can be taller than a phone).
  const box = sky.getBoundingClientRect();
  const top = Math.max(0, -box.top);
  const bottom = Math.min(height, window.innerHeight - box.top);
  if (bottom - top < 120) return;
  const y = top + rand(0.15, 0.5) * (bottom - top);
  const colour = FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)];
  const second = FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)];

  const rocket = document.createElement('span');
  Object.assign(rocket.style, {
    position: 'absolute',
    left: `${x - 1.5}px`,
    top: `${bottom}px`,
    width: '3px',
    height: '14px',
    borderRadius: '2px',
    background: `linear-gradient(to top, transparent, ${colour})`,
    filter: 'drop-shadow(0 0 4px ' + colour + ')'
  });
  sky.appendChild(rocket);
  const climb = rocket.animate(
    [
      { transform: 'translate(0, 0)', opacity: 0.9 },
      { transform: `translate(${rand(-12, 12)}px, ${y - bottom}px)`, opacity: 1 }
    ],
    { duration: rand(650, 900), easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' }
  );
  climb.onfinish = () => {
    rocket.remove();
    burst(sky, x, y, colour, second);
  };
}

function burst(sky: HTMLElement, x: number, y: number, colour: string, second: string) {
  // A soft flash where it bursts.
  const flash = document.createElement('span');
  Object.assign(flash.style, {
    position: 'absolute',
    left: `${x - 40}px`,
    top: `${y - 40}px`,
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: `radial-gradient(circle, ${colour}66 0%, transparent 70%)`
  });
  sky.appendChild(flash);
  flash.animate(
    [
      { transform: 'scale(0.2)', opacity: 1 },
      { transform: 'scale(1.6)', opacity: 0 }
    ],
    { duration: 700, easing: 'ease-out', fill: 'forwards' }
  ).onfinish = () => flash.remove();

  const sparks = Math.round(rand(26, 38));
  const ring = rand(90, 150); // px/s outward
  for (let i = 0; i < sparks; i++) {
    const angle = (i / sparks) * Math.PI * 2 + rand(-0.08, 0.08);
    const speed = ring * rand(0.75, 1.1);
    const c = i % 3 === 0 ? second : colour;
    const dot = document.createElement('span');
    const size = rand(2.5, 4);
    Object.assign(dot.style, {
      position: 'absolute',
      left: `${x - size / 2}px`,
      top: `${y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: c,
      boxShadow: `0 0 6px 1px ${c}`
    });
    sky.appendChild(dot);
    const ms = rand(1100, 1600);
    const frames: Keyframe[] = [];
    for (let k = 0; k <= 10; k++) {
      const f = k / 10;
      const t = (f * ms) / 1000;
      // Sparks slow down (drag) and droop (gravity), fading out as they go.
      const travel = speed * t * (1 - f * 0.5);
      frames.push({
        transform: `translate(${Math.cos(angle) * travel}px, ${Math.sin(angle) * travel + 0.5 * 140 * t * t}px) scale(${1 - f * 0.5})`,
        opacity: f < 0.4 ? 1 : 1 - (f - 0.4) / 0.6
      });
    }
    dot.animate(frames, { duration: ms, easing: 'linear', fill: 'forwards' }).onfinish = () => dot.remove();
  }
}
