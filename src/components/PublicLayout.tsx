import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Camera, Home, Menu, MessageCircleQuestion, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const LOGO_SRC = '/nature-walk-logo-1.png';

type NavItem = { to: string; label: string; end: boolean; icon: LucideIcon };

/**
 * Whole-site nav. Sport-specific pages (Schedule/Results/Stats/Teams/Live/
 * Recordings/Rules) are NOT here — they live inside each sport event's own
 * page (/events/:id), reached by tapping that event's tile on Home.
 */
const NAV: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Home', end: true, icon: Home },
  { to: '/photos', label: 'Photos', end: false, icon: Camera },
  { to: '/ask', label: 'Ask', end: false, icon: MessageCircleQuestion }
];

/**
 * Public viewer shell. Admin (/admin) and scorer (/scorer) are intentionally
 * omitted from this nav — staff reach them by direct URL only.
 * Stateless layout; route state via React Router.
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close on route change (nav click) and on Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="npl-portal min-h-full flex flex-col text-slate-100">
      <header className="relative sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" aria-hidden />
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              className="shrink-0 inline-flex items-center justify-center size-10 rounded-full border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="shrink-0 rounded-xl bg-white p-1 shadow-md ring-1 ring-emerald-400/40 size-10 sm:size-12">
              <img
                src={LOGO_SRC}
                alt="Renaissance Nature Walk"
                width={48}
                height={48}
                className="h-full w-full rounded-lg object-cover"
                draggable={false}
              />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="portal-display text-2xl sm:text-3xl text-white tracking-wide truncate">
                Renaissance Nature Walk
              </p>
            </div>
          </div>
          <p className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-emerald-400/80 font-semibold shrink-0">
            Cultural &amp; Sports
          </p>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="npl-nav-overlay fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
              className="shrink-0 inline-flex items-center justify-center size-10 rounded-full border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="size-5" aria-hidden />
            </button>
            <span className="shrink-0 rounded-xl bg-white p-1 shadow-md ring-1 ring-emerald-400/40 size-10 sm:size-12">
              <img
                src={LOGO_SRC}
                alt=""
                width={48}
                height={48}
                className="h-full w-full rounded-lg object-cover"
                draggable={false}
              />
            </span>
            <span className="w-10 sm:w-12" aria-hidden />
          </div>

          <nav className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6 space-y-3">
            {NAV.map((item, i) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'npl-nav-pill group flex items-center justify-between gap-4 rounded-2xl px-5 sm:px-6 py-4 sm:py-5 text-lg sm:text-xl font-semibold transition-colors',
                      isActive
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900 text-slate-100 hover:bg-slate-800'
                    ].join(' ')
                  }
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {item.label}
                  <span className="shrink-0 inline-flex items-center justify-center size-11 sm:size-12 rounded-full bg-slate-950/20 group-hover:bg-slate-950/30">
                    <Icon className="size-5 sm:size-6" aria-hidden />
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      ) : null}

      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-5 py-5 sm:py-7">
        <Outlet />
      </main>

      <footer className="relative py-6 text-center text-[11px] text-slate-500 tracking-wide">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700/70 to-transparent" aria-hidden />
        Renaissance Nature Walk · Cultural &amp; Sports 2026
      </footer>
    </div>
  );
}

export default PublicLayout;
