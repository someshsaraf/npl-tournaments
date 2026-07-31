import React, { useState, useEffect } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, FIXTURES, INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState, Fixture } from '../data/tournamentData';

export const AdminPanel: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Sync current match state from Firebase on mount
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

  const updateFirebase = (newMatchState: MatchState) => {
    setMatch(newMatchState);
    set(ref(db, 'currentMatch'), newMatchState);
  };

  // Load selected fixture directly into the live match state
  const handleStartFixture = (fixture: Fixture) => {
    const players = fixture.details.split(' vs ');
    const updatedState: MatchState = {
      ...match,
      currentMatchId: fixture.id,
      category: fixture.category,
      stage: fixture.stage,
      teamA: fixture.teamA || match.teamA,
      teamB: fixture.teamB || match.teamB,
      player1: players[0] || match.player1,
      player2: players[1] || match.player2,
      score1: 0,
      score2: 0,
      server: 1,
      serving: 1,
      isTrump: false,
      trumpTeam: null
    };
    updateFirebase(updatedState);
  };

  const categories = ['All', ...Array.from(new Set(FIXTURES.map((f) => f.category)))];

  const filteredFixtures = selectedCategory === 'All'
    ? FIXTURES
    : FIXTURES.filter((f) => f.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">
      
      {/* 1. Active Match Controller */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <h2 className="text-xl font-bold text-amber-400">Active Match Control</h2>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
              {match.category} • {match.stage}
            </span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
              ID: {match.currentMatchId}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Side A Control */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-indigo-400 font-bold uppercase">{match.teamA}</span>
              <button 
                onClick={() => updateFirebase({ ...match, server: 1, serving: 1 })}
                className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                  (match.serving ?? match.server) === 1 
                    ? 'bg-emerald-500 text-slate-950 shadow-md' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {(match.serving ?? match.server) === 1 ? 'Serving' : 'Set Serve'}
              </button>
            </div>
            <input 
              type="text" 
              value={match.player1} 
              onChange={(e) => updateFirebase({ ...match, player1: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" 
              placeholder="Player 1 / Team A Member"
            />
            <div className="flex items-center space-x-3 pt-2">
              <button 
                onClick={() => updateFirebase({ ...match, score1: Math.max(0, match.score1 - 1) })}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-lg hover:bg-slate-600 active:scale-95 transition-all"
              >-1</button>
              <span className="text-4xl font-black font-mono text-amber-300 flex-1 text-center">{match.score1}</span>
              <button 
                onClick={() => updateFirebase({ ...match, score1: match.score1 + 1 })}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-lg hover:bg-indigo-500 active:scale-95 transition-all"
              >+1</button>
            </div>
          </div>

          {/* Side B Control */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-indigo-400 font-bold uppercase">{match.teamB}</span>
              <button 
                onClick={() => updateFirebase({ ...match, server: 2, serving: 2 })}
                className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                  (match.serving ?? match.server) === 2 
                    ? 'bg-emerald-500 text-slate-950 shadow-md' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {(match.serving ?? match.server) === 2 ? 'Serving' : 'Set Serve'}
              </button>
            </div>
            <input 
              type="text" 
              value={match.player2} 
              onChange={(e) => updateFirebase({ ...match, player2: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" 
              placeholder="Player 2 / Team B Member"
            />
            <div className="flex items-center space-x-3 pt-2">
              <button 
                onClick={() => updateFirebase({ ...match, score2: Math.max(0, match.score2 - 1) })}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-lg hover:bg-slate-600 active:scale-95 transition-all"
              >-1</button>
              <span className="text-4xl font-black font-mono text-amber-300 flex-1 text-center">{match.score2}</span>
              <button 
                onClick={() => updateFirebase({ ...match, score2: match.score2 + 1 })}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-lg hover:bg-indigo-500 active:scale-95 transition-all"
              >+1</button>
            </div>
          </div>
        </div>

        {/* Trump Match Toggle */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox"
              checked={match.isTrump}
              onChange={(e) => updateFirebase({ ...match, isTrump: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <span className="text-sm font-semibold text-slate-200">Trump Match Active</span>
          </label>
        </div>
      </div>

      {/* 2. Teams & Rosters Drawer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-indigo-300 mb-4">Teams & Roster Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {TEAMS.map((team) => (
            <div key={team.id} className="bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl">
              <h4 className="font-bold text-amber-400 text-sm mb-2 pb-1 border-b border-slate-700">{team.name}</h4>
              <ul className="text-xs text-slate-300 space-y-1">
                {team.players.map((player, idx) => (
                  <li key={idx} className="truncate">• {player}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tournament Fixtures & Master Schedule Browser */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-indigo-300">Tournament Fixtures</h3>
          <div className="flex items-center space-x-2 overflow-x-auto max-w-full pb-2 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 text-white font-bold shadow-md' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filteredFixtures.map((fixture) => {
            const isLive = match.currentMatchId === fixture.id;
            return (
              <div 
                key={fixture.id} 
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isLive 
                    ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50' 
                    : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1.5">
                    <span>{fixture.date} • {fixture.time}</span>
                    <span className="font-semibold text-indigo-400">{fixture.category}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-100">{fixture.details}</p>
                </div>

                <div className="mt-3.5 flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{fixture.stage}</span>
                  <button
                    onClick={() => handleStartFixture(fixture)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                      isLive
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500'
                    }`}
                  >
                    {isLive ? 'Live Now' : 'Start Match'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default AdminPanel;
