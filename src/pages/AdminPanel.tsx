import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import { MatchState, INITIAL_MATCH } from '../tournamentData';
import { Plus, Minus, RotateCcw, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminPanel() {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);

  useEffect(() => {
    const matchRef = ref(db, 'active_match');
    return onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(data);
    });
  }, []);

  const updateMatch = (updated: MatchState) => {
    setMatch(updated);
    set(ref(db, 'active_match'), updated);
  };

  const addScore = (player: 1 | 2, delta: number) => {
    const newScore1 = player === 1 ? Math.max(0, match.score1 + delta) : match.score1;
    const newScore2 = player === 2 ? Math.max(0, match.score2 + delta) : match.score2;
    updateMatch({ ...match, score1: newScore1, score2: newScore2, serving: player });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <h1 className="text-xl font-bold text-emerald-400">Match Admin Console</h1>
        <div className="flex gap-2">
          <Link to="/live" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold flex items-center gap-1">
            <LinkIcon className="w-3.5 h-3.5" /> Spectator View
          </Link>
          <Link to="/overlay" target="_blank" className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded text-xs font-semibold">
            OBS Overlay
          </Link>
        </div>
      </div>

      {/* Match Config */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400">Player / Pair 1</label>
            <input
              type="text"
              value={match.player1}
              onChange={(e) => updateMatch({ ...match, player1: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Player / Pair 2</label>
            <input
              type="text"
              value={match.player2}
              onChange={(e) => updateMatch({ ...match, player2: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={match.isTrump}
              onChange={(e) => updateMatch({ ...match, isTrump: e.target.checked })}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-amber-400 font-medium">Trump Game</span>
          </label>
        </div>
      </div>

      {/* Live Scorer Controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* Player 1 Card */}
        <div className={`p-6 rounded-2xl border text-center transition-all ${match.serving === 1 ? 'bg-indigo-950/80 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}>
          <p className="font-bold text-lg text-slate-200 mb-2 truncate">{match.player1}</p>
          <div className="text-6xl font-black text-indigo-400 my-4">{match.score1}</div>
          <div className="flex justify-center gap-2">
            <button onClick={() => addScore(1, -1)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl">
              <Minus className="w-6 h-6" />
            </button>
            <button onClick={() => addScore(1, 1)} className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold flex-1 flex justify-center items-center">
              <Plus className="w-8 h-8" />
            </button>
          </div>
        </div>

        {/* Player 2 Card */}
        <div className={`p-6 rounded-2xl border text-center transition-all ${match.serving === 2 ? 'bg-rose-950/80 border-rose-500' : 'bg-slate-800 border-slate-700'}`}>
          <p className="font-bold text-lg text-slate-200 mb-2 truncate">{match.player2}</p>
          <div className="text-6xl font-black text-rose-400 my-4">{match.score2}</div>
          <div className="flex justify-center gap-2">
            <button onClick={() => addScore(2, -1)} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl">
              <Minus className="w-6 h-6" />
            </button>
            <button onClick={() => addScore(2, 1)} className="p-4 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold flex-1 flex justify-center items-center">
              <Plus className="w-8 h-8" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => updateMatch({ ...match, score1: 0, score2: 0 })}
        className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-400 font-medium flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-4 h-4" /> Reset Scores
      </button>
    </div>
  );
}
