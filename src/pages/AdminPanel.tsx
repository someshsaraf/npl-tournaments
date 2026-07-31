import React, { useState, useEffect } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, FIXTURES, FIXTURE_DATES, INITIAL_MATCH } from '../data/tournamentData';
import type { MatchState, Fixture, Team, CompletedMatch } from '../data/tournamentData';
import { isValidYouTubeLiveUrl, parseYouTubeVideoId } from '../utils/youtube';
import {
  buildCompletedMatch,
  completedMatchesFromFirebase,
  mergeFixturesWithResults,
  sortCompletedMatches
} from '../utils/completedMatches';
import { exportScores } from '../utils/exportScores';
import type { ScoreExportFormat } from '../utils/exportScores';
import { hasMatchWinner, normalizeMatchState } from '../utils/matchState';

export const AdminPanel: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [teams, setTeams] = useState<Team[]>(TEAMS);
  const [completedById, setCompletedById] = useState<Record<string, CompletedMatch>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(FIXTURE_DATES[0] ?? 'All');
  const [selectedMaxPoints, setSelectedMaxPoints] = useState<11 | 21>(11);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Sync state from Firebase with normalization
  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribeMatch = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });

    const teamsRef = ref(db, 'teams');
    const unsubscribeTeams = onValue(teamsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTeams(data);
      } else {
        set(ref(db, 'teams'), TEAMS).catch((err) => console.error("Firebase write error:", err));
      }
    });

    const completedRef = ref(db, 'completedMatches');
    const unsubscribeCompleted = onValue(completedRef, (snapshot) => {
      setCompletedById(completedMatchesFromFirebase(snapshot.val()));
    });

    return () => {
      unsubscribeMatch();
      unsubscribeTeams();
      unsubscribeCompleted();
    };
  }, []);

  const updateMatchState = (newMatchState: MatchState) => {
    setMatch(newMatchState);
    set(ref(db, 'currentMatch'), newMatchState).catch((err) => {
      console.error("Failed to sync match state to Firebase:", err);
    });
  };

  const updateTeamsState = (newTeams: Team[]) => {
    setTeams(newTeams);
    set(ref(db, 'teams'), newTeams).catch((err) => {
      console.error("Failed to sync teams to Firebase:", err);
    });
  };

  // Helper: court side from server's score when service changes hands
  // Even Score = RIGHT court | Odd Score = LEFT court
  const getServeSide = (score: number): 'right' | 'left' => {
    if (!Number.isFinite(score) || score < 0) return 'right';
    return score % 2 === 0 ? 'right' : 'left';
  };

  // Manual Server Override (e.g. at start of match or correction)
  const handleSetServer = (targetServer: 1 | 2) => {
    if (targetServer !== 1 && targetServer !== 2) return;
    const activeScore = targetServer === 1 ? (match.score1 ?? 0) : (match.score2 ?? 0);
    updateMatchState({
      ...match,
      server: targetServer,
      servingSide: getServeSide(activeScore)
    });
  };

  // Rally scoring: point winner serves next. Court side (L/R) only changes on service over.
  const handleScorePoint = (scoringTeam: 1 | 2) => {
    if (scoringTeam !== 1 && scoringTeam !== 2) return;
    if (match.gameWinner === 1 || match.gameWinner === 2) return;

    const max = match.maxPoints ?? 11;
    const cap = max === 11 ? 15 : 30;
    const deuceThreshold = max - 1;

    let s1 = match.score1 ?? 0;
    let s2 = match.score2 ?? 0;

    if (scoringTeam === 1) {
      s1 += 1;
    } else {
      s2 += 1;
    }

    const previousServer = match.server === 2 ? 2 : 1;
    const newServer: 1 | 2 = scoringTeam;
    const serviceOver = newServer !== previousServer;

    // Same server keeps the point: keep current L/R court (do not toggle).
    // Service over: new server's court from their score (even = right, odd = left).
    const newServingSide = serviceOver
      ? getServeSide(newServer === 1 ? s1 : s2)
      : (match.servingSide === 'left' ? 'left' : 'right');

    // Deuce & Game Winner Logic
    let isDeuce = match.deuceActive;
    let winner: 1 | 2 | null = null;
    const winningScore = scoringTeam === 1 ? s1 : s2;

    if (s1 >= deuceThreshold && s2 >= deuceThreshold) {
      if (s1 === s2) {
        isDeuce = true;
      } else if (Math.abs(s1 - s2) >= 2 || winningScore === cap) {
        winner = scoringTeam;
      } else {
        isDeuce = true;
      }
    } else if (winningScore >= max) {
      winner = scoringTeam;
    }

    updateMatchState({
      ...match,
      score1: s1,
      score2: s2,
      server: newServer,
      servingSide: newServingSide,
      deuceActive: isDeuce,
      gameWinner: winner
    });
  };

  // Decrement score handler (-1) — does not flip L/R court; use Set Serve to correct side.
  const handleDecrementScore = (side: 1 | 2) => {
    if (side !== 1 && side !== 2) return;

    let s1 = match.score1 ?? 0;
    let s2 = match.score2 ?? 0;

    if (side === 1) s1 = Math.max(0, s1 - 1);
    else s2 = Math.max(0, s2 - 1);

    const maxPoints = match.maxPoints ?? 11;

    updateMatchState({
      ...match,
      score1: s1,
      score2: s2,
      gameWinner: null,
      deuceActive: s1 >= (maxPoints - 1) && s2 >= (maxPoints - 1) && s1 === s2
    });
  };

  // Swap Court / Player Sides — also flips LEFT ↔ RIGHT serve court
  const handleSwapSides = () => {
    const swappedServer: 1 | 2 = match.server === 1 ? 2 : 1;
    const currentSide = match.servingSide === 'left' ? 'left' : 'right';

    updateMatchState({
      ...match,
      teamA: match.teamB,
      teamB: match.teamA,
      player1: match.player2,
      player2: match.player1,
      score1: match.score2,
      score2: match.score1,
      server: swappedServer,
      servingSide: currentSide === 'left' ? 'right' : 'left',
      gameWinner: match.gameWinner === 1 ? 2 : match.gameWinner === 2 ? 1 : null
    });
  };

  const handleResetMatch = () => {
    updateMatchState({
      ...match,
      score1: 0,
      score2: 0,
      server: 1,
      servingSide: 'right',
      deuceActive: false,
      gameWinner: null
    });
  };

  /**
   * Persist finished match to Firebase table and mark fixture completed
   * with result + actual completion date/time.
   */
  const handleCompleteMatch = async () => {
    if (match.gameWinner !== 1 && match.gameWinner !== 2) {
      setSaveError('No winner to save — finish the game first.');
      return;
    }
    const fixtureId = match.currentMatchId?.trim();
    if (!fixtureId) {
      setSaveError('Missing fixture id on current match.');
      return;
    }

    setIsSavingResult(true);
    setSaveError(null);
    try {
      const fixture = FIXTURES.find((f) => f.id === fixtureId);
      const completed = buildCompletedMatch(match, fixture, new Date());
      await set(ref(db, `completedMatches/${fixtureId}`), completed);
    } catch (err) {
      console.error('Failed to save completed match:', err);
      setSaveError('Failed to save result. Check connection and try again.');
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleExportScores = (format: ScoreExportFormat) => {
    setExportError(null);
    const rows = sortCompletedMatches(Object.values(completedById));
    if (rows.length === 0) {
      setExportError('No completed matches to export yet.');
      return;
    }
    try {
      exportScores(rows, format);
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  // Team roster editing handlers
  const handleTeamNameChange = (teamId: string, newName: string) => {
    const updated = teams.map((t) => (t.id === teamId ? { ...t, name: newName } : t));
    updateTeamsState(updated);
  };

  const handlePlayerNameChange = (teamId: string, playerIndex: number, newName: string) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        const updatedPlayers = [...t.players];
        updatedPlayers[playerIndex] = newName;
        return { ...t, players: updatedPlayers };
      }
      return t;
    });
    updateTeamsState(updated);
  };

  const handleAddPlayer = (teamId: string) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        return { ...t, players: [...t.players, 'New Player'] };
      }
      return t;
    });
    updateTeamsState(updated);
  };

  const handleRemovePlayer = (teamId: string, playerIndex: number) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        const updatedPlayers = t.players.filter((_, idx) => idx !== playerIndex);
        return { ...t, players: updatedPlayers };
      }
      return t;
    });
    updateTeamsState(updated);
  };

  const handleYoutubeLiveUrlChange = (raw: string) => {
    if (typeof raw !== 'string') return;
    updateMatchState({ ...match, youtubeLiveUrl: raw });
  };

  const handleClearYoutubeLiveUrl = () => {
    updateMatchState({ ...match, youtubeLiveUrl: '' });
  };

  const handleStartFixture = (fixture: Fixture, pointsLimit: 11 | 21) => {
    if (!fixture || (pointsLimit !== 11 && pointsLimit !== 21)) return;

    const sides = fixture.details.split(/\s+vs\s+/i);
    const stripMatch = (value: string) =>
      value.replace(/\s*\(Match\s+\d+\)\s*$/i, '').trim();

    const left = stripMatch(fixture.teamA || sides[0] || match.player1);
    const right = stripMatch(fixture.teamB || sides[1] || match.player2);

    const updatedState: MatchState = {
      ...match,
      currentMatchId: fixture.id,
      category: fixture.category,
      stage: fixture.stage,
      teamA: left || match.teamA,
      teamB: right || match.teamB,
      player1: left || match.player1,
      player2: right || match.player2,
      score1: 0,
      score2: 0,
      maxPoints: pointsLimit,
      server: 1,
      servingSide: 'right',
      deuceActive: false,
      gameWinner: null,
      isTrump: false,
      trumpTeam: null
    };
    updateMatchState(updatedState);
  };

  const categories = ['All', ...Array.from(new Set(FIXTURES.map((f) => f.category)))];
  const dates = ['All', ...FIXTURE_DATES];

  const fixturesWithResults = mergeFixturesWithResults(FIXTURES, completedById);

  const filteredFixtures = fixturesWithResults.filter((f) => {
    const dateOk = selectedDate === 'All' || f.date === selectedDate;
    const categoryOk = selectedCategory === 'All' || f.category === selectedCategory;
    return dateOk && categoryOk;
  });

  const fixturesByDate = filteredFixtures.reduce<Record<string, Fixture[]>>((acc, fixture) => {
    if (!acc[fixture.date]) acc[fixture.date] = [];
    acc[fixture.date].push(fixture);
    return acc;
  }, {});

  const completedRows = sortCompletedMatches(Object.values(completedById));
  const currentFixtureCompleted = completedById[match.currentMatchId];

  const hasWinner = hasMatchWinner(match);
  const youtubeUrl = match.youtubeLiveUrl ?? '';
  const youtubeUrlValid = isValidYouTubeLiveUrl(youtubeUrl);
  const youtubeConfigured = !!parseYouTubeVideoId(youtubeUrl);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">
      
      {/* 1. Active Match Controller */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-amber-400">Active Match Control</h2>
          <div className="flex items-center space-x-2">
            {match.deuceActive && (
              <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-bold animate-pulse">
                DEUCE (Win by 2)
              </span>
            )}
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
              Target: <strong className="text-amber-300">{match.maxPoints ?? 11} Pts</strong>
            </span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
              ID: {match.currentMatchId}
            </span>
          </div>
        </div>

        {/* Game Winner Alert Banner */}
        {hasWinner && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <span className="text-emerald-400 font-bold text-base block">
                🎉 Game Won by {match.gameWinner === 1 ? match.player1 || match.teamA : match.player2 || match.teamB}! ({match.score1} - {match.score2})
              </span>
              {currentFixtureCompleted ? (
                <span className="text-[11px] text-emerald-300/90">
                  Saved: {currentFixtureCompleted.result} on {currentFixtureCompleted.completedDate} {currentFixtureCompleted.completedTime}
                </span>
              ) : (
                <span className="text-[11px] text-amber-300/90">
                  Save result to mark this fixture completed in the schedule.
                </span>
              )}
              {saveError && <span className="text-[11px] text-red-400 block">{saveError}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCompleteMatch}
                disabled={isSavingResult}
                className="bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                {isSavingResult
                  ? 'Saving…'
                  : currentFixtureCompleted
                    ? 'Update Saved Result'
                    : 'Complete Match & Save'}
              </button>
              <button
                onClick={handleResetMatch}
                className="bg-slate-800 text-slate-200 font-bold text-xs px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
              >
                Reset / Next Game
              </button>
            </div>
          </div>
        )}

        {/* Options, Swap Sides, and Court Indicator Toolbar */}
        <div className="mb-6 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-300">Format:</span>
            <button
              onClick={() => updateMatchState({ ...match, maxPoints: 11, gameWinner: null })}
              className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${
                (match.maxPoints ?? 11) === 11
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              11 Points
            </button>
            <button
              onClick={() => updateMatchState({ ...match, maxPoints: 21, gameWinner: null })}
              className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${
                match.maxPoints === 21
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              21 Points
            </button>
          </div>

          {/* Swap Court / Player Sides Button */}
          <button
            onClick={handleSwapSides}
            className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all flex items-center space-x-1.5"
          >
            <span>↔ Swap Court Sides</span>
          </button>

          {/* Active Serving Side Indicator */}
          <span className="text-xs text-indigo-300 font-mono">
            Active Serve: <strong className="text-amber-300 uppercase">{match.server === 1 ? match.teamA : match.teamB}</strong> ({match.servingSide?.toUpperCase()} Court)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Side A Control */}
          <div className={`p-4 rounded-xl border transition-all ${
            match.server === 1 
              ? 'bg-slate-800/90 border-indigo-500/80 shadow-lg' 
              : 'bg-slate-800/40 border-slate-700/50'
          }`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-indigo-400 font-bold uppercase">{match.teamA}</span>
              <button 
                onClick={() => handleSetServer(1)}
                className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                  match.server === 1 
                    ? 'bg-emerald-500 text-slate-950 shadow-md' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {match.server === 1 ? `Serving (${match.servingSide?.toUpperCase()})` : 'Set Serve'}
              </button>
            </div>
            <input 
              type="text" 
              value={match.player1 || ''} 
              onChange={(e) => updateMatchState({ ...match, player1: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 mb-3" 
              placeholder="Player 1 / Team A Member"
            />
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleDecrementScore(1)}
                className="bg-slate-700 text-white px-4 py-3 rounded-lg font-bold text-lg hover:bg-slate-600 active:scale-95 transition-all"
              >-1</button>
              <div className="flex-1 text-center">
                <span className="text-4xl font-black font-mono text-amber-300 block">{match.score1 ?? 0}</span>
                <span className="text-[10px] text-slate-400">Target: {match.maxPoints ?? 11}</span>
              </div>
              <button 
                onClick={() => handleScorePoint(1)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold text-xl hover:bg-indigo-500 active:scale-95 transition-all shadow-md"
              >+1</button>
            </div>
          </div>

          {/* Side B Control */}
          <div className={`p-4 rounded-xl border transition-all ${
            match.server === 2 
              ? 'bg-slate-800/90 border-indigo-500/80 shadow-lg' 
              : 'bg-slate-800/40 border-slate-700/50'
          }`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-indigo-400 font-bold uppercase">{match.teamB}</span>
              <button 
                onClick={() => handleSetServer(2)}
                className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                  match.server === 2 
                    ? 'bg-emerald-500 text-slate-950 shadow-md' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {match.server === 2 ? `Serving (${match.servingSide?.toUpperCase()})` : 'Set Serve'}
              </button>
            </div>
            <input 
              type="text" 
              value={match.player2 || ''} 
              onChange={(e) => updateMatchState({ ...match, player2: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 mb-3" 
              placeholder="Player 2 / Team B Member"
            />
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleDecrementScore(2)}
                className="bg-slate-700 text-white px-4 py-3 rounded-lg font-bold text-lg hover:bg-slate-600 active:scale-95 transition-all"
              >-1</button>
              <div className="flex-1 text-center">
                <span className="text-4xl font-black font-mono text-amber-300 block">{match.score2 ?? 0}</span>
                <span className="text-[10px] text-slate-400">Target: {match.maxPoints ?? 11}</span>
              </div>
              <button 
                onClick={() => handleScorePoint(2)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold text-xl hover:bg-indigo-500 active:scale-95 transition-all shadow-md"
              >+1</button>
            </div>
          </div>
        </div>

        {/* Trump Match Toggle & Reset */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox"
              checked={!!match.isTrump}
              onChange={(e) => updateMatchState({ ...match, isTrump: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <span className="text-sm font-semibold text-slate-200">Trump Match Active</span>
          </label>
          <button
            onClick={handleResetMatch}
            className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            Reset Scores
          </button>
        </div>

        {/* YouTube Live Link for Overlay */}
        <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label htmlFor="youtube-live-url" className="text-sm font-semibold text-slate-200">
              YouTube Live Link
            </label>
            <span className="text-[11px] text-slate-500">
              Used by <code className="text-indigo-300">/overlay</code>
              {youtubeConfigured ? (
                <span className="ml-2 text-emerald-400 font-semibold">● Live linked</span>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="youtube-live-url"
              type="url"
              value={youtubeUrl}
              onChange={(e) => handleYoutubeLiveUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… or /live/…"
              className={`flex-1 bg-slate-900 border rounded-lg p-2.5 text-sm text-white focus:outline-none ${
                youtubeUrl.trim() && !youtubeUrlValid
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-700 focus:border-indigo-500'
              }`}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={handleClearYoutubeLiveUrl}
              disabled={!youtubeUrl}
              className="text-xs text-slate-300 hover:text-white bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
          {youtubeUrl.trim() && !youtubeUrlValid && (
            <p className="text-[11px] text-red-400">
              Enter a valid YouTube watch, live, or share URL.
            </p>
          )}
        </div>
      </div>

      {/* 2. Editable Teams & Rosters Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-indigo-300">Editable Teams & Rosters</h3>
          <span className="text-xs text-slate-400">Click any name to edit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl space-y-3">
              <input
                type="text"
                value={team.name}
                onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 text-amber-400 font-bold text-sm px-2 py-1 rounded focus:outline-none focus:border-amber-400"
                placeholder="Team Name"
              />

              <div className="space-y-1.5">
                {team.players.map((player, idx) => (
                  <div key={idx} className="flex items-center space-x-1 group">
                    <input
                      type="text"
                      value={player}
                      onChange={(e) => handlePlayerNameChange(team.id, idx, e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-800 text-xs text-slate-200 px-2 py-1 rounded focus:outline-none focus:border-indigo-500"
                      placeholder={`Player ${idx + 1}`}
                    />
                    <button
                      onClick={() => handleRemovePlayer(team.id, idx)}
                      className="text-red-400 hover:text-red-300 px-1 text-xs font-bold opacity-70 group-hover:opacity-100 transition-opacity"
                      title="Remove Player"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleAddPlayer(team.id)}
                className="w-full text-center text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 rounded py-1 font-semibold transition-colors"
              >
                + Add Player
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tournament Fixtures & Master Schedule Browser */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold text-indigo-300">Tournament Fixtures</h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredFixtures.length} / {FIXTURES.length} matches
                {completedRows.length > 0 ? ` · ${completedRows.length} completed` : ''}
              </span>
              <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setSelectedMaxPoints(11)}
                  className={`text-[10px] px-2 py-1 rounded font-bold ${
                    selectedMaxPoints === 11 ? 'bg-amber-400 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  11 Pts
                </button>
                <button
                  onClick={() => setSelectedMaxPoints(21)}
                  className={`text-[10px] px-2 py-1 rounded font-bold ${
                    selectedMaxPoints === 21 ? 'bg-amber-400 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  21 Pts
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</p>
            <div className="flex items-center space-x-2 overflow-x-auto max-w-full pb-1">
              {dates.map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedDate === date
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</p>
            <div className="flex items-center space-x-2 overflow-x-auto max-w-full pb-1">
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
        </div>

        <div className="space-y-6 max-h-[640px] overflow-y-auto pr-1">
          {Object.keys(fixturesByDate).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No fixtures for this filter.</p>
          )}
          {Object.entries(fixturesByDate).map(([date, dayFixtures]) => (
            <div key={date} className="space-y-3">
              <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 py-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-400">{date}</h4>
                <span className="text-[11px] text-slate-500">{dayFixtures.length} matches</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dayFixtures.map((fixture) => {
                  const isLive = match.currentMatchId === fixture.id;
                  const isCompleted = fixture.status === 'completed';
                  return (
                    <div
                      key={fixture.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isLive
                          ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                          : isCompleted
                            ? 'bg-emerald-950/30 border-emerald-700/50'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1.5 gap-2">
                          <span className="font-mono">{fixture.time}</span>
                          <span className="font-semibold text-indigo-400 text-right">{fixture.category}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-100">{fixture.details}</p>
                        {isCompleted && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                              Match completed · {fixture.result}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Winner: {fixture.winnerName}
                              {fixture.completedDate
                                ? ` · ${fixture.completedDate} ${fixture.completedTime ?? ''}`
                                : ''}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3.5 flex justify-between items-center pt-2 border-t border-slate-800/80 gap-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {isCompleted ? 'Completed' : fixture.stage}
                        </span>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleStartFixture(fixture, 11)}
                            className={`text-[11px] px-2 py-1 rounded font-bold transition-all ${
                              isLive && match.maxPoints === 11
                                ? 'bg-emerald-500 text-slate-950 shadow'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                            title="Start as 11 Point Match"
                          >
                            {isLive && match.maxPoints === 11 ? 'Live (11p)' : isCompleted ? 'Replay 11p' : 'Start 11p'}
                          </button>
                          <button
                            onClick={() => handleStartFixture(fixture, 21)}
                            className={`text-[11px] px-2 py-1 rounded font-bold transition-all ${
                              isLive && match.maxPoints === 21
                                ? 'bg-emerald-500 text-slate-950 shadow'
                                : 'bg-indigo-700 text-white hover:bg-indigo-600'
                            }`}
                            title="Start as 21 Point Match"
                          >
                            {isLive && match.maxPoints === 21 ? 'Live (21p)' : isCompleted ? 'Replay 21p' : 'Start 21p'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Completed Matches Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-indigo-300">Completed Matches</h3>
            <span className="text-xs text-slate-400 font-mono">{completedRows.length} recorded</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { format: 'csv' as const, label: 'CSV' },
              { format: 'excel' as const, label: 'Excel' },
              { format: 'json' as const, label: 'JSON' },
              { format: 'pdf' as const, label: 'PDF' }
            ]).map(({ format, label }) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExportScores(format)}
                disabled={completedRows.length === 0}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={`Export completed scores as ${label}`}
              >
                Export {label}
              </button>
            ))}
          </div>
        </div>
        {exportError && (
          <p className="text-[11px] text-red-400">{exportError}</p>
        )}

        {completedRows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No finished matches yet. When a game ends, click <strong className="text-emerald-400">Complete Match &amp; Save</strong>.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Completed</th>
                  <th className="px-3 py-2.5 font-semibold">Scheduled</th>
                  <th className="px-3 py-2.5 font-semibold">Category</th>
                  <th className="px-3 py-2.5 font-semibold">Match</th>
                  <th className="px-3 py-2.5 font-semibold">Result</th>
                  <th className="px-3 py-2.5 font-semibold">Winner</th>
                </tr>
              </thead>
              <tbody>
                {completedRows.map((row) => (
                  <tr key={row.fixtureId} className="border-t border-slate-800/80 hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 text-slate-200 whitespace-nowrap font-mono text-xs">
                      {row.completedDate} {row.completedTime}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {row.scheduledDate} {row.scheduledTime}
                    </td>
                    <td className="px-3 py-2.5 text-indigo-300 text-xs">{row.category}</td>
                    <td className="px-3 py-2.5 text-slate-100 text-xs max-w-[220px]">
                      <span className="line-clamp-2">{row.details}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-300 whitespace-nowrap">
                      {row.result}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-400 text-xs font-semibold">
                      {row.winnerName}
                      {row.isTrump ? <span className="ml-1 text-amber-400">★</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminPanel;
