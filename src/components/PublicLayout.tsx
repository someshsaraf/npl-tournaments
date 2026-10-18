import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Home, Info, Lock, Menu, MessageCircleQuestion, Trophy, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LOGO_SRC = '/nature-walk-logo-1.png';

type NavItem = { to: string; label: string; end: boolean; icon: LucideIcon; disabled?: boolean };

/**
 * Whole-site nav. Sport-specific pages (Schedule/Live/Recordings/Rules…) are
 * NOT here — they live in each sport's hub (/badminton, /lawn-tennis),
 * reached from the sport picker on Home.
 * Ask and About RNW are temporarily disabled — shown greyed out with a
 * "Soon" tag rather than removed. Flip `disabled` to re-enable.
 */
const NAV: ReadonlyArray<NavItem> = [
  { to: '/sports', label: 'Sports', end: true, icon: Home },
  { to: '/badminton', label: 'Badminton', end: false, icon: Trophy },
  { to: '/lawn-tennis', label: 'Lawn Tennis', end: false, icon: Trophy },
  { to: '/photos', label: 'Photos', end: false, icon: Camera },
  { to: '/ask', label: 'Ask', end: false, icon: MessageCircleQuestion, disabled: true },
  { to: '/about', label: 'About RNW', end: false, icon: Info, disabled: true }
];

/**
 * Public viewer shell. Admin (/admin) and scorer (/scorer) are intentionally
 * not linked anywhere on resident pages — staff reach them by direct URL only.
 * Stateless layout; route state via React Router.
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, logout } = useAuth();

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
    <div className="npl-portal min-h-full flex flex-col text-slate-900">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              className="shrink-0 inline-flex items-center justify-center size-10 rounded-full border border-line bg-white text-ink hover:bg-paper-soft transition-colors"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="shrink-0 rounded-xl bg-white p-1 shadow-sm ring-1 ring-line size-10 sm:size-12">
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
              <p className="portal-display text-2xl sm:text-3xl text-ink tracking-wide truncate">
                Renaissance Nature Walk
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!loading ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void logout().then(() => navigate('/'))}
                  aria-label="Lock this device"
                  title="Lock this device (asks for the access code again)"
                  className="inline-flex items-center justify-center size-8 rounded-full border border-line bg-white text-ink-soft hover:bg-paper-soft transition-colors"
                >
                  <Lock className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="npl-nav-overlay fixed inset-0 z-50 bg-white/98 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
              className="shrink-0 inline-flex items-center justify-center size-10 rounded-full border border-line bg-white text-ink hover:bg-paper-soft transition-colors"
            >
              <X className="size-5" aria-hidden />
            </button>
            <span className="shrink-0 rounded-xl bg-white p-1 shadow-sm ring-1 ring-line size-10 sm:size-12">
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
              if (item.disabled) {
                return (
                  <div
                    key={item.to}
                    aria-disabled="true"
                    className="npl-nav-pill flex items-center justify-between gap-4 rounded-2xl px-5 sm:px-6 py-4 sm:py-5 text-lg sm:text-xl font-semibold bg-paper-soft text-slate-400 cursor-not-allowed"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.label}
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                        Soon
                      </span>
                    </span>
                    <span className="shrink-0 inline-flex items-center justify-center size-11 sm:size-12 rounded-full bg-black/5">
                      <Icon className="size-5 sm:size-6" aria-hidden />
                    </span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'npl-nav-pill group flex items-center justify-between gap-4 rounded-2xl px-5 sm:px-6 py-4 sm:py-5 text-lg sm:text-xl font-semibold transition-colors border',
                      isActive
                        ? 'bg-ink text-white border-ink'
                        : 'bg-white text-ink border-line hover:bg-paper-soft'
                    ].join(' ')
                  }
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      <span
                        className={`shrink-0 inline-flex items-center justify-center size-11 sm:size-12 rounded-full ${
                          isActive ? 'bg-white/15' : 'bg-black/5 group-hover:bg-black/10'
                        }`}
                      >
                        <Icon className="size-5 sm:size-6" aria-hidden />
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      ) : null}

      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-5 py-5 sm:py-7">
        <Outlet />
      </main>

      <footer className="bg-ink text-white">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div className="space-y-2">
            <p className="portal-display text-2xl tracking-wide">Renaissance</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Sports tournaments for the Renaissance Nature Walk community.
            </p>
          </div>
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Sports</p>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>
                <Link to="/badminton" className="hover:text-white transition-colors">
                  Badminton
                </Link>
              </li>
              <li>
                <Link to="/lawn-tennis" className="hover:text-white transition-colors">
                  Lawn Tennis
                </Link>
              </li>
              <li className="text-slate-600">Table Tennis (Soon)</li>
            </ul>
          </div>
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Quick Access</p>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>
                <Link to="/photos" className="hover:text-white transition-colors">
                  Photos
                </Link>
              </li>
              <li className="text-slate-600">Ask (Soon)</li>
              <li className="text-slate-600">About RNW (Soon)</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-[11px] text-slate-500 tracking-wide">
          Renaissance Nature Walk · Sports
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
