import React, { useState, useEffect } from 'react';
import { ref, set, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import {
  TEAMS,
  FIXTURES,
  FIXTURE_DATES,
  INITIAL_MATCH,
  MAX_POINTS_OPTIONS,
  BEST_OF_OPTIONS,
  isBestOf,
  isMaxPoints
} from '../data/tournamentData';
import type { BestOf, MatchState, Fixture, Team, CompletedMatch, MaxPoints } from '../data/tournamentData';
import { isValidYouTubeLiveUrl, parseYouTubeVideoId } from '../utils/youtube';
import {
  buildCompletedMatch,
  completedMatchesFromFirebase,
  mergeFixturesWithResults,
  sortCompletedMatches
} from '../utils/completedMatches';
import { exportScores } from '../utils/exportScores';
import type { ScoreExportFormat } from '../utils/exportScores';
import {
  formatGameScoresLine,
  formatGamesWonLabel,
  hasGameWinner,
  hasSeriesWinner,
  normalizeMatchState
} from '../utils/matchState';
import {
  applyDecrementScore,
  applyScorePoint,
  applySetServer,
  applyStartNextGame,
  applySwapSides,
  isGoldenPoint
} from '../utils/scoring';
import { ServeRacket } from '../components/ServeRacket';
import { BrandBanner } from '../components/BrandBanner';
import { SeriesScoreStrip } from '../components/SeriesScoreStrip';
import { buildCustomMatchState, sanitizeLabel } from '../utils/customMatch';

const CUSTOM_MATCH_STAGES = [
  'Exhibition',
  'Friendly',
  'Custom',
  'Group Stage',
  'Semi Final',
  'Final'
] as const;

function isCustomMatchId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.trim().startsWith('custom-');
}

export const AdminPanel: React.FC = () => {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [teams, setTeams] = useState<Team[]>(TEAMS);
  const [completedById, setCompletedById] = useState<Record<string, CompletedMatch>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(FIXTURE_DATES[0] ?? 'All');
  const [selectedMaxPoints, setSelectedMaxPoints] = useState<MaxPoints>(11);
  const [selectedBestOf, setSelectedBestOf] = useState<BestOf>(1);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [freshStartMessage, setFreshStartMessage] = useState<string | null>(null);

  const fixtureCategories = Array.from(new Set(FIXTURES.map((f) => f.category)));
  const [customSideA, setCustomSideA] = useState('');
  const [customSideB, setCustomSideB] = useState('');
  const [customCategory, setCustomCategory] = useState(fixtureCategories[0] ?? 'Exhibition');
  const [customCategoryOther, setCustomCategoryOther] = useState('');
  const [customStage, setCustomStage] = useState<string>(CUSTOM_MATCH_STAGES[0]);
  const [customMaxPoints, setCustomMaxPoints] = useState<MaxPoints>(11);
  const [customBestOf, setCustomBestOf] = useState<BestOf>(1);
  const [customMatchError, setCustomMatchError] = useState<string | null>(null);

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

  // Manual server assignment (racket tap)
  const handleSetServer = (targetServer: 1 | 2) => {
    if (targetServer !== 1 && targetServer !== 2) return;
    updateMatchState(applySetServer(match, targetServer));
  };

  // Rally scoring: point winner serves next. Court side (L/R) only changes on service over.
  const handleScorePoint = (scoringTeam: 1 | 2) => {
    if (scoringTeam !== 1 && scoringTeam !== 2) return;
    updateMatchState(applyScorePoint(match, scoringTeam));
  };

  // Decrement score handler (-1) — does not flip L/R court; use Set Serve to correct side.
  const handleDecrementScore = (side: 1 | 2) => {
    if (side !== 1 && side !== 2) return;
    updateMatchState(applyDecrementScore(match, side));
  };

  // Swap Court / Player Sides — flips stored court L ↔ R with the end-change
  const handleSwapSides = () => {
    updateMatchState(applySwapSides(match));
  };

  const handleResetMatch = () => {
    updateMatchState({
      ...match,
      score1: 0,
      score2: 0,
      server: 1,
      servingSide: 'right',
      deuceActive: false,
      gameWinner: null,
      gameNumber: 1,
      gameScores: [],
      gamesWon1: 0,
      gamesWon2: 0,
      matchWinner: null
    });
  };

  const handleStartNextGame = () => {
    try {
      updateMatchState(applyStartNextGame(match));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not start next game.');
    }
  };

  /**
   * Wipe all completed match records and reset live scores to INITIAL_MATCH.
   * Requires an explicit confirmation dialog before running.
   */
  const handleConfirmFreshStart = async () => {
    setIsResettingAll(true);
    setFreshStartMessage(null);
    setSaveError(null);
    setExportError(null);
    try {
      await remove(ref(db, 'completedMatches'));
      await set(ref(db, 'currentMatch'), { ...INITIAL_MATCH });
      setCompletedById({});
      setMatch({ ...INITIAL_MATCH });
      setShowFreshStartConfirm(false);
      setFreshStartMessage('All completed matches cleared. Live scores reset.');
    } catch (err) {
      console.error('Failed to reset tournament data:', err);
      setFreshStartMessage('Failed to reset. Check connection and try again.');
    } finally {
      setIsResettingAll(false);
    }
  };

  /**
   * Persist finished match to Firebase table and mark fixture completed
   * with result + actual completion date/time.
   */
  const handleCompleteMatch = async () => {
    if (!hasSeriesWinner(match)) {
      setSaveError(
        match.bestOf === 3 && hasGameWinner(match)
          ? 'Series not finished — play until one side wins 2 games, then save.'
          : 'No winner to save — finish the match first.'
      );
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

  const handleExportScores = async (format: ScoreExportFormat) => {
    setExportError(null);
    const rows = sortCompletedMatches(Object.values(completedById));
    if (rows.length === 0) {
      setExportError('No completed matches to export yet.');
      return;
    }
    try {
      await exportScores(rows, format);
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

  const handleStartFixture = (fixture: Fixture, pointsLimit: MaxPoints, bestOf: BestOf = selectedBestOf) => {
    if (!fixture || !isMaxPoints(pointsLimit)) return;
    if (!isBestOf(bestOf)) return;

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
      bestOf,
      gameNumber: 1,
      gameScores: [],
      gamesWon1: 0,
      gamesWon2: 0,
      matchWinner: null,
      server: 1,
      servingSide: 'right',
      deuceActive: false,
      gameWinner: null,
      isTrump: false,
      trumpTeam: null
    };
    updateMatchState(updatedState);
  };

  /**
   * Start an ad-hoc match that is not on the fixture schedule.
   * Concurrency: single Firebase write via updateMatchState; no shared mutable globals.
   * Security: labels trimmed/length-capped; ids generated locally (not user-supplied).
   */
  const handleStartCustomMatch = () => {
    setCustomMatchError(null);
    try {
      const category =
        customCategory === '__other__'
          ? sanitizeLabel(customCategoryOther, 'Category')
          : sanitizeLabel(customCategory, 'Category');
      const stage = sanitizeLabel(customStage, 'Stage');
      updateMatchState(
        buildCustomMatchState(match, {
          sideA: customSideA,
          sideB: customSideB,
          maxPoints: customMaxPoints,
          bestOf: customBestOf,
          category,
          stage
        })
      );
      setSelectedMaxPoints(customMaxPoints);
      setSelectedBestOf(customBestOf);
    } catch (err) {
      setCustomMatchError(err instanceof Error ? err.message : 'Could not start custom match.');
    }
  };

  const categories = ['All', ...fixtureCategories];
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
  const isCustomLiveMatch = isCustomMatchId(match.currentMatchId);

  const hasWinner = hasGameWinner(match);
  const seriesOver = hasSeriesWinner(match);
  const youtubeUrl = match.youtubeLiveUrl ?? '';
  const youtubeUrlValid = isValidYouTubeLiveUrl(youtubeUrl);
  const youtubeConfigured = !!parseYouTubeVideoId(youtubeUrl);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">

      <div className="flex flex-col items-center justify-center gap-1 border-b border-slate-800 pb-5 pt-1">
        <BrandBanner size="lg" subtitle="Tournament Control" />
        <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
          Admin Console
        </p>
      </div>
      
      {/* 1. Active Match Controller */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-amber-400">Active Match Control</h2>
          <div className="flex items-center space-x-2">
            {isGoldenPoint(match) ? (
              <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full font-bold animate-pulse border border-amber-400/40">
                GOLDEN POINT
              </span>
            ) : match.deuceActive ? (
              <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-bold animate-pulse">
                DEUCE (Win by 2)
              </span>
            ) : null}
            {match.bestOf === 3 && (
              <span className="text-xs bg-violet-500/20 text-violet-300 px-3 py-1 rounded-full font-bold border border-violet-400/30">
                BO3 · {formatGamesWonLabel(match)}
                {!seriesOver ? ` · G${match.gameNumber ?? 1}` : ''}
              </span>
            )}
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
              Target: <strong className="text-amber-300">{match.maxPoints ?? 11} Pts</strong>
            </span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
              ID: {match.currentMatchId}
            </span>
            {isCustomLiveMatch && (
              <span className="text-xs bg-violet-500/20 text-violet-300 px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
                Custom (not in fixture)
              </span>
            )}
          </div>
        </div>

        {/* Game / Match Winner Alert Banner */}
        {hasWinner && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <span className="text-emerald-400 font-bold text-base block">
                🎉 {seriesOver ? 'Match' : 'Game'} Won by{' '}
                {match.gameWinner === 1 ? match.player1 || match.teamA : match.player2 || match.teamB}! (
                {match.score1} - {match.score2})
              </span>
              {match.bestOf === 3 && (
                <span className="text-[11px] text-violet-300 block">
                  Series {formatGamesWonLabel(match)}
                  {formatGameScoresLine(match) ? ` · ${formatGameScoresLine(match)}` : ''}
                  {!seriesOver ? ' — start next game to continue' : ' — series complete'}
                </span>
              )}
              {currentFixtureCompleted ? (
                <span className="text-[11px] text-emerald-300/90">
                  Saved: {currentFixtureCompleted.result} on {currentFixtureCompleted.completedDate}{' '}
                  {currentFixtureCompleted.completedTime}
                </span>
              ) : seriesOver ? (
                <span className="text-[11px] text-amber-300/90">
                  {isCustomLiveMatch
                    ? 'Save result to record this custom match in Completed Matches.'
                    : 'Save result to mark this fixture completed in the schedule.'}
                </span>
              ) : (
                <span className="text-[11px] text-amber-300/90">
                  Best of 3 in progress — save when one side wins 2 games.
                </span>
              )}
              {saveError && <span className="text-[11px] text-red-400 block">{saveError}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!seriesOver && match.bestOf === 3 && (
                <button
                  type="button"
                  onClick={handleStartNextGame}
                  className="bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-300 transition-colors"
                >
                  Next Game
                </button>
              )}
              <button
                onClick={handleCompleteMatch}
                disabled={isSavingResult || !seriesOver}
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

        <SeriesScoreStrip match={match} size="sm" className="mb-4" />

        {/* Options, Swap Sides, and Court Indicator Toolbar */}
        <div className="mb-6 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-300">Format:</span>
            {MAX_POINTS_OPTIONS.map((pts) => (
              <button
                key={pts}
                type="button"
                onClick={() => updateMatchState({ ...match, maxPoints: pts, gameWinner: null })}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  (match.maxPoints ?? 11) === pts
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={`Race to ${pts}`}
              >
                {pts} Points
              </button>
            ))}
          </div>

          {/* Swap Court / Player Sides Button */}
          <button
            onClick={handleSwapSides}
            className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all flex items-center space-x-1.5"
          >
            <span>↔ Swap Court Sides</span>
          </button>

          {/* Active server indicator */}
          <span className="text-xs text-indigo-300 font-mono flex items-center gap-1.5">
            <ServeRacket active size={18} title="Serving" />
            <strong className="text-amber-300 uppercase">
              {match.server === 1 ? match.teamA : match.teamB}
            </strong>
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
              {match.server === 1 ? (
                <span
                  className="p-1.5 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/60"
                  title="Serving"
                >
                  <ServeRacket active size={26} title="Serving" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetServer(1)}
                  title="Set this side as server"
                  className="text-xs px-2.5 py-1 rounded-md font-bold bg-slate-700 text-slate-300 hover:bg-slate-600"
                >
                  Set Serve
                </button>
              )}
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
              {match.server === 2 ? (
                <span
                  className="p-1.5 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/60"
                  title="Serving"
                >
                  <ServeRacket active size={26} title="Serving" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetServer(2)}
                  title="Set this side as server"
                  className="text-xs px-2.5 py-1 rounded-md font-bold bg-slate-700 text-slate-300 hover:bg-slate-600"
                >
                  Set Serve
                </button>
              )}
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
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox"
              checked={!!match.isTrump}
              onChange={(e) => updateMatchState({ ...match, isTrump: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <span className="text-sm font-semibold text-slate-200">Trump Match Active</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetMatch}
              className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Reset Scores
            </button>
            <button
              type="button"
              onClick={() => {
                setFreshStartMessage(null);
                setShowFreshStartConfirm(true);
              }}
              className="text-xs font-bold text-red-300 hover:text-white bg-red-950/50 border border-red-500/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              Start Fresh…
            </button>
          </div>
        </div>

        {/* YouTube Live Link for Overlay */}
        <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label htmlFor="youtube-live-url" className="text-sm font-semibold text-slate-200">
              YouTube Live Link
            </label>
            <span className="text-[11px] text-slate-500">
              Used by <code className="text-indigo-300">/live</code>
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

      {/* 2. Custom match (not on fixture schedule) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-violet-300">Start Custom Match</h3>
            <p className="text-xs text-slate-400 mt-1">
              Use for exhibition / friendly / unscheduled games. Does not change the fixture list.
              Results still save to Completed Matches under a <span className="font-mono text-slate-300">custom-*</span> id.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Side A / Player 1
            </span>
            <input
              type="text"
              value={customSideA}
              onChange={(e) => setCustomSideA(e.target.value)}
              maxLength={80}
              placeholder="e.g. Nitin Verma"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Side B / Player 2
            </span>
            <input
              type="text"
              value={customSideB}
              onChange={(e) => setCustomSideB(e.target.value)}
              maxLength={80}
              placeholder="e.g. Sambit Mahapatra"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Category
            </span>
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {fixtureCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Exhibition">Exhibition</option>
              <option value="__other__">Other (type below)</option>
            </select>
            {customCategory === '__other__' && (
              <input
                type="text"
                value={customCategoryOther}
                onChange={(e) => setCustomCategoryOther(e.target.value)}
                maxLength={80}
                placeholder="Custom category name"
                className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Stage
            </span>
            <select
              value={customStage}
              onChange={(e) => setCustomStage(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {CUSTOM_MATCH_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Format
            </span>
            <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
              {MAX_POINTS_OPTIONS.map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setCustomMaxPoints(pts)}
                  className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                    customMaxPoints === pts
                      ? 'bg-violet-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {pts} Points
                </button>
              ))}
            </div>
            <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
              {BEST_OF_OPTIONS.map((bo) => (
                <button
                  key={bo}
                  type="button"
                  onClick={() => setCustomBestOf(bo)}
                  className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                    customBestOf === bo
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Best of {bo}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartCustomMatch}
            className="bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors shadow"
          >
            Start Custom Match ({customMaxPoints}p · BO{customBestOf})
          </button>
        </div>
        {customMatchError && (
          <p className="text-xs text-red-400" role="alert">
            {customMatchError}
          </p>
        )}
        {isCustomLiveMatch && (
          <p className="text-[11px] text-violet-300/90">
            Live now: {match.player1} vs {match.player2} · {match.category} · {match.stage}
          </p>
        )}
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
              <div className="flex items-center flex-wrap gap-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mr-1">
                  Start as
                </span>
                <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
                  {MAX_POINTS_OPTIONS.map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setSelectedMaxPoints(pts)}
                      className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                        selectedMaxPoints === pts ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Default fixture start format: ${pts} points`}
                    >
                      {pts} Points
                    </button>
                  ))}
                </div>
                <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
                  {BEST_OF_OPTIONS.map((bo) => (
                    <button
                      key={bo}
                      type="button"
                      onClick={() => setSelectedBestOf(bo)}
                      className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                        selectedBestOf === bo ? 'bg-violet-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Best of ${bo} games`}
                    >
                      BO{bo}
                    </button>
                  ))}
                </div>
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
                        <div className="flex items-center flex-wrap justify-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartFixture(fixture, selectedMaxPoints, selectedBestOf)}
                            className={`text-[11px] px-2.5 py-1 rounded font-bold transition-all ${
                              isLive &&
                              match.maxPoints === selectedMaxPoints &&
                              (match.bestOf ?? 1) === selectedBestOf
                                ? 'bg-emerald-500 text-slate-950 shadow'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                            title={`Start as ${selectedMaxPoints} point · best of ${selectedBestOf}`}
                          >
                            {isLive &&
                            match.maxPoints === selectedMaxPoints &&
                            (match.bestOf ?? 1) === selectedBestOf
                              ? `Live (${selectedMaxPoints}p BO${selectedBestOf})`
                              : isCompleted
                                ? `Replay ${selectedMaxPoints}p BO${selectedBestOf}`
                                : `Start ${selectedMaxPoints}p BO${selectedBestOf}`}
                          </button>
                          {MAX_POINTS_OPTIONS.filter((pts) => pts !== selectedMaxPoints).map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() => handleStartFixture(fixture, pts, selectedBestOf)}
                              className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${
                                isLive && match.maxPoints === pts && (match.bestOf ?? 1) === selectedBestOf
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
                              }`}
                              title={`Start as ${pts} point · best of ${selectedBestOf}`}
                            >
                              {isLive && match.maxPoints === pts && (match.bestOf ?? 1) === selectedBestOf
                                ? `Live ${pts}p`
                                : `${pts}p`}
                            </button>
                          ))}
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
            <button
              type="button"
              onClick={() => {
                setFreshStartMessage(null);
                setShowFreshStartConfirm(true);
              }}
              disabled={isResettingAll}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-950/60 text-red-200 border border-red-500/40 hover:bg-red-900/70 hover:text-white disabled:opacity-50 transition-colors"
              title="Delete all completed matches and reset live scores"
            >
              Start Fresh…
            </button>
          </div>
        </div>
        {exportError && (
          <p className="text-[11px] text-red-400">{exportError}</p>
        )}
        {freshStartMessage && (
          <p className={`text-[11px] ${freshStartMessage.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
            {freshStartMessage}
          </p>
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

      {/* 5. Editable Teams & Rosters Overview */}
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

      {showFreshStartConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fresh-start-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-red-500/40 shadow-2xl p-5 space-y-4">
            <div className="space-y-2 text-center">
              <h2 id="fresh-start-title" className="text-xl font-black text-red-400">
                Start fresh?
              </h2>
              <p className="text-sm text-slate-300">
                This will permanently delete <strong className="text-white">all completed matches</strong> and
                reset the live scoreboard to the default starting match.
              </p>
              <p className="text-xs text-slate-500">
                Team rosters are kept. This cannot be undone.
              </p>
              {freshStartMessage?.startsWith('Failed') && (
                <p className="text-xs text-red-400">{freshStartMessage}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowFreshStartConfirm(false)}
                disabled={isResettingAll}
                className="rounded-xl bg-slate-800 text-slate-200 font-bold text-sm py-3.5 border border-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFreshStart}
                disabled={isResettingAll}
                className="rounded-xl bg-red-600 text-white font-bold text-sm py-3.5 disabled:opacity-50 hover:bg-red-500"
              >
                {isResettingAll ? 'Clearing…' : 'Yes, clear everything'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
