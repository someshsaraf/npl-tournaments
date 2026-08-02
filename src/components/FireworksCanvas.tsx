import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: 'spark' | 'trail';
};

type Rocket = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  burstAt: number;
};

const COLORS = [
  '#fbbf24',
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#a78bfa',
  '#fb7185',
  '#fde68a',
  '#ffffff'
];

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#fbbf24';
}

function burst(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  density: number
): void {
  const count = Math.max(12, Math.floor((48 + Math.floor(Math.random() * 24)) * density));
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
    const speed = (2.2 + Math.random() * 4.5) * Math.max(0.45, density);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 0.7 + Math.random() * 0.6,
      color,
      size: (1.5 + Math.random() * 2.5) * Math.max(0.55, density),
      kind: 'spark'
    });
  }
}

type FireworksCanvasProps = {
  /** Extra className for the canvas element */
  className?: string;
  /**
   * When true, size/spawn relative to the parent box (score bug).
   * When false, use the full viewport (WinnerCelebration).
   */
  contain?: boolean;
};

/**
 * Fireworks canvas. Animation runs only while mounted.
 * Concurrency: local RAF/state per mount; cleaned up on unmount (no shared globals).
 * Respects prefers-reduced-motion by skipping the animation loop.
 */
export function FireworksCanvas({ className, contain = false }: FireworksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const rockets: Rocket[] = [];
    const particles: Particle[] = [];
    let spawnTimer = 0;
    let viewW = 0;
    let viewH = 0;
    const density = contain ? 0.55 : 1;

    const measure = (): { w: number; h: number } => {
      if (contain) {
        const parent = canvas.parentElement;
        const w = Math.max(1, parent?.clientWidth ?? 160);
        const h = Math.max(1, parent?.clientHeight ?? 80);
        return { w, h };
      }
      return { w: window.innerWidth, h: window.innerHeight };
    };

    const resize = () => {
      const { w, h } = measure();
      viewW = w;
      viewH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnRocket = () => {
      const w = viewW;
      const h = viewH;
      rockets.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h + 8,
        vx: (Math.random() - 0.5) * (contain ? 0.8 : 1.2),
        vy: -(contain ? 3.2 + Math.random() * 2.2 : 6.5 + Math.random() * 3.5),
        color: pickColor(),
        burstAt: h * (0.12 + Math.random() * 0.4)
      });
    };

    const tick = () => {
      if (!running) return;
      const w = viewW;
      const h = viewH;

      ctx.clearRect(0, 0, w, h);

      spawnTimer += 1;
      const maxRockets = contain ? 3 : 6;
      const spawnEvery = contain ? 22 : 18;
      if (spawnTimer % spawnEvery === 0 && rockets.length < maxRockets) {
        spawnRocket();
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const r = rockets[i];
        if (!r) continue;
        r.x += r.vx;
        r.y += r.vy;
        r.vy += contain ? 0.05 : 0.035;

        particles.push({
          x: r.x,
          y: r.y,
          vx: 0,
          vy: 0.4,
          life: 1,
          maxLife: 0.35,
          color: r.color,
          size: contain ? 1.4 : 2,
          kind: 'trail'
        });

        ctx.beginPath();
        ctx.fillStyle = r.color;
        ctx.arc(r.x, r.y, contain ? 1.8 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.burstAt || r.vy >= 0) {
          burst(particles, r.x, r.y, r.color, density);
          burst(particles, r.x, r.y, pickColor(), density);
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        if (!p) continue;
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === 'spark') {
          p.vy += contain ? 0.06 : 0.045;
          p.vx *= 0.99;
        }
        p.life -= 1 / (60 * p.maxLife);
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      raf = window.requestAnimationFrame(tick);
    };

    resize();
    for (let i = 0; i < (contain ? 2 : 3); i += 1) spawnRocket();
    raf = window.requestAnimationFrame(tick);
    window.addEventListener('resize', resize);

    let ro: ResizeObserver | null = null;
    if (contain && typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas.parentElement);
    }

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
    };
  }, [contain]);

  const canvasClass =
    typeof className === 'string' && className.trim()
      ? className.trim()
      : 'pointer-events-none absolute inset-0';

  return <canvas ref={canvasRef} className={canvasClass} aria-hidden="true" />;
}

export default FireworksCanvas;
