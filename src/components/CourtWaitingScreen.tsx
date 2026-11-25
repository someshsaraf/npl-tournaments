import { Link } from 'react-router-dom';
import type { Sport } from '../data/tournamentData';
import { SPORT_LABEL } from '../data/tournamentData';
import { adminPathForSport, sportCardBySport } from '../data/sports';

/**
 * Shown on court screens / scorers for a sport whose live node is still
 * empty, instead of the built-in (badminton) placeholder match.
 */
export function CourtWaitingScreen({ sport, staff = false }: { sport: Sport; staff?: boolean }) {
  const card = sportCardBySport(sport);
  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center overflow-hidden">
      {card.heroImage ? (
        <img src={card.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
      <div className="relative text-center space-y-4 px-6">
        <p className="text-sm sm:text-base font-black uppercase tracking-[0.4em] text-lime-300">{SPORT_LABEL[sport]}</p>
        <h1 className="font-black tracking-tight leading-none" style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}>
          Next match soon
        </h1>
        {staff ? (
          <p className="text-slate-300">
            No match loaded.{' '}
            <Link to={adminPathForSport(sport)} className="text-lime-300 underline font-bold">
              Start one from the {SPORT_LABEL[sport]} admin
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
