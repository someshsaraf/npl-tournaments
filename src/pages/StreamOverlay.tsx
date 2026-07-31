import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { MatchState, INITIAL_MATCH } from '../tournamentData';

export default function StreamOverlay() {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'active_match');
    return onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(data);
    });
  }, []);

  return (
    <div className="w-screen h-screen bg-transparent p-6 flex items-end justify-center">
      {/* Lower Third OBS Banner */}
      <div className="bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl shadow-2xl overflow-hidden flex items-stretch min-w-[650px]">
        {/* Category Header */}
        <div className="bg-gradient-to-b from-amber-500 to-amber-600 text-slate-950 font-black px-4 py-3 flex flex-col justify-center items-center text-xs tracking-wider uppercase">
          <span>NPL</span>
          <span>2026</span>
          {match.isTrump && <span className="mt-1 bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px]">TRUMP</span>}
        </div>

        {/* Player 1 */}
        <div className={`flex-1 p-3 px-5 flex items-center justify-between border-r border-slate-800 ${match.serving === 1 ? 'bg-indigo-900/40' : ''}`}>
          <span className="font-bold text-xl text-white truncate max-w-[200px]">{match.player1}</span>
          <span className="text-4xl font-black text-indigo-400 ml-4">{match.score1}</span>
        </div>

        {/* VS Separator */}
        <div className="bg-slate-800 text-slate-500 font-bold text-xs flex items-center px-2">VS</div>

        {/* Player 2 */}
        <div className={`flex-1 p-3 px-5 flex items-center justify-between ${match.serving === 2 ? 'bg-rose-900/40' : ''}`}>
          <span className="text-4xl font-black text-rose-400 mr-4">{match.score2}</span>
          <span className="font-bold text-xl text-white truncate max-w-[200px] text-right">{match.player2}</span>
        </div>
      </div>
    </div>
  );
}
