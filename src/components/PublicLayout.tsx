import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Home, Info, LogOut, Menu, MessageCircleQuestion, Radio, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LOGO_SRC = '/nature-walk-logo-1.png';

type NavItem = { to: string; label: string; end: boolean; icon: LucideIcon; disabled?: boolean };

/**
 * Whole-site nav. Sport-specific pages (Schedule/Results/Stats/Teams/Live/
 * Recordings/Rules) are NOT here — they live inside each sport event's own
 * page (/events/:id), reached by tapping that event's tile on Home.
 * Ask and About RNW are temporarily disabled — shown greyed out with a
 * "Soon" tag rather than removed. Flip `disabled` to re-enable.
 */
const NAV: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Home', end: true, icon: Home },
  { to: '/photos', label: 'Photos', end: false, icon: Camera },
  { to: '/ask', label: 'Ask', end: false, icon: MessageCircleQuestion, disabled: true },
  { to: '/about', label: 'About RNW', end: false, icon: Info, disabled: true }
];

/**
 * Public viewer shell. Admin (/admin) and scorer (/scorer) are intentionally
 * omitted from this nav — staff reach them by direct URL only.
 * Stateless layout; route state via React Router.
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

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
            <Link
              to="/live"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-ink text-white text-xs font-bold px-3.5 py-1.5 hover:bg-slate-800 transition-colors"
            >
              <Radio className="size-3.5" aria-hidden />
              Live Score Hub
            </Link>
            {!loading ? (
              user ? (
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <User className="size-3.5 text-ink-soft" aria-hidden />
                    {user.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    aria-label="Log out"
                    className="inline-flex items-center justify-center size-8 rounded-full border border-line bg-white text-ink-soft hover:bg-paper-soft transition-colors"
                  >
                    <LogOut className="size-3.5" aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white text-xs font-bold px-3.5 py-1.5 hover:bg-slate-800 transition-colors"
                >
                  <User className="size-3.5" aria-hidden />
                  Login
                </button>
              )
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
              Cultural celebrations and sports tournaments for the Renaissance Nature Walk community.
            </p>
          </div>
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Categories</p>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>
                <Link to="/?category=cultural" className="hover:text-white transition-colors">
                  Cultural
                </Link>
              </li>
              <li>
                <Link to="/?category=sports" className="hover:text-white transition-colors">
                  Sports
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  All Events
                </Link>
              </li>
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
              <li>
                <Link to="/admin/login" className="hover:text-white transition-colors">
                  Admin Login
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-[11px] text-slate-500 tracking-wide">
          Renaissance Nature Walk · Cultural &amp; Sports 2026
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
