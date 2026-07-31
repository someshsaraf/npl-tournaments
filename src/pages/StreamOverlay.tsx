import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';

export const StreamOverlay: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(data);
    });

    return () => unsubscribe();
  }, []);

  const activeServer = match.server ?? 1;

  return (
    <div className="fixed bottom-6 left-6 right-6 flex justify-center pointer-events-none font-sans">
      <div className="bg-slate-950/95 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center space-x-6 max-w-4xl w-full justify-between pointer-events-auto">
        
        {/* Match / Category Tag */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">{match.category}</span>
          <span className="text-xs font-semibold text-slate-300">{match.stage}</span>
        </div>

        {/* Team A */}
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="flex items-center space-x-1.5 justify-end">
              {activeServer === 1 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title={`Serving ${match.servingSide}`} />
              )}
              <span className="font-bold text-sm text-slate-100">{match.teamA}</span>
            </div>
            <span className="text-[11px] text-slate-400 block">{match.player1}</span>
          </div>
          <span className="bg-indigo-600 text-white font-black text-2xl px-3.5 py-1.5 rounded-xl font-mono shadow">
            {match.score1}
          </span>
        </div>

        {/* Divider / Target Pts */}
        <div className="flex flex-col items-center px-2 border-x border-slate-800">
          <span className="text-[10px] text-slate-500 font-bold uppercase">VS</span>
          <span className="text-[10px] text-amber-300 font-mono font-bold">{match.maxPoints ?? 11}P</span>
        </div>

        {/* Team B */}
        <div className="flex items-center space-x-3">
          <span className="bg-rose-600 text-white font-black text-2xl px-3.5 py-1.5 rounded-xl font-mono shadow">
            {match.score2}
          </span>
          <div className="text-left">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm text-slate-100">{match.teamB}</span>
              {activeServer === 2 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title={`Serving ${match.servingSide}`} />
              )}
            </div>
            <span className="text-[11px] text-slate-400 block">{match.player2}</span>
          </div>
        </div>

        {/* Court / State Tags */}
        <div className="flex items-center space-x-2">
          {match.deuceActive && (
            <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-md font-bold uppercase animate-pulse border border-red-500/30">
              Deuce
            </span>
          )}
          <span className="bg-slate-800 text-indigo-300 text-[10px] px-2 py-1 rounded-md font-mono uppercase border border-slate-700">
            {match.servingSide ?? 'RIGHT'}
          </span>
        </div>

      </div>
    </div>
  );
};

export default StreamOverlay;
