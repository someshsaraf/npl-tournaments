import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import { toYouTubeEmbedUrl } from '../utils/youtube';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';

/** First name / short label for tight overlay space. */
function shortName(name: string, maxChars: number): string {
  if (typeof name !== 'string' || !name.trim()) return '—';
  const first = name.trim().split(/\s+/)[0] ?? name.trim();
  if (first.length <= maxChars) return first;
  return `${first.slice(0, Math.max(1, maxChars - 1))}…`;
}

export const StreamOverlay: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
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
  const hasWinner = hasMatchWinner(match);

  // Full card only on real laptop/desktop (wide + tall). Phone landscape is wide but short — keep compact bar.
  const compactOnly =
    'flex [@media(min-width:1024px)_and_(min-height:600px)]:hidden';
  const fullOnly =
    'hidden [@media(min-width:1024px)_and_(min-height:600px)]:block';

  const scoreBug = (
    <div
      className="pointer-events-auto font-sans"
      role="status"
      aria-live="polite"
      aria-label={`Score ${player1} ${score1} to ${player2} ${score2}`}
    >
      {/* Phone portrait + landscape: compact bar with player names */}
      <div
        className={`${compactOnly} items-center gap-1 w-max max-w-[min(72vw,14rem)] landscape:max-w-[min(42vw,12rem)] rounded-md bg-black/75 border border-white/15 px-1.5 py-1 shadow-md`}
      >
        <div className="flex items-center gap-0.5 min-w-0">
          {activeServer === 1 && (
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          )}
          <span className="text-[9px] landscape:text-[8px] font-semibold text-white/90 truncate max-w-[3.75rem] landscape:max-w-[2.75rem]">
            {shortName(player1, 8)}
          </span>
          <span className="text-[11px] landscape:text-[10px] font-black font-mono text-white tabular-nums leading-none px-1 py-0.5 rounded bg-indigo-600 min-w-[1.15rem] text-center">
            {score1}
          </span>
        </div>

        <span className="text-[8px] text-white/35 font-bold leading-none">:</span>

        <div className="flex items-center gap-0.5 min-w-0">
          <span className="text-[11px] landscape:text-[10px] font-black font-mono text-white tabular-nums leading-none px-1 py-0.5 rounded bg-rose-600 min-w-[1.15rem] text-center">
            {score2}
          </span>
          <span className="text-[9px] landscape:text-[8px] font-semibold text-white/90 truncate max-w-[3.75rem] landscape:max-w-[2.75rem]">
            {shortName(player2, 8)}
          </span>
          {activeServer === 2 && (
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          )}
        </div>

        <span className="text-[7px] font-mono font-bold text-amber-300/85 leading-none pl-0.5 border-l border-white/15">
          {servingSide.slice(0, 1)}
        </span>
      </div>

      {/* Laptop / desktop: fuller score card */}
      <div className={`${fullOnly} w-[min(28vw,17.5rem)] max-w-[17.5rem]`}>
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
    'fixed z-20 pointer-events-none top-[max(0.35rem,env(safe-area-inset-top))] right-[max(0.35rem,env(safe-area-inset-right))]';

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
