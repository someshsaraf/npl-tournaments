import { Link } from 'react-router-dom';
import { Camera, MessageCircleQuestion, PartyPopper } from 'lucide-react';
import { Reveal } from '../components/Reveal';

const QUICK_LINKS = [
  {
    to: '/',
    label: 'Browse events',
    description: 'Every cultural celebration and sports tournament, all year round.',
    icon: PartyPopper
  },
  {
    to: '/photos',
    label: 'Photo gallery',
    description: 'Community-uploaded photos and clips from past events.',
    icon: Camera
  },
  {
    to: '/ask',
    label: 'Ask',
    description: 'Quick answers on schedules, results, and live scores.',
    icon: MessageCircleQuestion
  }
] as const;

/**
 * Static "about" page for the community/platform. Content is placeholder
 * copy — tell me what to change and I'll edit it directly.
 */
export default function AboutPage() {
  return (
    <div className="relative space-y-10">
      <div className="npl-blob -top-16 -left-16 size-72 bg-orange-500/20" aria-hidden />

      <Reveal className="relative z-10 space-y-4 max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90 font-semibold">
          About
        </p>
        <h1 className="npl-flame-text portal-display text-4xl sm:text-6xl tracking-wide leading-[0.95]">
          Renaissance Nature Walk
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Renaissance Nature Walk is our residential community, and this site is where we bring the
          community together — cultural celebrations like Ganesh Utsav, Diwali, and Holi, alongside
          sports tournaments like Badminton and Tennis, all through the year.
        </p>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Browse what's coming up, catch live scores during a tournament, and look back at photos
          from past events — all in one place.
        </p>
      </Reveal>

      <Reveal delayMs={100} className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className="npl-glass group rounded-2xl p-5 space-y-2.5 transition-all hover:-translate-y-1 hover:border-white/25"
            >
              <span className="inline-flex items-center justify-center size-10 rounded-full bg-white/10 text-amber-300 group-hover:bg-white/15">
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="font-bold text-white">{link.label}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{link.description}</p>
            </Link>
          );
        })}
      </Reveal>
    </div>
  );
}
