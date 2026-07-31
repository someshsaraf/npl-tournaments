import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { MatchState, INITIAL_MATCH } from '../data/tournamentData';

export const StreamOverlay: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMatch(data);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed top-0 left-0 w-screen h-screen pointer-events-none bg-transparent font-sans overflow-hidden">
      {/* Positioned Top-Right for optimal camera framing */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 w-[88vw] max-w-[340px] sm:max-w-[400px]">
        <div className="bg-slate-900/90 text-white rounded-xl shadow-2xl border border-slate-700/60 backdrop-blur-md overflow-hidden">
          
          {/* Category & Header Badge */}
          <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-3 py-1.5 flex justify-between items-center text-[10px] sm:text-xs font-semibold tracking-wide uppercase">
            <span className="truncate">{match.category} • {match.stage}</span>
            {match.isTrump && (
              <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black text-[9px]">
                TRUMP MATCH
              </span>
            )}
          </div>

          {/* Scores & Team Info */}
          <div className="p-2 sm:p-3 space-y-1.5">
            {/* Team / Player 1 */}
            <div className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg transition-colors ${
              match.server === 1 ? 'bg-indigo-950/80 border-l-4 border-indigo-500' : 'bg-slate-800/50'
            }`}>
              <div className="flex flex-col truncate pr-2">
                <span className="text-[10px] text-indigo-300 uppercase font-bold truncate">{match.teamA}</span>
                <span className="text-xs sm:text-sm font-semibold truncate">{match.player1}</span>
              </div>
              <div className="flex items-center space-x-2">
                {match.server === 1 && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Serving" />
                )}
                <span className="text-xl sm:text-2xl font-black text-amber-300 min-w-[2rem] text-right font-mono">
                  {match.score1}
                </span>
              </div>
            </div>

            {/* Team / Player 2 */}
            <div className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg transition-colors ${
              match.server === 2 ? 'bg-indigo-950/80 border-l-4 border-indigo-500' : 'bg-slate-800/50'
            }`}>
              <div className="flex flex-col truncate pr-2">
                <span className="text-[10px] text-indigo-300 uppercase font-bold truncate">{match.teamB}</span>
                <span className="text-xs sm:text-sm font-semibold truncate">{match.player2}</span>
              </div>
              <div className="flex items-center space-x-2">
                {match.server === 2 && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Serving" />
                )}
                <span className="text-xl sm:text-2xl font-black text-amber-300 min-w-[2rem] text-right font-mono">
                  {match.score2}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
