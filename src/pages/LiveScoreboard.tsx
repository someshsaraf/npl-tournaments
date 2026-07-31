import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { MatchState, INITIAL_MATCH } from '../tournamentData';
import { Link } from 'react-router-dom';
import { BookOpen, Shield } from 'lucide-react';

export default function LiveScoreboard() {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'active_match');
    return onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(data);
    });
  }, []);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-lg font-bold text-amber-400">NPL 2026 Badminton</h1>
          <p className="text-xs text-slate-400">{match.category} • {match.stage}</p>
        </div>
        <Link to="/rules" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Rules
        </Link>
      </div>

      {/* Main Scorecard */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6">
        {match.isTrump && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs text-center py-1.5 rounded-lg font-semibold flex justify-center items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> TRUMP GAME (+2 / -1 Points)
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-2">
            <p className="font-semibold text-slate-300 truncate">{match.player1}</p>
            <div className={`py-6 rounded-2xl font-black text-6xl ${match.serving === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-indigo-400'}`}>
              {match.score1}
            </div>
            {match.serving === 1 && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Serving</span>}
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-300 truncate">{match.player2}</p>
            <div className={`py-6 rounded-2xl font-black text-6xl ${match.serving === 2 ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-800 text-rose-400'}`}>
              {match.score2}
            </div>
            {match.serving === 2 && <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Serving</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
