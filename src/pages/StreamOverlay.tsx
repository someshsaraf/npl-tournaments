import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import { toYouTubeEmbedUrl } from '../utils/youtube';

export const StreamOverlay: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMatch({
          ...INITIAL_MATCH,
          ...data,
          youtubeLiveUrl: typeof data.youtubeLiveUrl === 'string' ? data.youtubeLiveUrl : '',
          gameWinner: (data.gameWinner === 1 || data.gameWinner === 2) ? data.gameWinner : null
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const activeServer = match.server === 2 ? 2 : 1;
  const embedUrl = toYouTubeEmbedUrl(match.youtubeLiveUrl ?? '');
  const servingSide = (match.servingSide ?? 'right').toUpperCase();
  const teamA = match.teamA || 'Team A';
  const teamB = match.teamB || 'Team B';
  const player1 = match.player1 || 'Player 1';
  const player2 = match.player2 || 'Player 2';
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const maxPoints = match.maxPoints ?? 11;
  const hasWinner = match.gameWinner === 1 || match.gameWinner === 2;

  const scoreBug = (
    <div
      className="pointer-events-auto font-sans"
      role="status"
      aria-live="polite"
      aria-label={`Score ${teamA} ${score1} to ${teamB} ${score2}`}
    >
      {/* Mobile: ultra-compact scores only */}
      <div className="flex sm:hidden items-center gap-0.5 w-max rounded bg-black/70 border border-white/10 px-1 py-0.5 shadow-md">
        {activeServer === 1 && (
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        )}
        <span className="text-[11px] font-black font-mono text-white tabular-nums leading-none px-0.5 rounded-[3px] bg-indigo-600 min-w-[1.1rem] text-center">
          {score1}
        </span>
        <span className="text-[8px] text-white/35 font-bold leading-none">:</span>
        <span className="text-[11px] font-black font-mono text-white tabular-nums leading-none px-0.5 rounded-[3px] bg-rose-600 min-w-[1.1rem] text-center">
          {score2}
        </span>
        {activeServer === 2 && (
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        )}
        <span className="text-[7px] font-mono font-bold text-amber-300/80 leading-none pl-0.5">
          {servingSide.slice(0, 1)}
        </span>
      </div>

      {/* Laptop / tablet: fuller score card */}
      <div className="hidden sm:block w-[min(28vw,17.5rem)] max-w-[17.5rem]">
        <div className="bg-slate-950/92 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-900/60">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider truncate">
                {match.category || 'Match'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{match.stage || ''}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {match.deuceActive && (
                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse border border-red-500/30">
                  Deuce
                </span>
              )}
              <span className="text-[9px] bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono uppercase border border-slate-700">
                {servingSide}
              </span>
              <span className="text-[9px] text-amber-300/90 font-mono font-bold">{maxPoints}P</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            <div className={`min-w-0 px-2.5 py-2 text-left ${activeServer === 1 ? 'bg-indigo-950/50' : ''}`}>
              <div className="flex items-center gap-1 min-w-0">
                {activeServer === 1 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                )}
                <span className="text-xs font-bold text-slate-100 truncate uppercase tracking-wide">
                  {teamA}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{player1}</p>
              <p className="mt-1 text-3xl font-black font-mono text-indigo-300 leading-none tabular-nums">
                {score1}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center px-1.5 py-2 border-x border-slate-800">
              <span className="text-[9px] font-bold text-slate-500 uppercase">vs</span>
            </div>

            <div className={`min-w-0 px-2.5 py-2 text-right ${activeServer === 2 ? 'bg-rose-950/50' : ''}`}>
              <div className="flex items-center justify-end gap-1 min-w-0">
                <span className="text-xs font-bold text-slate-100 truncate uppercase tracking-wide">
                  {teamB}
                </span>
                {activeServer === 2 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{player2}</p>
              <p className="mt-1 text-3xl font-black font-mono text-rose-300 leading-none tabular-nums">
                {score2}
              </p>
            </div>
          </div>

          {hasWinner && (
            <div className="px-2.5 py-1.5 border-t border-emerald-500/40 bg-emerald-500/15 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide truncate">
                Winner: {match.gameWinner === 1 ? teamA : teamB}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const overlayAnchorClass =
    'fixed z-20 pointer-events-none top-[max(0.35rem,env(safe-area-inset-top))] right-[max(0.35rem,env(safe-area-inset-right))] sm:top-[max(0.75rem,env(safe-area-inset-top))] sm:right-[max(0.75rem,env(safe-area-inset-right))]';

  if (embedUrl) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        <iframe
          title="YouTube Live"
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className={overlayAnchorClass}>{scoreBug}</div>
      </div>
    );
  }

  return <div className={overlayAnchorClass}>{scoreBug}</div>;
};

export default StreamOverlay;
