import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ref, set, onValue, remove } from 'firebase/database';
import { db, YOUTUBE_LIVE_URL_PATH } from '../firebase';
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
  completedMatchesFromFirebase,
  mergeFixturesWithResults,
  sortCompletedMatches
} from '../utils/completedMatches';
import { exportScores } from '../utils/exportScores';
import type { ScoreExportFormat } from '../utils/exportScores';
import { normalizeMatchState } from '../utils/matchState';
import { BrandBanner } from '../components/BrandBanner';
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
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [teams, setTeams] = useState<Team[]>(TEAMS);
  const [completedById, setCompletedById] = useState<Record<string, CompletedMatch>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(FIXTURE_DATES[0] ?? 'All');
  const [selectedMaxPoints, setSelectedMaxPoints] = useState<MaxPoints>(11);
  const [selectedBestOf, setSelectedBestOf] = useState<BestOf>(1);
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
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const [youtubeSaveMessage, setYoutubeSaveMessage] = useState<string | null>(null);
  const [isSavingYoutube, setIsSavingYoutube] = useState(false);

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

    const youtubeRef = ref(db, YOUTUBE_LIVE_URL_PATH);
    const unsubscribeYoutube = onValue(youtubeRef, (snapshot) => {
      const val = snapshot.val();
      const url = typeof val === 'string' ? val : '';
      setYoutubeDraft(url);
    });

    return () => {
      unsubscribeMatch();
      unsubscribeTeams();
      unsubscribeCompleted();
      unsubscribeYoutube();
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

  const handleConfirmFreshStart = async () => {
    setIsResettingAll(true);
    setFreshStartMessage(null);
    setSaveError(null);
    setExportError(null);
    try {
      await remove(ref(db, 'completedMatches'));
      const resetMatch = {
        ...INITIAL_MATCH,
        youtubeLiveUrl: typeof youtubeDraft === 'string' ? youtubeDraft : ''
      };
      await set(ref(db, 'currentMatch'), resetMatch);
      setCompletedById({});
      setMatch(resetMatch);
      setShowFreshStartConfirm(false);
      setFreshStartMessage('All completed matches cleared. Live scores reset.');
    } catch (err) {
      console.error('Failed to reset tournament data:', err);
      setFreshStartMessage('Failed to reset. Check connection and try again.');
    } finally {
      setIsResettingAll(false);
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

  /**
   * Delete one completed-match record from Firebase.
   * Concurrency: single remove write; list re-syncs via onValue.
   * Security: id must be a non-empty string key already known from completedById.
   */
  const handleDeleteCompletedMatch = async (fixtureId: unknown) => {
    if (typeof fixtureId !== 'string' || !fixtureId.trim()) {
      setSaveError('Cannot delete: missing match id.');
      return;
    }
    const id = fixtureId.trim();
    if (!completedById[id]) {
      setSaveError('That completed match is no longer in the list.');
      return;
    }

    const row = completedById[id];
    const label = row?.details || row?.result || id;
    const ok = window.confirm(`Delete completed match?\n\n${label}\n\nThis cannot be undone.`);
    if (!ok) return;

    setSaveError(null);
    try {
      await remove(ref(db, `completedMatches/${id}`));
    } catch (err) {
      console.error('Failed to delete completed match:', err);
      setSaveError('Failed to delete completed match. Check connection and try again.');
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
    navigate('/admin/score');
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
      navigate('/admin/score');
    } catch (err) {
      setCustomMatchError(err instanceof Error ? err.message : 'Could not start custom match.');
    }
  };

  /**
   * Persist YouTube URL in settings (shared) and mirror onto currentMatch for /live.
   * Validation: empty clears; otherwise must be a valid YouTube URL.
   */
  const handleSaveYoutubeLiveUrl = async () => {
    const raw = typeof youtubeDraft === 'string' ? youtubeDraft.trim() : '';
    if (raw && !isValidYouTubeLiveUrl(raw)) {
      setYoutubeSaveMessage('Enter a valid YouTube watch, live, or share URL.');
      return;
    }
    setIsSavingYoutube(true);
    setYoutubeSaveMessage(null);
    try {
      await set(ref(db, YOUTUBE_LIVE_URL_PATH), raw);
      await set(ref(db, 'currentMatch'), { ...match, youtubeLiveUrl: raw });
      setMatch((prev) => ({ ...prev, youtubeLiveUrl: raw }));
      setYoutubeSaveMessage(raw ? 'YouTube link saved for all admins.' : 'YouTube link cleared.');
    } catch (err) {
      console.error('Failed to save YouTube URL:', err);
      setYoutubeSaveMessage('Failed to save YouTube link. Check connection.');
    } finally {
      setIsSavingYoutube(false);
    }
  };

  const handleClearYoutubeDraft = async () => {
    setYoutubeDraft('');
    setIsSavingYoutube(true);
    setYoutubeSaveMessage(null);
    try {
      await set(ref(db, YOUTUBE_LIVE_URL_PATH), '');
      await set(ref(db, 'currentMatch'), { ...match, youtubeLiveUrl: '' });
      setMatch((prev) => ({ ...prev, youtubeLiveUrl: '' }));
      setYoutubeSaveMessage('YouTube link cleared.');
    } catch (err) {
      console.error('Failed to clear YouTube URL:', err);
      setYoutubeSaveMessage('Failed to clear YouTube link.');
    } finally {
      setIsSavingYoutube(false);
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
  const isCustomLiveMatch = isCustomMatchId(match.currentMatchId);
  const youtubeDraftValid = isValidYouTubeLiveUrl(youtubeDraft);
  const youtubeConfigured = !!parseYouTubeVideoId(youtubeDraft);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">

      <div className="flex flex-col items-center justify-center gap-3 border-b border-slate-800 pb-5 pt-1">
        <BrandBanner size="lg" subtitle="Tournament Control" />
        <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
          Admin Console
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-2"
          aria-label="Staff navigation"
        >
          <Link
            to="/admin/score"
            className="rounded-lg bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wide px-4 py-2 shadow hover:bg-amber-300"
          >
            Score Desk
          </Link>
          <Link
            to="/scorer"
            className="rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs font-bold uppercase tracking-wide px-3 py-2 hover:bg-slate-800"
          >
            Court Scorer
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs font-bold uppercase tracking-wide px-3 py-2 hover:bg-slate-800"
          >
            Viewer Portal
          </Link>
          <Link
            to="/rules"
            className="rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs font-bold uppercase tracking-wide px-3 py-2 hover:bg-slate-800"
          >
            Rules
          </Link>
        </nav>
        <p className="text-[11px] text-slate-500 text-center max-w-lg">
          Pick a fixture below (or start a custom match) to open the score desk. After you save,
          you return here to choose the next game.
        </p>
      </div>
      
      {/* Persistent YouTube only — scoring lives on /admin/score */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label htmlFor="youtube-live-url" className="text-sm font-semibold text-slate-200">
            YouTube Live Link
          </label>
          <span className="text-[11px] text-slate-500">
            Saved for all admins · used by <code className="text-indigo-300">/live</code>
            {youtubeConfigured ? (
              <span className="ml-2 text-emerald-400 font-semibold">● Linked</span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="youtube-live-url"
            type="url"
            value={youtubeDraft}
            onChange={(e) => {
              setYoutubeDraft(e.target.value);
              setYoutubeSaveMessage(null);
            }}
            placeholder="https://www.youtube.com/watch?v=… or /live/…"
            className={`flex-1 bg-slate-950 border rounded-lg p-2.5 text-sm text-white focus:outline-none ${
              youtubeDraft.trim() && !youtubeDraftValid
                ? 'border-red-500 focus:border-red-400'
                : 'border-slate-700 focus:border-indigo-500'
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void handleSaveYoutubeLiveUrl()}
            disabled={isSavingYoutube || (youtubeDraft.trim() !== '' && !youtubeDraftValid)}
            className="text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
          >
            {isSavingYoutube ? 'Saving…' : 'Save Link'}
          </button>
          <button
            type="button"
            onClick={() => void handleClearYoutubeDraft()}
            disabled={isSavingYoutube || !youtubeDraft}
            className="text-xs text-slate-300 hover:text-white bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
        {youtubeDraft.trim() && !youtubeDraftValid && (
          <p className="text-[11px] text-red-400">
            Enter a valid YouTube watch, live, or share URL.
          </p>
        )}
        {youtubeSaveMessage && (
          <p
            className={`text-[11px] ${
              youtubeSaveMessage.startsWith('Failed') || youtubeSaveMessage.startsWith('Enter')
                ? 'text-red-400'
                : 'text-emerald-400'
            }`}
          >
            {youtubeSaveMessage}
          </p>
        )}
      </div>

      {/* 1. Tournament Fixtures — start a match */}
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
        {saveError && (
          <p className="text-[11px] text-red-400" role="alert">
            {saveError}
          </p>
        )}
        {freshStartMessage && (
          <p className={`text-[11px] ${freshStartMessage.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
            {freshStartMessage}
          </p>
        )}

        {completedRows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No finished matches yet. After a game ends on the score desk, use{' '}
            <strong className="text-emerald-400">Save &amp; Share</strong>.
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
                  <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
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
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      {typeof row.snapshotUrl === 'string' && row.snapshotUrl.startsWith('https://') ? (
                        <a
                          href={row.snapshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/70"
                          title="Open score snapshot photo"
                        >
                          Photo
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDeleteCompletedMatch(row.fixtureId)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-950/50 text-red-300 border border-red-500/40 hover:bg-red-900/70 hover:text-white transition-colors"
                        title="Delete this completed match"
                      >
                        Delete
                      </button>
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
