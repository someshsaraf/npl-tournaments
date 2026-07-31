import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';
import { ServeRacket } from '../components/ServeRacket';
import { BrandBanner } from '../components/BrandBanner';

export const LiveScoreboard: React.FC = () => {
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
  const showWinner = hasMatchWinner(match);
  const winnerLabel =
    match.gameWinner === 1
      ? (match.player1 || match.teamA)
      : (match.player2 || match.teamB);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        
        {/* Brand — center top */}
        <div className="flex justify-center border-b border-slate-800 pb-5">
          <BrandBanner size="md" />
        </div>

        {/* Match meta */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase block">{match.category}</span>
            <h1 className="text-2xl font-black text-amber-400">{match.stage}</h1>
          </div>
          <div className="flex items-center space-x-3">
            {match.deuceActive && (
              <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-bold animate-pulse border border-red-500/30">
                DEUCE (Win by 2)
              </span>
            )}
            <span className="text-xs bg-slate-800 text-slate-300 px-3.5 py-1.5 rounded-full border border-slate-700 font-semibold">
              Target: <strong className="text-amber-300">{match.maxPoints ?? 11} Pts</strong>
            </span>
          </div>
        </div>

        {/* Winner Banner — only when gameWinner is strictly 1 or 2 */}
        {showWinner && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-4 text-center">
            <h2 className="text-2xl font-black text-emerald-400">
              🏆 WINNER: {winnerLabel}
            </h2>
          </div>
        )}

        {/* Live Score Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Team A */}
          <div className={`p-6 rounded-2xl border transition-all text-center space-y-4 ${
            activeServer === 1 
              ? 'bg-slate-800/90 border-indigo-500/80 shadow-indigo-500/10 shadow-xl' 
              : 'bg-slate-800/40 border-slate-700/50'
          }`}>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-300 uppercase tracking-wide">{match.teamA}</h2>
              <p className="text-sm font-medium text-indigo-300">{match.player1 || 'Player 1'}</p>
            </div>

            <div className={`py-6 rounded-2xl font-black text-6xl ${activeServer === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-indigo-400'}`}>
              {match.score1 ?? 0}
            </div>

            {activeServer === 1 && (
              <div className="flex justify-center items-center">
                <ServeRacket active size={32} title="Serving" />
              </div>
            )}
          </div>

          {/* Team B */}
          <div className={`p-6 rounded-2xl border transition-all text-center space-y-4 ${
            activeServer === 2 
              ? 'bg-slate-800/90 border-rose-500/80 shadow-rose-500/10 shadow-xl' 
              : 'bg-slate-800/40 border-slate-700/50'
          }`}>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-300 uppercase tracking-wide">{match.teamB}</h2>
              <p className="text-sm font-medium text-rose-300">{match.player2 || 'Player 2'}</p>
            </div>

            <div className={`py-6 rounded-2xl font-black text-6xl ${activeServer === 2 ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-800 text-rose-400'}`}>
              {match.score2 ?? 0}
            </div>

            {activeServer === 2 && (
              <div className="flex justify-center items-center">
                <ServeRacket active size={32} title="Serving" />
              </div>
            )}
          </div>
        </div>

        {/* Footer / Trump Indicator */}
        {match.isTrump && (
          <div className="text-center pt-2">
            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-widest">
              ★ Trump Match ★
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

export default LiveScoreboard;
